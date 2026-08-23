// Browser harnesses: terminal apps rendered by xterm.js in the browser,
// bridged over WebSocket to a fresh PTY per connection.
//
// - `serveTerminal(command)` hosts a single app.
// - `serveExplorer(entries)` hosts an index of apps (examples, test runs, …)
//   with a terminal page per entry — the "open mode" for a repo.
//
// The WebSocket framing is implemented on top of node:http upgrades; the
// frontend is a Vite app (explorer-app/) mounted in middleware mode, with
// xterm.js and its full addon set as real npm imports.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { dirname, join } from "node:path";
import { type Duplex } from "node:stream";
import { fileURLToPath } from "node:url";

import { type TestEngine } from "#/testing/vitest.ts";

export type ExplorerEntry = {
  /**
	Stable identifier used in URLs. Only registered ids can be launched —
	nothing from the request ever reaches a shell.
	*/
  id: string;

  title: string;

  /**
	Argv array, or a string run through `sh -c`.
	*/
  command: string | string[];

  /**
	Section heading in the index ("Examples", "Tests", …).
	*/
  group?: string;

  cwd?: string;
  env?: Record<string, string>;
};

export type ServeTerminalOptions = {
  /**
	@default 0 (any free port)
	*/
  port?: number;

  columns?: number;
  rows?: number;
  cwd?: string;
  env?: Record<string, string>;

  /**
	Page title.
	*/
  title?: string;
};

export type ServeExplorerOptions = Omit<ServeTerminalOptions, "title"> & {
  title?: string;

  /**
	An embedded test engine (see `createVitestEngine`) — adds the test tree
	with run buttons and live result streaming to the explorer UI.
	*/
  tests?: TestEngine;
};

export type TerminalServer = {
  url: string;
  port: number;
  close: () => Promise<void>;
};

const websocketGuid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

