import process from "node:process";

import { afterAll, expect, test, vi } from "vite-plus/test";

import { render, Text } from "../src/index.ts";
import parseKeypress from "../src/parse-keypress.ts";
import { createStdin } from "./helpers/create-stdin.ts";
import createStdout, { type FakeStdout } from "./helpers/create-stdout.ts";

const textEncoder = new TextEncoder();

// Helper to create kitty protocol CSI u sequences
const kittyKey = (
  codepoint: number,
  modifiers?: number,
  eventType?: number,
  textCodepoints?: number[],
): string => {
  let seq = `\u001B[${codepoint}`;
  if (modifiers !== undefined || eventType !== undefined || textCodepoints !== undefined) {
    seq += `;${modifiers ?? 1}`;
  }

  if (eventType !== undefined || textCodepoints !== undefined) {
    seq += `:${eventType ?? 1}`;
  }

  if (textCodepoints !== undefined) {
    seq += `;${textCodepoints.join(":")}`;
  }

  seq += "u";
  return seq;
};

test("kitty protocol - simple character", () => {
  // 'a' key
  const result = parseKeypress(kittyKey(97));
  expect(result.name).toBe("a");
  expect(result.ctrl).toBe(false);
  expect(result.shift).toBe(false);
  expect(result.meta).toBe(false);
  expect(result.eventType).toBe("press");
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - uppercase character (shift)", () => {
  // 'A' with shift (modifier 2 = shift + 1)
  const result = parseKeypress(kittyKey(65, 2));
  expect(result.name).toBe("a");
  expect(result.shift).toBe(true);
  expect(result.ctrl).toBe(false);
  expect(result.eventType).toBe("press");
});

test("kitty protocol - ctrl modifier", () => {
  // 'a' with ctrl (modifier 5 = ctrl(4) + 1)
  const result = parseKeypress(kittyKey(97, 5));
  expect(result.name).toBe("a");
  expect(result.ctrl).toBe(true);
  expect(result.shift).toBe(false);
  expect(result.eventType).toBe("press");
});

test("kitty protocol - alt/option modifier", () => {
  // 'a' with alt (modifier 3 = alt(2) + 1)
  const result = parseKeypress(kittyKey(97, 3));
  expect(result.name).toBe("a");
  expect(result.meta).toBe(true);
  expect(result.ctrl).toBe(false);
  expect(result.eventType).toBe("press");
});

test("kitty protocol - super modifier", () => {
  // 'a' with super (modifier 9 = super(8) + 1)
  const result = parseKeypress(kittyKey(97, 9));
  expect(result.name).toBe("a");
  expect(result.super).toBe(true);
  expect(result.ctrl).toBe(false);
  expect(result.eventType).toBe("press");
});

test("kitty protocol - hyper modifier", () => {
  // 'a' with hyper (modifier 17 = hyper(16) + 1)
  const result = parseKeypress(kittyKey(97, 17));
  expect(result.name).toBe("a");
  expect(result.hyper).toBe(true);
  expect(result.super).toBe(false);
  expect(result.eventType).toBe("press");
});

test("kitty protocol - meta modifier", () => {
  // 'a' with meta (modifier 33 = meta(32) + 1)
  const result = parseKeypress(kittyKey(97, 33));
  expect(result.name).toBe("a");
  expect(result.meta).toBe(true);
  expect(result.eventType).toBe("press");
});

test("kitty protocol - caps lock", () => {
  // 'a' with capsLock (modifier 65 = capsLock(64) + 1)
  const result = parseKeypress(kittyKey(97, 65));
  expect(result.name).toBe("a");
  expect(result.capsLock).toBe(true);
  expect(result.eventType).toBe("press");
});

test("kitty protocol - num lock", () => {
  // 'a' with numLock (modifier 129 = numLock(128) + 1)
  const result = parseKeypress(kittyKey(97, 129));
  expect(result.name).toBe("a");
  expect(result.numLock).toBe(true);
  expect(result.eventType).toBe("press");
});

