import * as path from "node:path";

import { expect, test } from "vite-plus/test";
import { spawn } from "zigpty";

import { stripAnsi } from "#/ansi/strip.ts";

import { run } from "./helpers/run.ts";

test("exit normally without unmount() or exit()", async () => {
  const output = await run("exit-normally");
  expect(output).toContain("exited");
});

test("exit on unmount()", async () => {
  const output = await run("exit-on-unmount");
  expect(output).toContain("exited");
});

test("exit when app finishes execution", async () => {
  const ps = run("exit-on-finish");
  await expect(ps).resolves.toBeTruthy();
});

test("exit on exit()", async () => {
  const output = await run("exit-on-exit");
  expect(output).toContain("exited");
});

test("exit on exit() with error", async () => {
  const output = await run("exit-on-exit-with-error");
  expect(output).toContain("errored");
});

test("exit on exit() with error with value property", async () => {
  const output = await run("exit-on-exit-with-error-value-property");
  expect(output).toContain("errored");
});

test("exit on exit() with result value", async () => {
  const output = await run("exit-on-exit-with-result");
  expect(output).toContain("result:hello from ink");
});

test("exit on exit() with object result", async () => {
  const output = await run("exit-on-exit-with-value-object");
  expect(output).toContain("result:hello from ink object");
});

test("exit on exit() with raw mode", async () => {
  const output = await run("exit-raw-on-exit");
  expect(output).toContain("exited");
});

test("exit on exit() with raw mode with error", async () => {
  const output = await run("exit-raw-on-exit-with-error");
  expect(output).toContain("errored");
});

test("exit on unmount() with raw mode", async () => {
  const output = await run("exit-raw-on-unmount");
  expect(output).toContain("exited");
});

test("exit with thrown error", async () => {
  const output = await run("exit-with-thrown-error");
  expect(output).toContain("errored");
});

test("don't exit while raw mode is active", async () => {
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
        output += data.toString();
      }
    });

    let isExited = false;

    term.onExit(({ exitCode }) => {
      isExited = true;

      if (exitCode === 0) {
        expect(output).toContain("exited");
        expect(true).toBe(true); // TODO: ported from t.fail()
        resolve();
        return;
      }

      reject(new Error(`Process exited with code ${exitCode}`));
    });
  });
});

test("exit when SIGIL_DEV is set", async () => {
  const output = await run("exit-normally", {
    env: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      SIGIL_DEV: "true",
    },
  });
  // Warning output depends on whether a local React DevTools server is running.
  expect(output).toContain("exited");
});

test("exit on exit() with error and static output", async () => {
  const output = await run("exit-with-static");
  // Error is propagated, not swallowed
  expect(output).toContain("errored");
  // Static items rendered
  expect(output).toContain("A");
  expect(output).toContain("B");
  expect(output).toContain("C");
  // Static items NOT duplicated (the bug from #397)
  const cleaned = stripAnsi(output);
  expect(cleaned.split("A").length - 1).toBe(1);
});
