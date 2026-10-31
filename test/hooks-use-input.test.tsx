import { Buffer } from "node:buffer";
import { Readable } from "node:stream";

import { onTestFinished, expect, test, vi } from "vite-plus/test";

import { Text, render, useInput } from "#/index.ts";

import { act } from "./helpers/act.ts";
import { createStdin, emitReadable } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

const createReadableStdin = () =>
  Object.assign(new Readable({ read() {} }), {
    isTTY: true,
    setRawMode() {},
  });

const pushChunks = async (stdin: Readable, chunks: readonly Buffer[]) => {
  for (const chunk of chunks) {
    // oxlint-disable-next-line no-await-in-loop
    await act(async () => {
      stdin.push(chunk);
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
    });
  }
};

for (const [name, sequence] of [
  ["focus in", "\u001B[I"],
  ["focus out", "\u001B[O"],
  ["cursor position report", "\u001B[24;80R"],
  ["SGR mouse report", "\u001B[<0;10;20M"],
  ["legacy mouse report", '\u001B[M !"'],
  ["primary device attributes", "\u001B[?62;1;4c"],
  ["stray bracketed paste end", "\u001B[201~"],
  ["unmapped legacy CSI", "\u001B[[Z"],
  ["unmapped modified SS3", "\u001BO1;5Z"],
] as const) {
  test(`useInput - drops unmapped control sequence: ${name}`, async () => {
    const stdin = createStdin();
    const events: Array<{ input: string; escape: boolean }> = [];
    function Example() {
      useInput((input, key) => {
        events.push({ input, escape: key.escape });
      });
      return null;
    }

    let instance!: ReturnType<typeof render>;
    await act(async () => {
      instance = render(<Example />, { stdin, stdout: createStdout(), patchConsole: false });
    });
    onTestFinished(() => {
      instance.unmount();
    });
    await act(async () => {
      emitReadable(stdin, sequence);
    });
    await act(async () => {
      emitReadable(stdin, "q");
    });

    expect(events).toEqual([{ input: "q", escape: false }]);
  });
}

test("useInput - meta + escape delivers empty input like plain escape", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const stdin = createStdin();
  const events: Array<{ input: string; escape: boolean; meta: boolean }> = [];
  function Example() {
    useInput((input, key) => {
      events.push({ input, escape: key.escape, meta: key.meta });
    });
    return null;
  }

  let instance!: ReturnType<typeof render>;
  await act(async () => {
    instance = render(<Example />, { stdin, stdout: createStdout(), patchConsole: false });
  });
  onTestFinished(() => {
    instance.unmount();
    vi.useRealTimers();
  });
  for (const sequence of ["\u001B", "\u001B\u001B"]) {
    // oxlint-disable-next-line no-await-in-loop
    await act(async () => {
      emitReadable(stdin, sequence);
      // Fire the pending escape flush timer so it delivers the lone escape key.
      await vi.advanceTimersByTimeAsync(20);
    });
  }

  expect(events).toEqual([
    { input: "", escape: true, meta: false },
    { input: "", escape: true, meta: true },
  ]);
});

test("useInput - drops legacy mouse report read from a byte stream", async () => {
  const stdin = createReadableStdin();
  const inputs: string[] = [];
  function Example() {
    useInput((input) => {
      inputs.push(input);
    });
    return null;
  }

  let instance!: ReturnType<typeof render>;
  await act(async () => {
    instance = render(<Example />, { stdin, stdout: createStdout(), patchConsole: false });
  });
  onTestFinished(() => {
    instance.unmount();
    stdin.destroy();
  });

  // Button press at column 1, row 2, decoded by sigil's own `setEncoding('utf8')`.
  await pushChunks(stdin, [Buffer.from([0x1b, 0x5b, 0x4d, 0x20, 0x21, 0x22]), Buffer.from("q")]);

  expect(inputs).toEqual(["q"]);
});

test("useInput - receives Ctrl+C after a bare legacy mouse prefix", async () => {
  const stdin = createReadableStdin();
  const keys: string[] = [];
  function Example() {
    useInput((input, key) => {
      keys.push(key.ctrl ? `Ctrl+${input}` : input);
    });
    return null;
  }

  let instance!: ReturnType<typeof render>;
  await act(async () => {
    instance = render(<Example />, {
      stdin,
      stdout: createStdout(),
      patchConsole: false,
      exitOnCtrlC: false,
    });
  });
  onTestFinished(() => {
    instance.unmount();
    stdin.destroy();
  });

  // A control byte can't be a coordinate, so `ESC[M` ends there and Ctrl+C still arrives.
  await pushChunks(stdin, [Buffer.from([0x1b, 0x5b, 0x4d]), Buffer.from([0x03])]);

  expect(keys).toEqual(["Ctrl+c"]);
});

test("useInput - a bare ESC[ times out instead of swallowing the next key", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });

  const stdin = createStdin();
  const stdout = createStdout();
  const inputs: string[] = [];
  function Example() {
    useInput((input) => {
      inputs.push(input);
    });
    return <Text>x</Text>;
  }

  const app = render(<Example />, { stdin, stdout, interactive: true });
  onTestFinished(() => {
    app.unmount();
  });

  // Alt+[ sends ESC[; it must not wait for a terminator and eat the next key.
  emitReadable(stdin, "\u001B[");
  await vi.advanceTimersByTimeAsync(20);
  expect(inputs, "the Escape timeout alone leaves a CSI introducer pending").toEqual([]);
  await vi.advanceTimersByTimeAsync(100);
  emitReadable(stdin, "a");
  expect(inputs).toEqual(["[", "a"]);
});
