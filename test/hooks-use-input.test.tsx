import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

import { onTestFinished, expect, test, vi } from "vite-plus/test";

import { Text, render, useInput } from "#/index.ts";

import { act } from "./helpers/act.ts";
import { createStdin, emitReadable } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";
import term from "./helpers/term.ts";

// ConPTY drops a NUL byte written to its input.
test.skipIf(process.platform === "win32")("useInput - handle legacy Ctrl+Space", async () => {
  const ps = term("use-input", ["ctrlSpace"]);
  ps.write("\u0000");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle Ctrl+punctuation shortcut", async () => {
  const ps = term("use-input", ["ctrlPunctuation"]);
  ps.write("\u001F");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - discrete priority keeps states in sync with useTransition during rapid input", async () => {
  const ps = term("use-input-discrete-priority");
  // Simulate rapid delete key repeat at ~30ms intervals.
  // State starts pre-populated with "abcde". Send 5 rapid deletes
  // to clear it, then wait for transitions to settle and check state.
  const pressDeleteKey = () => {
    ps.write("\u001B[3~");
  };

  // Use escape sequence for delete key (raw \x7F gets processed by pty)
  for (const delayMilliseconds of [0, 30, 60, 90, 120]) {
    setTimeout(() => {
      pressDeleteKey();
    }, delayMilliseconds);
  }

  await delay(200);

  // Wait for all transitions to settle, then press Enter to report state
  await delay(2000);
  ps.write("\r");
  await ps.waitForExit();
  const finalMatch = /FINAL .+/.exec(ps.output);
  console.log("Output:", finalMatch?.[0] ?? ps.output.slice(-300));
  expect(ps.output).toContain('FINAL query:"" deferred:""');
});

test("useInput - handle lowercase character", async () => {
  const ps = term("use-input", ["lowercase"]);
  ps.write("q");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle uppercase character", async () => {
  const ps = term("use-input", ["uppercase"]);
  ps.write("Q");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - \\r should not count as an uppercase character", async () => {
  const ps = term("use-input", ["uppercase"]);
  ps.write("\r");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - pasted carriage return", async () => {
  const ps = term("use-input", ["pastedCarriageReturn"]);
  ps.write("\rtest");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - pasted tab", async () => {
  const ps = term("use-input", ["pastedTab"]);
  ps.write("\ttest");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - receives bracketed paste when no usePaste handler is active", async () => {
  const ps = term("use-input", ["bracketedPaste"]);
  ps.write("\u001B[200~hello\u001B[201~");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle escape", async () => {
  const ps = term("use-input", ["escape"]);
  ps.write("\u001B");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - escape does not set meta", async () => {
  const ps = term("use-input", ["escapeNoMeta"]);
  ps.write("\u001B");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle ctrl", async () => {
  const ps = term("use-input", ["ctrl"]);
  ps.write("\u0006");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle meta", async () => {
  const ps = term("use-input", ["meta"]);
  ps.write("\u001Bm");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle ctrl + meta + letter", async () => {
  const ps = term("use-input", ["ctrlMeta"]);
  ps.write("\u001B\u0002");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle meta + backspace (0x7F)", async () => {
  const ps = term("use-input", ["metaBackspace"]);
  ps.write("\u001B\u007F");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - holds a split CSI key across the Escape timeout", async () => {
  const ps = term("use-input", ["splitArrow"]);
  ps.write("\u001B[");
  await delay(100);
  ps.write("A");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - flushes ESC[ prefix as literal input", async () => {
  const ps = term("use-input", ["escapeBracketPrefix"]);
  ps.write("\u001B[");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle meta + O with pending flush", async () => {
  const ps = term("use-input", ["metaUpperO"]);
  ps.write("\u001BO");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle tab", async () => {
  const ps = term("use-input", ["tab"]);
  ps.write("\t");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle meta + tab", async () => {
  const ps = term("use-input", ["metaTab"]);
  ps.write("\u001B\t");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle shift + tab", async () => {
  const ps = term("use-input", ["shiftTab"]);
  ps.write("\u001B[Z");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle backspace", async () => {
  const ps = term("use-input", ["backspace"]);
  ps.write("\u0008");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle delete", async () => {
  const ps = term("use-input", ["delete"]);
  ps.write("\u001B[3~");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle remove (delete)", async () => {
  const ps = term("use-input", ["remove"]);
  ps.write("\u001B[3~");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle option + return (macOS)", async () => {
  const ps = term("use-input", ["returnMeta"]);
  ps.write("\u001B\r");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle Ctrl+F1 without crashing", async () => {
  const ps = term("use-input", ["ctrlF1"]);
  ps.write("\u001B[1;5P");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle unmapped ctrl escape sequence without crashing", async () => {
  const ps = term("use-input", ["unmappedCtrlSequence"]);
  // ESC [ 1 ; 5 I — focus-in with ctrl modifier, not in keyName map
  ps.write("\u001B[1;5Iq");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

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
