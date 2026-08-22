import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { text as consumeText } from "node:stream/consumers";

import { expect, test } from "vite-plus/test";

import { stripAnsi } from "#/ansi/strip.ts";

import term from "./helpers/term.ts";

const fixturesDir = path.join(import.meta.dirname, "fixtures");

test("useInput - ignore input if not active", async () => {
  const ps = term("use-input-multiple");
  ps.write("x");
  await ps.waitForExit();
  expect(ps.output).not.toContain("xx");
  expect(ps.output).toContain("x");
  expect(ps.output).toContain("exited");
});

// For some reason this test is flaky, so we retry it a couple of times
test("useInput - handle Ctrl+C when `exitOnCtrlC` is `false`", { retry: 2 }, async () => {
  const ps = term("use-input-ctrl-c");
  ps.write("\u0003");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - no MaxListenersExceededWarning with many useInput hooks", async () => {
  const ps = term("use-input-many");
  await ps.waitForExit();
  expect(ps.output).not.toContain("MaxListenersExceededWarning");
  expect(ps.output).toContain("exited");
});

test(
  "useInput - handle Ctrl+C via kitty codepoint-3 form when `exitOnCtrlC` is `false`",
  { retry: 2 },
  async () => {
    const ps = term("use-input-ctrl-c");
    // Ctrl+C via kitty codepoint 3 form (modifier 5 = ctrl(4) + 1)
    ps.write("\u001B[3;5u");
    await ps.waitForExit();
    expect(ps.output).toContain("exited");
  },
);

test("useStdout - write to stdout", async () => {
  const ps = term("use-stdout");
  await ps.waitForExit();

  const lines = stripAnsi(ps.output).split("\r\n");

  expect(lines.slice(1, -1)).toEqual(["Hello from Ink to stdout", "Hello World", "exited"]);
});

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

  const [stdout, stderr, [exitCode]] = await Promise.all([
    consumeText(child.stdout),
    consumeText(child.stderr),
    once(child, "close") as Promise<[number | null]>,
  ]);

  expect(exitCode).toBe(0);
  expect(stderr).toContain("Hello from Ink to stderr");
  expect(stdout).toContain("Hello World");
  expect(stdout).toContain("exited");
  expect(stdout, "hook writes must go to stderr, not the render stream").not.toContain(
    "Hello from Ink to stderr",
  );
});
