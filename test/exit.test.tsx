import { createRequire } from "node:module";
import * as path from "node:path";
import process from "node:process";

import { expect, test } from "vite-plus/test";

import stripAnsi from "../src/ansi/strip.ts";
import { run } from "./helpers/run.ts";

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
const { spawn } = require("node-pty") as typeof import("node-pty");

test("exit normally without unmount() or exit()", async () => {
  const output = await run("exit-normally");
  expect(output.includes("exited")).toBe(true);
});

test("exit on unmount()", async () => {
  const output = await run("exit-on-unmount");
  expect(output.includes("exited")).toBe(true);
});

test("exit when app finishes execution", async () => {
  const ps = run("exit-on-finish");
  await expect(ps).resolves.toBeTruthy();
});

test("exit on exit()", async () => {
  const output = await run("exit-on-exit");
  expect(output.includes("exited")).toBe(true);
});

test("exit on exit() with error", async () => {
  const output = await run("exit-on-exit-with-error");
  expect(output.includes("errored")).toBe(true);
});

test("exit on exit() with error with value property", async () => {
  const output = await run("exit-on-exit-with-error-value-property");
  expect(output.includes("errored")).toBe(true);
});

test("exit on exit() with result value", async () => {
  const output = await run("exit-on-exit-with-result");
  expect(output.includes("result:hello from ink")).toBe(true);
});

test("exit on exit() with object result", async () => {
  const output = await run("exit-on-exit-with-value-object");
  expect(output.includes("result:hello from ink object")).toBe(true);
});

test("exit on exit() with raw mode", async () => {
  const output = await run("exit-raw-on-exit");
  expect(output.includes("exited")).toBe(true);
});

test("exit on exit() with raw mode with error", async () => {
  const output = await run("exit-raw-on-exit-with-error");
  expect(output.includes("errored")).toBe(true);
});

test("exit on unmount() with raw mode", async () => {
  const output = await run("exit-raw-on-unmount");
  expect(output.includes("exited")).toBe(true);
});

test("exit with thrown error", async () => {
  const output = await run("exit-with-thrown-error");
  expect(output.includes("errored")).toBe(true);
});

test("don’t exit while raw mode is active", async () => {
  await new Promise<void>((resolve, reject) => {
    const env: Record<string, string> = {
      ...process.env,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      NODE_NO_WARNINGS: "1",
    };

    const term = spawn(
      "node",
      ["--import=tsx", path.join(import.meta.dirname, "./fixtures/exit-double-raw-mode.tsx")],
      {
        name: "xterm-color",
        cols: 100,
        cwd: import.meta.dirname,
        env,
      },
    );

    let output = "";

    term.onData((data) => {
      if (data === "s") {
        setTimeout(() => {
          expect(isExited).toBe(false);
          term.write("q");
        }, 500);

        setTimeout(() => {
          term.kill();
          reject(new Error("Test timed out - process did not exit in time"));
        }, 2000);
      } else {
        output += data;
      }
    });

    let isExited = false;

    term.onExit(({ exitCode }) => {
      isExited = true;

      if (exitCode === 0) {
        expect(output.includes("exited")).toBe(true);
        expect(true).toBe(true); // TODO: ported from t.fail()
        resolve();
        return;
      }

      reject(new Error(`Process exited with code ${exitCode}`));
    });
  });
});

test("exit when DEV is set", async () => {
  const output = await run("exit-normally", {
    env: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      DEV: "true",
    },
  });
  // Warning output depends on whether a local React DevTools server is running.
  expect(output.includes("exited")).toBe(true);
});

test("exit on exit() with error and static output", async () => {
  const output = await run("exit-with-static");
  // Error is propagated, not swallowed
  expect(output.includes("errored")).toBe(true);
  // Static items rendered
  expect(output.includes("A")).toBe(true);
  expect(output.includes("B")).toBe(true);
  expect(output.includes("C")).toBe(true);
  // Static items NOT duplicated (the bug from #397)
  const cleaned = stripAnsi(output);
  expect(cleaned.split("A").length - 1).toBe(1);
});