test("kitty protocol - combined modifiers (ctrl+shift)", () => {
  // 'a' with ctrl+shift (modifier 6 = ctrl(4) + shift(1) + 1)
  const result = parseKeypress(kittyKey(97, 6));
  expect(result.name).toBe("a");
  expect(result.ctrl).toBe(true);
  expect(result.shift).toBe(true);
  expect(result.meta).toBe(false);
  expect(result.eventType).toBe("press");
});

test("kitty protocol - combined modifiers (super+ctrl)", () => {
  // 's' with super+ctrl (modifier 13 = super(8) + ctrl(4) + 1)
  const result = parseKeypress(kittyKey(115, 13));
  expect(result.name).toBe("s");
  expect(result.super).toBe(true);
  expect(result.ctrl).toBe(true);
  expect(result.shift).toBe(false);
  expect(result.eventType).toBe("press");
});

test("kitty protocol - escape key", () => {
  // Escape key
  const result = parseKeypress(kittyKey(27));
  expect(result.name).toBe("escape");
  expect(result.eventType).toBe("press");
});

test("kitty protocol - return/enter key", () => {
  // Return/enter key
  const result = parseKeypress(kittyKey(13));
  expect(result.name).toBe("return");
  expect(result.eventType).toBe("press");
});

test("kitty protocol - tab key", () => {
  // Tab key
  const result = parseKeypress(kittyKey(9));
  expect(result.name).toBe("tab");
  expect(result.eventType).toBe("press");
});

test("kitty protocol - backspace key", () => {
  // Backspace key
  const result = parseKeypress(kittyKey(8));
  expect(result.name).toBe("backspace");
  expect(result.eventType).toBe("press");
});

test("kitty protocol - backspace key (codepoint 127)", () => {
  // Backspace key (0x7F)
  const result = parseKeypress(kittyKey(127));
  expect(result.name).toBe("backspace");
  expect(result.eventType).toBe("press");
});

test("legacy parser - meta + backspace (0x7F)", () => {
  const result = parseKeypress("\u001B\u007F");
  expect(result.name).toBe("backspace");
  expect(result.meta).toBe(true);
});

test("kitty protocol - space key", () => {
  // Space key
  const result = parseKeypress(kittyKey(32));
  expect(result.name).toBe("space");
  expect(result.eventType).toBe("press");
});

test("kitty protocol - event type press", () => {
  // 'a' press event
  const result = parseKeypress(kittyKey(97, 1, 1));
  expect(result.name).toBe("a");
  expect(result.eventType).toBe("press");
});

test("kitty protocol - event type repeat", () => {
  // 'a' repeat event
  const result = parseKeypress(kittyKey(97, 1, 2));
  expect(result.name).toBe("a");
  expect(result.eventType).toBe("repeat");
});

test("kitty protocol - event type release", () => {
  // 'a' release event
  const result = parseKeypress(kittyKey(97, 1, 3));
  expect(result.name).toBe("a");
  expect(result.eventType).toBe("release");
});

test("kitty protocol - number keys", () => {
  // '1' key
  const result = parseKeypress(kittyKey(49));
  expect(result.name).toBe("1");
  expect(result.eventType).toBe("press");
});

test("kitty protocol - special character", () => {
  // '@' key
  const result = parseKeypress(kittyKey(64));
  expect(result.name).toBe("@");
  expect(result.eventType).toBe("press");
});

test("kitty protocol - ctrl+letter produces codepoint 1-26", () => {
  // When using ctrl+a, kitty sends codepoint 1 (not 97)
  // Ctrl+a (codepoint 1, modifier 5 = ctrl + 1)
  const result = parseKeypress(kittyKey(1, 5));
  expect(result.name).toBe("a");
  expect(result.ctrl).toBe(true);
});

test("kitty protocol - preserves sequence and raw", () => {
  const seq = kittyKey(97, 5);
  const result = parseKeypress(seq);
  expect(result.sequence).toBe(seq);
  expect(result.raw).toBe(seq);
});

