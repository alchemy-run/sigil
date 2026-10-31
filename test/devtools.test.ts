import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, onTestFinished, test } from "vite-plus/test";

test("DevTools connection cleanup tolerates an error emitted synchronously by close()", () => {
  // Isolate the globals installed by devtools.ts from the test runner. The
  // script runs through vpx, which resolves sigil's `#/` imports on every
  // supported Node version (Node 22 rejects them natively).
  const directory = mkdtempSync(path.join(tmpdir(), "sigil-devtools-"));
  onTestFinished(() => {
    rmSync(directory, { recursive: true, force: true });
  });
  const script = path.join(directory, "close-error.mjs");
  writeFileSync(
    script,
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
  );
  const result = spawnSync("vpx", [script], { encoding: "utf8", timeout: 30_000 });

  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toContain("React DevTools server is not running");
});
