import { expect, test } from "vite-plus/test";

import stripAnsi from "../src/ansi/strip.ts";
import term from "./helpers/term.ts";

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

// `node-pty` doesn't support streaming stderr output, so I need to figure out
// how to test useStderr() hook. child_process.spawn() can't be used, because
// Ink fails with "raw mode unsupported" error.
test.todo("useStderr - write to stderr");
