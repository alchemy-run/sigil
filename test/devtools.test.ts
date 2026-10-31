import { spawnSync } from "node:child_process";

import { expect, onTestFinished, test } from "vite-plus/test";

import term from "./helpers/term.ts";
import { createWebSocketServer } from "./helpers/websocket-server.ts";

test("DevTools connection cleanup tolerates an error emitted synchronously by close()", () => {
  // Isolate the globals installed by devtools.ts from the test runner.
  const result = spawnSync(
    process.execPath,
    [
      "--import=tsx",
      "--input-type=module",
      "-e",
      `
        import assert from "node:assert/strict";
        let closeCalls = 0;
        globalThis.WebSocket = class extends EventTarget {
          constructor() {
            super();
            queueMicrotask(() => this.dispatchEvent(new Event("error")));
          }
          close() {
            closeCalls++;
            assert.equal(closeCalls, 1, "connection cleanup must not re-enter");
            this.dispatchEvent(new Event("error"));
          }
        };
        await import(${JSON.stringify(new URL("../src/devtools.ts", import.meta.url).href)});
        assert.equal(closeCalls, 1);
      `,
    ],
    { encoding: "utf8", timeout: 10_000 },
  );

  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toContain("React DevTools server is not running");
});

test("exit on unmount() while connected to React DevTools", async (context) => {
  // The DevTools port is not configurable, so the fake DevTools server has to listen on the default one.
  let server: Awaited<ReturnType<typeof createWebSocketServer>>;
  try {
    server = await createWebSocketServer(8097);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
      context.skip("Port 8097 is in use");
    }

    throw error;
  }

  onTestFinished(async () => {
    await server.close();
  });

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const ps = term("devtools-exit-on-unmount", [], { env: { SIGIL_DEV: "true" } });
  await ps.waitForExit();

  expect(ps.output).toContain("exited");
  expect(server.receivedChunks, "DevTools never received a message").toBeGreaterThan(0);
});