test("kitty protocol - text-as-codepoints field", () => {
  // 'a' key with text-as-codepoints containing 'A' (shifted)
  const result = parseKeypress(kittyKey(97, 2, 1, [65]));
  expect(result.name).toBe("a");
  expect(result.text).toBe("A");
  expect(result.shift).toBe(true);
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - text-as-codepoints with multiple codepoints", () => {
  // Key with text containing multiple codepoints (e.g., composed character)
  const result = parseKeypress(kittyKey(97, 1, 1, [72, 101]));
  expect(result.text).toBe("He");
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - supplementary unicode codepoint", () => {
  // Emoji: 😀 (U+1F600 = 128512)
  const result = parseKeypress(kittyKey(128_512));
  expect(result.name).toBe("😀");
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - text-as-codepoints with supplementary unicode", () => {
  // Text field with emoji codepoint
  const result = parseKeypress(kittyKey(97, 1, 1, [128_512]));
  expect(result.text).toBe("😀");
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - text defaults to character from codepoint", () => {
  const result = parseKeypress(kittyKey(97));
  expect(result.text).toBe("a");
  expect(result.isKittyProtocol).toBe(true);
});

// --- Kitty-enhanced special key tests ---

test("kitty protocol - arrow keys with event type", () => {
  // Up arrow press: CSI 1;1:1 A
  const up = parseKeypress("\u001B[1;1:1A");
  expect(up.name).toBe("up");
  expect(up.eventType).toBe("press");
  expect(up.isKittyProtocol).toBe(true);

  // Down arrow release: CSI 1;1:3 B
  const down = parseKeypress("\u001B[1;1:3B");
  expect(down.name).toBe("down");
  expect(down.eventType).toBe("release");
  expect(down.isKittyProtocol).toBe(true);

  // Right arrow repeat: CSI 1;1:2 C
  const right = parseKeypress("\u001B[1;1:2C");
  expect(right.name).toBe("right");
  expect(right.eventType).toBe("repeat");
  expect(right.isKittyProtocol).toBe(true);

  // Left arrow: CSI 1;1:1 D
  const left = parseKeypress("\u001B[1;1:1D");
  expect(left.name).toBe("left");
  expect(left.eventType).toBe("press");
  expect(left.isKittyProtocol).toBe(true);
});

test("kitty protocol - arrow keys with modifiers", () => {
  // Ctrl+up: CSI 1;5:1 A (modifiers=5 means ctrl(4)+1)
  const result = parseKeypress("\u001B[1;5:1A");
  expect(result.name).toBe("up");
  expect(result.ctrl).toBe(true);
  expect(result.eventType).toBe("press");
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - home and end keys", () => {
  const home = parseKeypress("\u001B[1;1:1H");
  expect(home.name).toBe("home");
  expect(home.eventType).toBe("press");
  expect(home.isKittyProtocol).toBe(true);

  const end = parseKeypress("\u001B[1;1:1F");
  expect(end.name).toBe("end");
  expect(end.eventType).toBe("press");
  expect(end.isKittyProtocol).toBe(true);
});

test("kitty protocol - tilde-terminated special keys", () => {
  // Delete: CSI 3;1:1 ~
  const del = parseKeypress("\u001B[3;1:1~");
  expect(del.name).toBe("delete");
  expect(del.eventType).toBe("press");
  expect(del.isKittyProtocol).toBe(true);

  // Insert: CSI 2;1:1 ~
  const ins = parseKeypress("\u001B[2;1:1~");
  expect(ins.name).toBe("insert");
  expect(ins.isKittyProtocol).toBe(true);

  // Page up: CSI 5;1:1 ~
  const pgup = parseKeypress("\u001B[5;1:1~");
  expect(pgup.name).toBe("pageup");
  expect(pgup.isKittyProtocol).toBe(true);

  // F5: CSI 15;1:1 ~
  const f5 = parseKeypress("\u001B[15;1:1~");
  expect(f5.name).toBe("f5");
  expect(f5.isKittyProtocol).toBe(true);
});

