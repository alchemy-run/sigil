import { Readable } from "node:stream";

import { onTestFinished, expect, test } from "vite-plus/test";

import { render, useInput, usePaste } from "#/index.ts";

import { act } from "./helpers/act.ts";
import createStdout from "./helpers/create-stdout.ts";

const createReadableStdin = () =>
  Object.assign(new Readable({ read() {} }), {
    isTTY: true,
    setRawMode() {},
  });

const nextTick = async () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

for (const input of ["\u0003", "ab\u0003", "\u0003ab"]) {
  test(`Ctrl+C exits when buffered with text: ${JSON.stringify(input)}`, async () => {
    const stdin = createReadableStdin();
    const inputs: string[] = [];
    function Example() {
      useInput((value, key) => {
        inputs.push(key.ctrl ? `Ctrl+${value}` : value);
      });
      return null;
    }

    let instance!: ReturnType<typeof render>;
    await act(async () => {
      instance = render(<Example />, {
        stdin,
        stdout: createStdout(),
        interactive: true,
        patchConsole: false,
        exitOnCtrlC: true,
      });
    });
    onTestFinished(() => {
      instance.unmount();
      stdin.destroy();
    });

    let isExited = false;
    void instance.waitUntilExit().then(() => {
      isExited = true;
    });
    await act(async () => {
      stdin.push(input);
      await nextTick();
    });
    expect(isExited).toBe(true);
    expect(inputs).not.toContain("Ctrl+c");
  });
}

for (const isBracketedPaste of [false, true]) {
  test(`buffered Ctrl+C respects ${isBracketedPaste ? "bracketed paste" : "exitOnCtrlC: false"}`, async () => {
    const stdin = createReadableStdin();
    const inputs: string[] = [];
    const pastes: string[] = [];
    function Example() {
      useInput((value, key) => {
        inputs.push(key.ctrl ? `Ctrl+${value}` : value);
      });
      usePaste((value) => {
        pastes.push(value);
      });
      return null;
    }

    let instance!: ReturnType<typeof render>;
    await act(async () => {
      instance = render(<Example />, {
        stdin,
        stdout: createStdout(),
        interactive: true,
        patchConsole: false,
        exitOnCtrlC: isBracketedPaste,
      });
    });
    onTestFinished(() => {
      instance.unmount();
      stdin.destroy();
    });

    let isExited = false;
    void instance.waitUntilExit().then(() => {
      isExited = true;
    });
    const input = "ab\u0003cd";
    await act(async () => {
      stdin.push(isBracketedPaste ? `\u001B[200~${input}\u001B[201~` : input);
      await nextTick();
    });

    expect(isExited).toBe(false);
    expect(inputs).toEqual(isBracketedPaste ? [] : ["ab", "Ctrl+c", "cd"]);
    expect(pastes).toEqual(isBracketedPaste ? [input] : []);
  });
}
