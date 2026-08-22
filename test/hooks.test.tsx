import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

import { expect, test } from "vite-plus/test";

import stripAnsi from "../src/ansi/strip.ts";
import term from "./helpers/term.ts";

const fixturesDir = path.join(import.meta.dirname, "fixtures");

test("useInput - ignore input if not active", async () => {
  const ps = term("use-input-multiple");
  ps.write("x");
  await ps.waitForExit();
  expect(ps.output.includes("xx")).toBe(false);
  expect(ps.output.includes("x")).toBe(true);
  expect(ps.output.includes("exited")).toBe(true);
});

// For some reason this test is flaky, so we retry it a couple of times
test("useInput - handle Ctrl+C when `exitOnCtrlC` is `false`", { retry: 2 }, async () => {
  const ps = term("use-input-ctrl-c");
  ps.write("\u0003");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - no MaxListenersExceededWarning with many useInput hooks", async () => {
  const ps = term("use-input-many");
  await ps.waitForExit();
  expect(ps.output.includes("MaxListenersExceededWarning")).toBe(false);
  expect(ps.output.includes("exited")).toBe(true);
});

test(
  "useInput - handle Ctrl+C via kitty codepoint-3 form when `exitOnCtrlC` is `false`",
  { retry: 2 },
  async () => {
    const ps = term("use-input-ctrl-c");
    // Ctrl+C via kitty codepoint 3 form (modifier 5 = ctrl(4) + 1)
    ps.write("\u001B[3;5u");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
  },
);

test("useStdout - write to stdout", async () => {
  const ps = term("use-stdout");
  await ps.waitForExit();

  const lines = stripAnsi(ps.output).split("\r\n");

  expect(lines.slice(1, -1)).toEqual(["Hello from Ink to stdout", "Hello World", "exited"]);
});

// A pty merges stderr into its single output stream, so this one runs the
// fixture through child_process.spawn with piped stdio instead. That forgoes
// the TTY, which is fine here: the fixture never uses useInput, so raw mode is
// never requested, and a non-TTY stdout still renders the final frame.
test("useStderr - write to stderr", async () => {
  const child = spawn("node", ["--import=tsx", path.join(fixturesDir, "use-stderr.tsx")], {
    // tsx resolves its tsconfig (and so the JSX transform) from the cwd.
    cwd: fixturesDir,
    env: {
      ...process.env,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      NODE_NO_WARNINGS: "1",
    },
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    child.on("close", resolve);
  });

  expect(exitCode).toBe(0);
  expect(stderr.includes("Hello from Ink to stderr")).toBe(true);
  expect(stdout.includes("Hello World")).toBe(true);
  expect(stdout.includes("exited")).toBe(true);
  expect(
    stdout.includes("Hello from Ink to stderr"),
    "hook writes must go to stderr, not the render stream",
  ).toBe(false);
});