// Minimal RFC 6455 framing: unmasked text frames out, masked frames in.
const encodeTextFrame = (payload: string): Buffer => {
  const data = Buffer.from(payload, "utf8");
  if (data.length < 126) {
    return Buffer.concat([Buffer.from([0x81, data.length]), data]);
  }

  if (data.length < 65_536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(data.length, 2);
    return Buffer.concat([header, data]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(data.length), 2);
  return Buffer.concat([header, data]);
};

type DecodedFrame = { opcode: number; payload: Buffer; length: number };

const decodeFrame = (buffer: Buffer): DecodedFrame | undefined => {
  if (buffer.length < 2) {
    return undefined;
  }

  const opcode = buffer[0]! & 0x0f;
  const masked = (buffer[1]! & 0x80) !== 0;
  let payloadLength = buffer[1]! & 0x7f;
  let offset = 2;

  if (payloadLength === 126) {
    if (buffer.length < 4) {
      return undefined;
    }

    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) {
      return undefined;
    }

    payloadLength = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  const maskLength = masked ? 4 : 0;
  if (buffer.length < offset + maskLength + payloadLength) {
    return undefined;
  }

  const mask = masked ? buffer.subarray(offset, offset + 4) : undefined;
  const payload = Buffer.from(
    buffer.subarray(offset + maskLength, offset + maskLength + payloadLength),
  );
  if (mask) {
    for (let index = 0; index < payload.length; index++) {
      payload[index]! ^= mask[index % 4]!;
    }
  }

  return { opcode, payload, length: offset + maskLength + payloadLength };
};

type CreateServerOptions = {
  port: number;
  columns: number;
  rows: number;
  mode: "explorer" | "terminal";
  title: string;
  tests: TestEngine | undefined;
};

const createTerminalServer = async (
  entries: ExplorerEntry[],
  { port, columns, rows, mode, title, tests }: CreateServerOptions,
): Promise<TerminalServer> => {
  const zigpty = await import("zigpty").catch((error) => {
    throw new Error(
      'The "zigpty" package is required to launch terminal apps. Install it as a dev dependency: pnpm add -D zigpty',
      { cause: error },
    );
  });

  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const sockets = new Set<Duplex>();

  // Live-session hub: harness-launched terminals (see live.ts) stream here;
  // /live watchers render them in real time.
  type LiveSession = {
    id: string;
    title: string;
    columns: number;
    rows: number;
    data: string;
    done: boolean;
    exitCode: number | undefined;
  };
  const liveSessions = new Map<string, LiveSession>();
  const liveWatchers = new Set<Duplex>();
  const maxLiveSessions = 20;
  const maxLiveBuffer = 2_000_000;

  const broadcastLive = (message: object): void => {
    const frame = encodeTextFrame(JSON.stringify(message));
    for (const watcher of liveWatchers) {
      if (!watcher.destroyed) {
        watcher.write(frame);
      }
    }
  };

  const ingestLiveMessage = (message: {
    type: string;
    id?: string;
    title?: string;
    columns?: number;
    rows?: number;
    data?: string;
    code?: number;
  }): void => {
    if (message.id === undefined) {
      return;
    }

    if (message.type === "start") {
      liveSessions.set(message.id, {
        id: message.id,
        title: message.title ?? message.id,
        columns: message.columns ?? 80,
        rows: message.rows ?? 24,
        data: "",
        done: false,
        exitCode: undefined,
      });
      // Cap retained sessions, dropping the oldest finished ones first.
      for (const [id, session] of liveSessions) {
        if (liveSessions.size <= maxLiveSessions) {
          break;
        }

        if (session.done) {
          liveSessions.delete(id);
        }
      }

      broadcastLive({ ...liveSessions.get(message.id), type: "start" });
      return;
    }

    const session = liveSessions.get(message.id);
    if (!session) {
      return;
    }

    if (message.type === "data" && message.data !== undefined) {
      session.data = (session.data + message.data).slice(-maxLiveBuffer);
      broadcastLive({ type: "data", id: session.id, data: message.data });
    } else if (message.type === "title" && message.title !== undefined) {
      session.title = message.title;
      broadcastLive({ type: "title", id: session.id, title: message.title });
    } else if (message.type === "end") {
      session.done = true;
      session.exitCode = message.code;
      broadcastLive({ type: "end", id: session.id, code: message.code });
    }
  };

  const entryFor = (requestUrl: string | undefined): ExplorerEntry | undefined => {
    const url = new URL(requestUrl ?? "/", "http://localhost");
    const id = url.searchParams.get("app") ?? entries[0]?.id;
    return id === null || id === undefined ? undefined : byId.get(id);
  };

  // The frontend is a Vite app (src/testing/explorer-app) mounted in
  // middleware mode: our API and WebSocket endpoints are handled here, and
  // everything else — the SPA, its modules, xterm.js and every addon as real
  // npm imports, HMR — is Vite's.
  const { createServer: createViteServer } = await import("vite").catch((error) => {
    throw new Error(
      'The "vite" package is required for the browser harness. Install it as a dev dependency: pnpm add -D vite',
      { cause: error },
    );
  });

  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (url.pathname === "/api/config") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          mode,
          title,
          columns,
          rows,
          tests: tests !== undefined,
          entries: entries.map((entry) => ({
            id: entry.id,
            title: entry.title,
            group: entry.group ?? "Apps",
          })),
        }),
      );
      return;
    }

    if (url.pathname === "/api/tests" && tests) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ running: tests.running(), files: tests.tree() }));
      return;
    }

    if (url.pathname === "/api/run" && request.method === "POST" && tests) {
      const taskId = url.searchParams.get("task");
      if (taskId) {
        tests.runTask(taskId);
      } else {
        tests.runAll();
      }

      response.writeHead(202);
      response.end();
      return;
    }

    vite.middlewares(request, response);
  });

  // Next to this module in src; from a dist build, fall back to the shipped
  // src copy.
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const appRootCandidates = [
    join(moduleDir, "explorer-app"),
    join(moduleDir, "..", "src", "testing", "explorer-app"),
  ];
  const appRoot = appRootCandidates.find((candidate) => existsSync(candidate));
  if (!appRoot) {
    throw new Error("The explorer frontend (src/testing/explorer-app) is missing.");
  }
  const vite = await createViteServer({
    configFile: false,
    root: appRoot,
    appType: "spa",
    logLevel: "warn",
    cacheDir: join(process.cwd(), "node_modules", ".vite-sigil-explorer"),
    server: { middlewareMode: true, hmr: { server } },
  });

  server.on("upgrade", (request: IncomingMessage, socket: Duplex) => {
    const key = request.headers["sec-websocket-key"];
    const url = new URL(request.url ?? "/", "http://localhost");
    const entry = url.pathname === "/pty" ? entryFor(request.url) : undefined;
    const isLive = url.pathname === "/live/ingest" || url.pathname === "/live/watch";
    const ours = url.pathname === "/pty" || isLive;
    if (!ours) {
      // Not our endpoint — Vite's HMR upgrade listener handles its own.
      return;
    }

    if (!entry && !isLive) {
      socket.destroy();
      return;
    }

    if (!key) {
      socket.destroy();
      return;
    }

    const accept = createHash("sha1")
      .update(key + websocketGuid)
      .digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    sockets.add(socket);

    if (url.pathname === "/live/watch") {
      liveWatchers.add(socket);
      socket.write(
        encodeTextFrame(
          JSON.stringify({
            type: "init",
            sessions: [...liveSessions.values()],
            tests: tests?.tree(),
            running: tests?.running() ?? false,
          }),
        ),
      );
      const dropWatcher = (): void => {
        liveWatchers.delete(socket);
        sockets.delete(socket);
      };
      socket.on("close", dropWatcher);
      socket.on("error", dropWatcher);
      return;
    }

    if (url.pathname === "/live/ingest") {
      let pendingIngest = Buffer.alloc(0);
      socket.on("data", (chunk: Buffer) => {
        pendingIngest = Buffer.concat([pendingIngest, chunk]);
        for (;;) {
          const frame = decodeFrame(pendingIngest);
          if (!frame) {
            return;
          }

          pendingIngest = pendingIngest.subarray(frame.length);
          if (frame.opcode === 8) {
            socket.destroy();
            return;
          }

          if (frame.opcode === 1) {
            try {
              ingestLiveMessage(JSON.parse(frame.payload.toString("utf8")));
            } catch {}
          }
        }
      });
      const dropIngest = (): void => {
        sockets.delete(socket);
      };
      socket.on("close", dropIngest);
      socket.on("error", dropIngest);
      return;
    }

    if (!entry) {
      socket.destroy();
      return;
    }

    const argv = Array.isArray(entry.command) ? entry.command : ["/bin/sh", "-c", entry.command];
    // The app runs in an interactive truecolor terminal (xterm.js), whatever
    // environment the explorer itself was launched from.
    const childEnv: Record<string, string> = {
      ...(process.env as Record<string, string>),
      // eslint-disable-next-line @typescript-eslint/naming-convention
      COLORTERM: "truecolor",
      // eslint-disable-next-line @typescript-eslint/naming-convention
      NODE_NO_WARNINGS: "1",
      ...entry.env,
    };
    delete childEnv["CI"];
    const child = zigpty.spawn(argv[0]!, argv.slice(1), {
      name: "xterm-256color",
      cols: columns,
      rows,
      cwd: entry.cwd ?? process.cwd(),
      env: childEnv,
    });

    const send = (message: object): void => {
      if (!socket.destroyed) {
        socket.write(encodeTextFrame(JSON.stringify(message)));
      }
    };

    let exited = false;
    child.onData((data: string | Buffer) => {
      send({ type: "data", data: typeof data === "string" ? data : data.toString("utf8") });
    });
    child.onExit(({ exitCode }: { exitCode: number }) => {
      exited = true;
      send({ type: "exit", code: exitCode });
    });

    let pending = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk]);
      for (;;) {
        const frame = decodeFrame(pending);
        if (!frame) {
          return;
        }

        pending = pending.subarray(frame.length);
        if (frame.opcode === 8) {
          socket.destroy();
          return;
        }

        if (frame.opcode === 1) {
          try {
            const message = JSON.parse(frame.payload.toString("utf8")) as {
              type: string;
              data?: string;
              columns?: number;
              rows?: number;
            };
            if (message.type === "data" && message.data !== undefined && !exited) {
              child.write(message.data);
            }

            if (message.type === "resize" && message.columns && message.rows && !exited) {
              child.resize(message.columns, message.rows);
            }
          } catch {}
        }
      }
    });

    const cleanup = (): void => {
      sockets.delete(socket);
      if (!exited) {
        try {
          child.kill();
        } catch {}
      }
    };

    socket.on("close", cleanup);
    socket.on("error", cleanup);
  });

  const unsubscribeTests = tests?.onUpdate(() => {
    broadcastLive({ type: "tests", files: tests.tree(), running: tests.running() });
  });

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  const boundPort = typeof address === "object" && address ? address.port : port;

  return {
    url: `http://127.0.0.1:${boundPort}/`,
    port: boundPort,
    close: async () => {
      unsubscribeTests?.();
      for (const socket of sockets) {
        socket.destroy();
      }

      await vite.close();
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    },
  };
};

