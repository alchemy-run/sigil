import { spawnSync } from "node:child_process";

import { expect, test } from "vite-plus/test";

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