test("kitty protocol - tilde keys with modifiers", () => {
  // Shift+Delete: CSI 3;2:1 ~ (modifiers=2 means shift(1)+1)
  const result = parseKeypress("\u001B[3;2:1~");
  expect(result.name).toBe("delete");
  expect(result.shift).toBe(true);
  expect(result.eventType).toBe("press");
  expect(result.isKittyProtocol).toBe(true);
});

// --- Malformed input handling ---

test("kitty protocol - invalid codepoint above U+10FFFF returns safe empty keypress", () => {
  // Codepoint 1114112 = 0x110000, one above max Unicode
  const result = parseKeypress("\u001B[1114112u");
  expect(result.name).toBe("");
  expect(result.ctrl).toBe(false);
  expect(result.isKittyProtocol).toBe(true);
  expect(result.isPrintable).toBe(false);
});

test("kitty protocol - surrogate codepoint returns safe empty keypress", () => {
  // Codepoint 0xD800 is a surrogate
  const result = parseKeypress("\u001B[55296u");
  expect(result.name).toBe("");
  expect(result.ctrl).toBe(false);
  expect(result.isKittyProtocol).toBe(true);
  expect(result.isPrintable).toBe(false);
});

test("kitty protocol - invalid text codepoint replaced with fallback", () => {
  // Valid primary codepoint, but text field has an invalid codepoint
  const result = parseKeypress(kittyKey(97, 1, 1, [1_114_112]));
  expect(result.name).toBe("a");
  expect(result.text).toBe("?");
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - malformed modifier 0 does not set all flags", () => {
  // Malformed sequence with modifier 0 (should clamp to 0, not become -1)
  const result = parseKeypress("\u001B[97;0u");
  expect(result.name).toBe("a");
  expect(result.ctrl).toBe(false);
  expect(result.shift).toBe(false);
  expect(result.meta).toBe(false);
  expect(result.super ?? false).toBe(false);
  expect(result.isKittyProtocol).toBe(true);
});

// --- Legacy fallback ---

test("non-kitty sequences fall back to legacy parsing", () => {
  // Regular escape sequence (not kitty protocol)
  // Up arrow key
  const result = parseKeypress("\u001B[A");
  expect(result.name).toBe("up");
  expect(result.isKittyProtocol).toBe(undefined);
});

test("non-kitty sequences - ctrl+c", () => {
  // Ctrl+c
  const result = parseKeypress("\u0003");
  expect(result.name).toBe("c");
  expect(result.ctrl).toBe(true);
  expect(result.isKittyProtocol).toBe(undefined);
});

// --- isPrintable field tests ---

test("kitty protocol - isPrintable is true for regular characters", () => {
  // 'a' key
  const result = parseKeypress(kittyKey(97));
  expect(result.isPrintable).toBe(true);
});

test("kitty protocol - isPrintable is true for digits", () => {
  // '1' key
  const result = parseKeypress(kittyKey(49));
  expect(result.isPrintable).toBe(true);
});

test("kitty protocol - isPrintable is true for symbols", () => {
  // '@' key
  const result = parseKeypress(kittyKey(64));
  expect(result.isPrintable).toBe(true);
});

test("kitty protocol - isPrintable is true for emoji", () => {
  const result = parseKeypress(kittyKey(128_512));
  expect(result.isPrintable).toBe(true);
});

test("kitty protocol - isPrintable is false for escape", () => {
  const result = parseKeypress(kittyKey(27));
  expect(result.isPrintable).toBe(false);
});

test("kitty protocol - isPrintable is true for return", () => {
  const result = parseKeypress(kittyKey(13));
  expect(result.isPrintable).toBe(true);
});

test("kitty protocol - isPrintable is false for tab", () => {
  const result = parseKeypress(kittyKey(9));
  expect(result.isPrintable).toBe(false);
});

test("kitty protocol - isPrintable is true for space", () => {
  const result = parseKeypress(kittyKey(32));
  expect(result.isPrintable).toBe(true);
});

