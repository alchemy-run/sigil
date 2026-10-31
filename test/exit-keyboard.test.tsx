import { onTestFinished, expect, test } from "vite-plus/test";

import { render, useInput } from "#/index.ts";

import { act } from "./helpers/act.ts";
import { createStdin, emitReadable } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

for (const { name, input, exitOnCtrlC, shouldExit } of [
  { name: "legacy Ctrl+C", input: "\u0003", exitOnCtrlC: true, shouldExit: true },
  { name: "kitty Ctrl+C", input: "\u001B[99;5u", exitOnCtrlC: true, shouldExit: true },
  { name: "kitty Ctrl+C repeat", input: "\u001B[99;5:2u", exitOnCtrlC: true, shouldExit: true },
  { name: "kitty Ctrl+C release", input: "\u001B[99;5:3u", exitOnCtrlC: true, shouldExit: false },
  {
    name: "kitty Ctrl+C with automatic exit disabled",
    input: "\u001B[99;5u",
    exitOnCtrlC: false,
    shouldExit: false,
  },
  { name: "kitty c without Ctrl", input: "\u001B[99u", exitOnCtrlC: true, shouldExit: false },
]) {
  test(`automatic exit handles ${name}`, async () => {
    let wasInputReceived = false;
    function Input() {
      useInput(() => {
        wasInputReceived = true;
      });
      return null;
    }

    const stdin = createStdin();
    const stdout = createStdout();
    let instance!: ReturnType<typeof render>;
    await act(async () => {
      instance = render(<Input />, { stdin, stdout, exitOnCtrlC, concurrent: true });
    });

    let isExited = false;
    const exitPromise = instance.waitUntilExit().then(() => {
      isExited = true;
    });
    onTestFinished(async () => {
      instance.unmount();
      await exitPromise;
    });

    await act(async () => {
      emitReadable(stdin, input);
    });

    expect(isExited).toBe(shouldExit);
    expect(wasInputReceived).toBe(!shouldExit);
  });
}