/**
Serves a browser terminal running `command` — each page load (WebSocket
connection) gets its own PTY. Resolves once listening.

```ts
const server = await serveTerminal(["node", "--import=tsx", "examples/router/index.ts"]);
console.log(`open ${server.url}`);
```
*/
export const serveTerminal = (
  command: string | string[],
  {
    port = 0,
    columns = 100,
    rows = 30,
    cwd = process.cwd(),
    env = {},
    title = "sigil terminal",
  }: ServeTerminalOptions = {},
): Promise<TerminalServer> =>
  createTerminalServer([{ id: "app", title, command, cwd, env }], {
    port,
    columns,
    rows,
    mode: "terminal",
    title,
    tests: undefined,
  });

/**
Serves an explorer index over many terminal apps — the browser "open mode":
examples to poke at interactively, test runs to watch, each on its own
terminal page with a fresh PTY per load.
*/
export const serveExplorer = (
  entries: ExplorerEntry[],
  {
    port = 0,
    columns = 100,
    rows = 30,
    title = "sigil explorer",
    tests,
  }: ServeExplorerOptions = {},
): Promise<TerminalServer> => {
  if (entries.length === 0) {
    throw new Error("serveExplorer needs at least one entry.");
  }

  return createTerminalServer(entries, {
    port,
    columns,
    rows,
    mode: "explorer",
    title,
    tests,
  });
};
