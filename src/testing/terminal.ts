// End-to-end terminal testing: launch an app in a real PTY wired to a real
// terminal emulator engine (Ghostty's VT core or xterm.js), then interact
// and assert Playwright-style — locators, auto-waiting, key presses.
import { randomUUID } from "node:crypto";

import {
  createEmulator,
  type Emulator,
  type EmulatorCell,
  type EmulatorName,
} from "#/testing/emulators.ts";
import { keyToSequence } from "#/testing/keys.ts";
import { connectLiveClient, currentTestName } from "#/testing/live.ts";

export type LaunchOptions = {
  /**
	Which emulator engine answers the app's terminal queries and interprets
	its output.

	@default "ghostty"
	*/
  emulator?: EmulatorName;

  columns?: number;
  rows?: number;

  /**
	The emulated OS color scheme at startup (Ghostty engine only).

	@default "dark"
	*/
  colorScheme?: "dark" | "light";

  cwd?: string;
  env?: Record<string, string>;
};

export type WaitForOptions = {
  /**
	@default 5000
	*/
  timeout?: number;

  /**
	Wait for the text to appear (`"visible"`, default) or disappear
	(`"hidden"`).
	*/
  state?: "visible" | "hidden";
};

export type TerminalLocator = {
  /**
	Whether the text is on the visible screen right now.
	*/
  isVisible: () => boolean;

  /**
	The full screen line containing the match, if any.
	*/
  line: () => string | undefined;

  /**
	Waits (polling) until the text appears — or disappears with
	`state: "hidden"`. Throws with a screen dump on timeout.
	*/
  waitFor: (options?: WaitForOptions) => Promise<void>;

  description: string;
};

export type TerminalApp = {
  readonly emulator: EmulatorName;

  /**
	The visible screen as right-trimmed lines.
	*/
  lines: () => string[];

  /**
	The visible screen as one string, trailing blank lines removed.
	*/
  text: () => string;

  getByText: (text: string | RegExp) => TerminalLocator;

  /**
	Polls until the predicate holds. Throws with a screen dump on timeout.
	*/
  waitFor: (predicate: () => boolean, options?: { timeout?: number }) => Promise<void>;

  /**
	Presses named keys in order: `press("Tab", "Enter")`, `press("Ctrl+C")`.
	Keys are spaced out slightly, like real typing, so each key's effect
	(focus moves, state updates) lands before the next one.
	*/
  press: (...keys: string[]) => Promise<void>;

  /**
	Types text verbatim.
	*/
  type: (text: string) => void;

  resize: (columns: number, rows: number) => void;

  /**
	Flips the emulated OS color scheme (Ghostty engine only) — the app
	receives a real color scheme report if it enabled them.
	*/
  setColorScheme: (scheme: "dark" | "light") => void;

  cellAt: (x: number, y: number) => EmulatorCell | undefined;

  cursor: () => { x: number; y: number };

  /**
	Everything the app has written, unprocessed.
	*/
  output: () => string;

  /**
	The exit code once the app has exited.
	*/
  exitCode: () => number | undefined;

  waitForExit: (options?: { timeout?: number }) => Promise<number>;

  /**
	Kills the app (if still running) and disposes the emulator.
	*/
  close: () => void;
};

const defaultTimeout = 5000;
const pollInterval = 25;

const screenDump = (emulator: Emulator): string =>
  ["", "── screen ──", ...emulator.lines().map((line) => `│${line}`), "────────────"].join("\n");

