import { onTestFinished, expect, test } from "vite-plus/test";

import { render, useInput } from "#/index.ts";

import { act } from "./helpers/act.ts";
import { createStdin, emitReadable } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

for (const [name, sequence] of [
  ["normal Return", "\r"],
  ["application keypad Enter", "\u001BOM"],
] as const) {
  test(`${name} submits through useInput`, async () => {
    const stdin = createStdin();
    const events: Array<{ input: string; isReturn: boolean }> = [];
    function Example() {
      useInput((input, key) => {
        events.push({ input, isReturn: key.return });
      });
      return null;
    }

    let instance!: ReturnType<typeof render>;
    await act(async () => {
      instance = render(<Example />, {
        stdin,
        stdout: createStdout(),
        patchConsole: false,
      });
    });
    onTestFinished(() => {
      instance.unmount();
    });
    await act(async () => {
      emitReadable(stdin, sequence);
    });

    expect(events.map((event) => event.isReturn)).toEqual([true]);
    // Both keys deliver a carriage return as the input value.
    expect(events.map((event) => event.input)).toEqual(["\r"]);
  });
}
