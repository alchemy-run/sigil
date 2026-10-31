import { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

import { expect, onTestFinished, test } from "vite-plus/test";

import { render, Text, useInput } from "#/index.ts";
import { parseKeypress } from "#/parse-keypress.ts";

import { createStdin } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

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

test("kitty protocol - backspace release", () => {
  // Backspace key release
  const result = parseKeypress(kittyKey(127, 1, 3));
  expect(result.name).toBe("backspace");
  expect(result.eventType).toBe("release");
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

test("kitty protocol - Ctrl letters retain their unshifted key code", () => {
  // Ctrl+a uses the unshifted letter codepoint and modifier 5.
  const result = parseKeypress(kittyKey(97, 5));
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

test("kitty protocol - Ctrl letters preserve their input character", () => {
  // Ctrl+a uses the unshifted letter codepoint.
  const result = parseKeypress(kittyKey(97, 5));
  expect(result.isPrintable).toBe(true);
  expect(result.text).toBe("a");
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

test("kitty protocol - writes enable sequence on init when mode is enabled", () => {
  const stdout = createStdout();
  const stdin = createStdin();

  const { unmount } = render(<Text>Hello</Text>, {
    stdout,
    stdin,
    kittyKeyboard: { mode: "enabled" },
  });

  // CSI > 1 u (push keyboard mode with disambiguateEscapeCodes flag)
  expect(stdout.getWrites()).toContain("\u001B[>1u");

  unmount();
});

test("kitty protocol - writes disable sequence on unmount", () => {
  const stdout = createStdout();
  const stdin = createStdin();

  const { unmount } = render(<Text>Hello</Text>, {
    stdout,
    stdin,
    kittyKeyboard: { mode: "enabled" },
  });

  unmount();

  // CSI < u (pop keyboard mode)
  expect(stdout.getWrites()).toContain("\u001B[<u");
});

test("kitty protocol - not enabled when stdin is not a TTY", () => {
  const stdout = createStdout();
  const stdin = createStdin();
  stdin.isTTY = false;

  const { unmount } = render(<Text>Hello</Text>, {
    stdout,
    stdin,
    kittyKeyboard: { mode: "enabled" },
  });

  expect(stdout.getWrites()).not.toContain("\u001B[>1u");

  unmount();
});

test("kitty protocol - not enabled when stdout is not a TTY", () => {
  const stdout = createStdout();
  stdout.isTTY = false;
  const stdin = createStdin();

  const { unmount } = render(<Text>Hello</Text>, {
    stdout,
    stdin,
    kittyKeyboard: { mode: "enabled" },
  });

  expect(stdout.getWrites()).not.toContain("\u001B[>1u");

  unmount();
});

// --- Auto-detection race condition tests ---

// Use a real Readable so read()/data event ordering matches terminal input.
const createDetectionApp = (onQuery?: (stdin: Readable) => void) => {
  const stdin = Object.assign(new Readable({ read() {} }), {
    isTTY: true,
    setRawMode() {},
  });
  const stdout = createStdout();
  const writtenStrings: string[] = [];
  const inputs: string[] = [];
  stdout.write.mockImplementation((data: string) => {
    writtenStrings.push(data);
    if (data === "\u001B[?u") {
      onQuery?.(stdin);
    }

    return true;
  });

  function Example() {
    useInput((input) => {
      inputs.push(input);
    });
    return <Text>Hello</Text>;
  }

  const app = render(<Example />, {
    stdout,
    stdin,
    interactive: true,
    kittyKeyboard: { mode: "auto" },
  });

  return { stdin, writtenStrings, inputs, unmount: app.unmount };
};

test("kitty protocol - auto detection does not enable protocol after unmount", async () => {
  const app = createDetectionApp();
  // Unmount before the terminal responds.
  app.unmount();
  // Simulate a late terminal response arriving after unmount.
  app.stdin.push("\u001B[?1u");
  await delay(30);
  // The enable sequence should NOT have been written after unmount.
  expect(app.writtenStrings).not.toContain("\u001B[>1u");
});

test("kitty protocol - auto detection handles synchronous query response", async () => {
  // Respond synchronously to stdout.write, before App has attached its reader.
  const app = createDetectionApp((stdin) => {
    stdin.push("\u001B[?1u");
  });
  onTestFinished(() => {
    app.unmount();
  });
  await delay(30);
  expect(app.writtenStrings).toContain("\u001B[>1u");
  expect(app.inputs).toEqual([]);
});

test("kitty protocol - auto detection handles Uint8Array query response", async () => {
  const app = createDetectionApp();
  onTestFinished(() => {
    app.unmount();
  });
  // Respond with Uint8Array instead of string.
  app.stdin.push(textEncoder.encode("\u001B[?1u"));
  await delay(30);
  expect(app.writtenStrings).toContain("\u001B[>1u");
  expect(app.inputs).toEqual([]);
});

test("kitty protocol - auto detection preserves split UTF-8 input bytes", async () => {
  const app = createDetectionApp();
  onTestFinished(() => {
    app.unmount();
  });
  // Emit one UTF-8 emoji split across chunks during detection.
  app.stdin.push(new Uint8Array([0xf0, 0x9f]));
  await delay(1);
  app.stdin.push(new Uint8Array([0x92, 0xa9]));
  await delay(250);
  expect(app.inputs).toEqual(["💩"]);
});

test("kitty protocol - auto detection handles split responses with surrounding input", async () => {
  const app = createDetectionApp();
  onTestFinished(() => {
    app.unmount();
  });
  app.stdin.push("before\u001B[?");
  await delay(1);
  app.stdin.push("0uafter");
  await delay(30);
  expect(app.writtenStrings).toContain("\u001B[>1u");
  expect(app.inputs).toEqual(["before", "after"]);
});

test("kitty protocol - auto detection timeout holds query prefix without digits", async () => {
  const app = createDetectionApp();
  onTestFinished(() => {
    app.unmount();
  });
  app.stdin.push("\u001B[?");
  await delay(250);
  expect(app.writtenStrings).not.toContain("\u001B[>1u");
  // Unlike Ink, sigil only flushes a bare `ESC[`; a longer prefix is a reply in progress.
  expect(app.inputs).toEqual([]);
});

test("kitty protocol - auto detection does not treat query response without digits as a response", async () => {
  const app = createDetectionApp();
  onTestFinished(() => {
    app.unmount();
  });
  app.stdin.push("\u001B[?u");
  await delay(250);
  expect(app.writtenStrings).not.toContain("\u001B[>1u");
  expect(app.inputs).toEqual([]);
});

test("kitty protocol - auto detection does not treat invalid query-like sequence as a response", async () => {
  const app = createDetectionApp();
  onTestFinished(() => {
    app.unmount();
  });
  app.stdin.push("\u001B[?1x");
  await delay(250);
  expect(app.writtenStrings).not.toContain("\u001B[>1u");
  expect(app.inputs).toEqual([]);
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