test("kitty protocol - isPrintable is false for backspace", () => {
  const result = parseKeypress(kittyKey(8));
  expect(result.isPrintable).toBe(false);
});

test("kitty protocol - isPrintable is false for ctrl+letter", () => {
  // Ctrl+a (codepoint 1)
  const result = parseKeypress(kittyKey(1, 5));
  expect(result.isPrintable).toBe(false);
});

test("kitty protocol - isPrintable is false for special keys (arrows)", () => {
  // Up arrow via kitty enhanced special key format
  const result = parseKeypress("\u001B[1;1:1A");
  expect(result.isPrintable).toBe(false);
});

// --- Non-printable key suppression tests (feedback #3 repros) ---

test("kitty protocol - capslock (57358) is non-printable", () => {
  // \x1b[57358u -> capslock should have isPrintable=false
  const result = parseKeypress("\u001B[57358u");
  expect(result.name).toBe("capslock");
  expect(result.isPrintable).toBe(false);
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - printscreen (57361) is non-printable", () => {
  // \x1b[57361u -> printscreen should have isPrintable=false
  const result = parseKeypress("\u001B[57361u");
  expect(result.name).toBe("printscreen");
  expect(result.isPrintable).toBe(false);
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - f13 (57376) is non-printable", () => {
  // \x1b[57376u -> f13 should have isPrintable=false
  const result = parseKeypress("\u001B[57376u");
  expect(result.name).toBe("f13");
  expect(result.isPrintable).toBe(false);
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - media key (57428 mediaplay) is non-printable", () => {
  const result = parseKeypress("\u001B[57428u");
  expect(result.name).toBe("mediaplay");
  expect(result.isPrintable).toBe(false);
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - modifier-only key (57441 leftshift) is non-printable", () => {
  const result = parseKeypress("\u001B[57441u");
  expect(result.name).toBe("leftshift");
  expect(result.isPrintable).toBe(false);
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - modifier-only key (57442 leftcontrol) is non-printable", () => {
  const result = parseKeypress("\u001B[57442u");
  expect(result.name).toBe("leftcontrol");
  expect(result.isPrintable).toBe(false);
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - kp keys (57399 kp0) are non-printable", () => {
  const result = parseKeypress("\u001B[57399u");
  expect(result.name).toBe("kp0");
  expect(result.isPrintable).toBe(false);
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - scrolllock (57359) is non-printable", () => {
  const result = parseKeypress("\u001B[57359u");
  expect(result.name).toBe("scrolllock");
  expect(result.isPrintable).toBe(false);
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - numlock (57360) is non-printable", () => {
  const result = parseKeypress("\u001B[57360u");
  expect(result.name).toBe("numlock");
  expect(result.isPrintable).toBe(false);
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - pause (57362) is non-printable", () => {
  const result = parseKeypress("\u001B[57362u");
  expect(result.name).toBe("pause");
  expect(result.isPrintable).toBe(false);
  expect(result.isKittyProtocol).toBe(true);
});

test("kitty protocol - volume keys are non-printable", () => {
  // Lower volume (57438)
  const lower = parseKeypress("\u001B[57438u");
  expect(lower.name).toBe("lowervolume");
  expect(lower.isPrintable).toBe(false);

  // Raise volume (57439)
  const raise = parseKeypress("\u001B[57439u");
  expect(raise.name).toBe("raisevolume");
  expect(raise.isPrintable).toBe(false);

  // Mute volume (57440)
  const mute = parseKeypress("\u001B[57440u");
  expect(mute.name).toBe("mutevolume");
  expect(mute.isPrintable).toBe(false);
});

// --- Init/cleanup control sequence tests ---

const createFakeStdout = () => {
  const stdout = createStdout();
  return { stdout, write: stdout.write };
};

const createFakeStdin = createStdin;

const getWrittenStrings = (write: FakeStdout["write"]): string[] =>
  write.mock.calls.map(([chunk]) => chunk);