const poll = async (
  check: () => boolean,
  timeout: number,
  onTimeout: () => Error,
): Promise<void> => {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (check()) {
      return;
    }

    if (Date.now() > deadline) {
      throw onTimeout();
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
};

/**
Launches a command inside a PTY attached to a real terminal emulator engine.

```ts
const app = await launchTerminal(["node", "--import=tsx", "examples/router/index.ts"]);
await app.getByText("Home").waitFor();
app.press("Tab", "Enter");
await app.getByText("Users").waitFor();
app.close();
```

A string command runs through `sh -c`.
*/
export const launchTerminal = async (
  command: string | string[],
  {
    emulator: emulatorName = "ghostty",
    columns = 100,
    rows = 30,
    colorScheme = "dark",
    cwd = process.cwd(),
    env = {},
  }: LaunchOptions = {},
): Promise<TerminalApp> => {
  const zigpty = await import("zigpty").catch((error) => {
    throw new Error(
      'The "zigpty" package is required to launch terminal apps. Install it as a dev dependency: pnpm add -D zigpty',
      { cause: error },
    );
  });

  const emulator = await createEmulator(emulatorName, { columns, rows, colorScheme });

  const argv = Array.isArray(command) ? command : ["/bin/sh", "-c", command];
  // Tests should behave like a user's interactive truecolor session, even on
  // CI — both emulator engines understand 24-bit SGR.
  const childEnv: Record<string, string> = {
    ...(process.env as Record<string, string>),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    COLORTERM: "truecolor",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    NODE_NO_WARNINGS: "1",
    ...env,
  };
  delete childEnv["CI"];
  const child = zigpty.spawn(argv[0]!, argv.slice(1), {
    name: "xterm-256color",
    cols: columns,
    rows,
    cwd,
    env: childEnv,
  });

  let output = "";
  let exitCode: number | undefined;
  let closed = false;

  // Mirror the session to the live hub (explorer /live page) when one is
  // configured, so the run can be watched in the browser as it happens.
  const live = connectLiveClient();
  const liveId = randomUUID();
  if (live) {
    const commandTitle = Array.isArray(command) ? command.join(" ") : command;
    live.send({ type: "start", id: liveId, title: commandTitle, columns, rows });
    // Inside Vitest, relabel with the test that launched this session.
    void currentTestName().then((name) => {
      if (name) {
        live.send({ type: "title", id: liveId, title: name });
      }
    });
  }

  child.onData((data: string | Buffer) => {
    if (closed) {
      return;
    }

    const chunk = typeof data === "string" ? data : data.toString("latin1");
    output += chunk;
    emulator.feed(chunk);
    live?.send({ type: "data", id: liveId, data: chunk });
  });

  emulator.onResponse((data) => {
    if (exitCode === undefined) {
      child.write(data);
    }
  });

  child.onExit(({ exitCode: code }: { exitCode: number }) => {
    exitCode = code;
    live?.send({ type: "end", id: liveId, code });
  });

  const lines = (): string[] => emulator.lines();

  const getByText = (matcher: string | RegExp): TerminalLocator => {
    const description = typeof matcher === "string" ? JSON.stringify(matcher) : String(matcher);
    const findLine = (): string | undefined =>
      lines().find((line) =>
        typeof matcher === "string" ? line.includes(matcher) : matcher.test(line),
      );

    return {
      description,
      isVisible: () => findLine() !== undefined,
      line: findLine,
      waitFor: async ({ timeout = defaultTimeout, state = "visible" }: WaitForOptions = {}) => {
        const check =
          state === "visible" ? () => findLine() !== undefined : () => findLine() === undefined;
        await poll(check, timeout, () =>
          state === "visible"
            ? new Error(`Timed out waiting for ${description} to appear.${screenDump(emulator)}`)
            : new Error(
                `Timed out waiting for ${description} to disappear.${screenDump(emulator)}`,
              ),
        );
      },
    };
  };

  return {
    emulator: emulatorName,
    lines,
    text: () => lines().join("\n").replace(/\n+$/, ""),
    getByText,
    waitFor: async (predicate, { timeout = defaultTimeout } = {}) => {
      await poll(
        predicate,
        timeout,
        () => new Error(`Timed out waiting for condition.${screenDump(emulator)}`),
      );
    },
    press: async (...keys) => {
      for (const key of keys) {
        const outputBefore = output.length;
        child.write(keyToSequence(key));
        // Wait for the key's effect to render before the next key — a fixed
        // gap flakes under load when a re-render (e.g. a focus move) hasn't
        // committed yet. Keys without visible effect give up after the cap.
        const deadline = Date.now() + 500;
        while (Date.now() < deadline && output.length === outputBefore) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        await new Promise((resolve) => setTimeout(resolve, 15));
      }
    },
    type: (text) => {
      child.write(text);
    },
    resize: (nextColumns, nextRows) => {
      child.resize(nextColumns, nextRows);
      emulator.resize(nextColumns, nextRows);
    },
    setColorScheme: (scheme) => {
      if (!emulator.setColorScheme) {
        throw new Error(`The ${emulatorName} emulator cannot change color scheme.`);
      }

      emulator.setColorScheme(scheme);
    },
    cellAt: emulator.cellAt,
    cursor: emulator.cursor,
    output: () => output,
    exitCode: () => exitCode,
    waitForExit: async ({ timeout = defaultTimeout } = {}) => {
      await poll(
        () => exitCode !== undefined,
        timeout,
        () => new Error(`Timed out waiting for the app to exit.${screenDump(emulator)}`),
      );
      return exitCode!;
    },
    close: () => {
      if (closed) {
        return;
      }

      closed = true;
      if (exitCode === undefined) {
        try {
          child.kill();
        } catch {}
        live?.send({ type: "end", id: liveId, code: undefined });
      }

      live?.close();
      emulator.dispose();
    },
  };
};