test("kitty protocol - writes enable sequence on init when mode is enabled", () => {
  const { stdout, write } = createFakeStdout();
  const stdin = createFakeStdin();

  const { unmount } = render(<Text>Hello</Text>, {
    stdout,
    stdin,
    kittyKeyboard: { mode: "enabled" },
  });

  // CSI > 1 u (push keyboard mode with disambiguateEscapeCodes flag)
  expect(getWrittenStrings(write).includes("\u001B[>1u")).toBe(true);

  unmount();
});

test("kitty protocol - writes disable sequence on unmount", () => {
  const { stdout, write } = createFakeStdout();
  const stdin = createFakeStdin();

  const { unmount } = render(<Text>Hello</Text>, {
    stdout,
    stdin,
    kittyKeyboard: { mode: "enabled" },
  });

  unmount();

  // CSI < u (pop keyboard mode)
  expect(getWrittenStrings(write).includes("\u001B[<u")).toBe(true);
});

test("kitty protocol - not enabled when stdin is not a TTY", () => {
  const { stdout, write } = createFakeStdout();
  const stdin = createFakeStdin();
  stdin.isTTY = false;

  const { unmount } = render(<Text>Hello</Text>, {
    stdout,
    stdin,
    kittyKeyboard: { mode: "enabled" },
  });

  expect(getWrittenStrings(write).includes("\u001B[>1u")).toBe(false);

  unmount();
});

test("kitty protocol - not enabled when stdout is not a TTY", () => {
  const { stdout, write } = createFakeStdout();
  stdout.isTTY = false;
  const stdin = createFakeStdin();

  const { unmount } = render(<Text>Hello</Text>, {
    stdout,
    stdin,
    kittyKeyboard: { mode: "enabled" },
  });

  expect(getWrittenStrings(write).includes("\u001B[>1u")).toBe(false);

  unmount();
});

// --- Auto-detection race condition tests ---

test("kitty protocol - auto detection does not enable protocol after unmount", () => {
  const { stdout, write } = createFakeStdout();
  const stdin = createFakeStdin();

  const origKittyId = process.env["KITTY_WINDOW_ID"];
  process.env["KITTY_WINDOW_ID"] = "1";
  afterAll(() => {
    if (origKittyId === undefined) {
      delete process.env["KITTY_WINDOW_ID"];
    } else {
      process.env["KITTY_WINDOW_ID"] = origKittyId;
    }
  });

  const { unmount } = render(<Text>Hello</Text>, {
    stdout,
    stdin,
    kittyKeyboard: { mode: "auto" },
  });

  // Unmount before the terminal responds
  unmount();

  // Simulate a late terminal response arriving after unmount
  stdin.emit("data", "\u001B[?1u");

  // The enable sequence should NOT have been written after unmount
  const strings = getWrittenStrings(write);
  const enableCount = strings.filter((s) => s === "\u001B[>1u").length;
  expect(enableCount).toBe(0);
});

test("kitty protocol - auto detection handles synchronous query response", () => {
  const { stdout } = createFakeStdout();
  const stdin = createFakeStdin();
  const writtenStrings: string[] = [];

  // Override stdout.write to synchronously emit the response on stdin
  // when the query sequence is written, simulating a fast terminal
  stdout.write = vi.fn((data: string) => {
    writtenStrings.push(data);
    if (data === "\u001B[?u") {
      stdin.emit("data", "\u001B[?1u");
    }

    return true;
  });

  const origKittyId = process.env["KITTY_WINDOW_ID"];
  process.env["KITTY_WINDOW_ID"] = "1";
  afterAll(() => {
    if (origKittyId === undefined) {
      delete process.env["KITTY_WINDOW_ID"];
    } else {
      process.env["KITTY_WINDOW_ID"] = origKittyId;
    }
  });

  const { unmount } = render(<Text>Hello</Text>, {
    stdout,
    stdin,
    kittyKeyboard: { mode: "auto" },
  });

  // The enable sequence should have been written
  expect(writtenStrings.includes("\u001B[>1u")).toBe(true);

  unmount();
});

test("kitty protocol - auto detection handles Uint8Array query response", () => {
  const { stdout, write } = createFakeStdout();
  const stdin = createFakeStdin();

  const origKittyId = process.env["KITTY_WINDOW_ID"];
  process.env["KITTY_WINDOW_ID"] = "1";
  afterAll(() => {
    if (origKittyId === undefined) {
      delete process.env["KITTY_WINDOW_ID"];
    } else {
      process.env["KITTY_WINDOW_ID"] = origKittyId;
    }
  });

  const { unmount } = render(<Text>Hello</Text>, {
    stdout,
    stdin,
    kittyKeyboard: { mode: "auto" },
  });

  // Respond with Uint8Array instead of string
  const response = textEncoder.encode("\u001B[?1u");
  stdin.emit("data", response);

  // The enable sequence should have been written
  const strings = getWrittenStrings(write);
  expect(strings.includes("\u001B[>1u")).toBe(true);

  unmount();
});

test("kitty protocol - auto detection preserves split UTF-8 input bytes", async () => {
  const { stdout } = createFakeStdout();
  const stdin = createFakeStdin();
  const unshifted: Uint8Array[] = [];

  const concatUint8Arrays = (chunks: Uint8Array[]): number[] => {
    const merged: number[] = [];
    for (const chunk of chunks) {
      for (const byte of chunk) {
        merged.push(byte);
      }
    }

    return merged;
  };

  stdin.unshift = ((chunk: Uint8Array) => {
    unshifted.push(Uint8Array.from(chunk));
    return true;
  }) as typeof stdin.unshift;

  const origKittyId = process.env["KITTY_WINDOW_ID"];
  process.env["KITTY_WINDOW_ID"] = "1";
  afterAll(() => {
    if (origKittyId === undefined) {
      delete process.env["KITTY_WINDOW_ID"];
    } else {
      process.env["KITTY_WINDOW_ID"] = origKittyId;
    }
  });

  const { unmount } = render(<Text>Hello</Text>, {
    stdout,
    stdin,
    kittyKeyboard: { mode: "auto" },
  });

  // Emit one UTF-8 emoji split across chunks during detection.
  stdin.emit("data", new Uint8Array([0xf0, 0x9f]));
  stdin.emit("data", new Uint8Array([0x92, 0xa9]));

  await new Promise((resolve) => {
    setTimeout(resolve, 250);
  });

  expect(concatUint8Arrays(unshifted)).toEqual([0xf0, 0x9f, 0x92, 0xa9]);
  unmount();
});

test("kitty protocol - auto detection timeout does not leak partial query response", async () => {
  const { stdout } = createFakeStdout();
  const stdin = createFakeStdin();
  const unshifted: Uint8Array[] = [];

  stdin.unshift = ((chunk: Uint8Array) => {
    unshifted.push(Uint8Array.from(chunk));
    return true;
  }) as typeof stdin.unshift;

  const origKittyId = process.env["KITTY_WINDOW_ID"];
  process.env["KITTY_WINDOW_ID"] = "1";
  afterAll(() => {
    if (origKittyId === undefined) {
      delete process.env["KITTY_WINDOW_ID"];
    } else {
      process.env["KITTY_WINDOW_ID"] = origKittyId;
    }
  });

  const { unmount } = render(<Text>Hello</Text>, {
    stdout,
    stdin,
    kittyKeyboard: { mode: "auto" },
  });

  // Simulate partial terminal response that times out before completion.
  stdin.emit("data", "\u001B[?1");

  await new Promise((resolve) => {
    setTimeout(resolve, 250);
  });

  expect(unshifted.length).toBe(0);
  unmount();
});

test("kitty protocol - auto detection timeout preserves query prefix without digits", async () => {
  const { stdout, write } = createFakeStdout();
  const stdin = createFakeStdin();
  const unshifted: Uint8Array[] = [];

  stdin.unshift = ((chunk: Uint8Array) => {
    unshifted.push(Uint8Array.from(chunk));
    return true;
  }) as typeof stdin.unshift;

  const origKittyId = process.env["KITTY_WINDOW_ID"];
  process.env["KITTY_WINDOW_ID"] = "1";
  afterAll(() => {
    if (origKittyId === undefined) {
      delete process.env["KITTY_WINDOW_ID"];
    } else {
      process.env["KITTY_WINDOW_ID"] = origKittyId;
    }
  });

  const { unmount } = render(<Text>Hello</Text>, {
    stdout,
    stdin,
    kittyKeyboard: { mode: "auto" },
  });

  stdin.emit("data", "\u001B[?");

  await new Promise((resolve) => {
    setTimeout(resolve, 250);
  });

  const strings = getWrittenStrings(write);
  const enableCount = strings.filter((s) => s === "\u001B[>1u").length;
  expect(enableCount).toBe(0);
  expect(unshifted.map((chunk) => [...chunk])).toEqual([[0x1b, 0x5b, 0x3f]]);
  unmount();
});

test("kitty protocol - auto detection ignores query response without digits", async () => {
  const { stdout, write } = createFakeStdout();
  const stdin = createFakeStdin();
  const unshifted: Uint8Array[] = [];

  stdin.unshift = ((chunk: Uint8Array) => {
    unshifted.push(Uint8Array.from(chunk));
    return true;
  }) as typeof stdin.unshift;

  const origKittyId = process.env["KITTY_WINDOW_ID"];
  process.env["KITTY_WINDOW_ID"] = "1";
  afterAll(() => {
    if (origKittyId === undefined) {
      delete process.env["KITTY_WINDOW_ID"];
    } else {
      process.env["KITTY_WINDOW_ID"] = origKittyId;
    }
  });

  const { unmount } = render(<Text>Hello</Text>, {
    stdout,
    stdin,
    kittyKeyboard: { mode: "auto" },
  });

  stdin.emit("data", "\u001B[?u");

  await new Promise((resolve) => {
    setTimeout(resolve, 250);
  });

  const strings = getWrittenStrings(write);
  const enableCount = strings.filter((s) => s === "\u001B[>1u").length;
  expect(enableCount).toBe(0);
  expect(unshifted.map((chunk) => [...chunk])).toEqual([[0x1b, 0x5b, 0x3f, 0x75]]);
  unmount();
});

test("kitty protocol - auto detection preserves invalid query-like escape sequence", async () => {
  const { stdout, write } = createFakeStdout();
  const stdin = createFakeStdin();
  const unshifted: Uint8Array[] = [];

  stdin.unshift = ((chunk: Uint8Array) => {
    unshifted.push(Uint8Array.from(chunk));
    return true;
  }) as typeof stdin.unshift;

  const origKittyId = process.env["KITTY_WINDOW_ID"];
  process.env["KITTY_WINDOW_ID"] = "1";
  afterAll(() => {
    if (origKittyId === undefined) {
      delete process.env["KITTY_WINDOW_ID"];
    } else {
      process.env["KITTY_WINDOW_ID"] = origKittyId;
    }
  });

  const { unmount } = render(<Text>Hello</Text>, {
    stdout,
    stdin,
    kittyKeyboard: { mode: "auto" },
  });

  stdin.emit("data", "\u001B[?1x");

  await new Promise((resolve) => {
    setTimeout(resolve, 250);
  });

  const strings = getWrittenStrings(write);
  const enableCount = strings.filter((s) => s === "\u001B[>1u").length;
  expect(enableCount).toBe(0);
  expect(unshifted.map((chunk) => [...chunk])).toEqual([[0x1b, 0x5b, 0x3f, 0x31, 0x78]]);
  unmount();
});

// --- Space and return text input tests ---

test("kitty protocol - space key has text field set to space character", () => {
  const result = parseKeypress(kittyKey(32));
  expect(result.text).toBe(" ");
});

test("kitty protocol - return key has text field set to carriage return", () => {
  const result = parseKeypress(kittyKey(13));
  expect(result.text).toBe("\r");
});
