import { Buffer } from "node:buffer";

import { expect, test } from "vite-plus/test";

import { parseKeypress } from "#/parse-keypress.ts";

// Vt220-style Ctrl+F1–F4 (ESC [ 1 ; 5 P/Q/R/S)
test('Ctrl+F1 resolves to name "f1"', () => {
  const key = parseKeypress("\u001B[1;5P");
  expect(key.name).toBe("f1");
  expect(key.ctrl).toBe(true);
  expect(key.shift).toBe(false);
  expect(key.meta).toBe(false);
});

test('Ctrl+F2 resolves to name "f2"', () => {
  const key = parseKeypress("\u001B[1;5Q");
  expect(key.name).toBe("f2");
  expect(key.ctrl).toBe(true);
});

test('Ctrl+F3 resolves to name "f3"', () => {
  const key = parseKeypress("\u001B[1;5R");
  expect(key.name).toBe("f3");
  expect(key.ctrl).toBe(true);
});

test('Ctrl+F4 resolves to name "f4"', () => {
  const key = parseKeypress("\u001B[1;5S");
  expect(key.name).toBe("f4");
  expect(key.ctrl).toBe(true);
});

// Unmapped codes fall back to empty string
test("unmapped ctrl sequence returns empty name", () => {
  const key = parseKeypress("\u001B[1;5I");
  expect(key.name).toBe("");
  expect(key.ctrl).toBe(true);
});

test("another unmapped ctrl sequence returns empty name", () => {
  const key = parseKeypress("\u001B[1;5X");
  expect(key.name).toBe("");
  expect(key.ctrl).toBe(true);
});

// Shift+F1 (modifier 2) uses the same [P mapping
test('Shift+F1 resolves to name "f1" with shift', () => {
  const key = parseKeypress("\u001B[1;2P");
  expect(key.name).toBe("f1");
  expect(key.shift).toBe(true);
  expect(key.ctrl).toBe(false);
});

test("parsing a single-byte Meta key does not mutate the input", () => {
  const input = new Uint8Array([0xe1]);
  const firstKey = parseKeypress(input);

  expect(firstKey).toMatchObject({ name: "a", meta: true, sequence: "\u001Ba" });
  expect(input).toEqual(new Uint8Array([0xe1]));
  expect(parseKeypress(input)).toEqual(firstKey);
});

test("Meta byte parsing preserves shared buffers across the full byte range", () => {
  for (let byte = 128; byte <= 255; byte++) {
    const buffer = Buffer.from([0, byte, 0]);
    const input = buffer.subarray(1, 2);
    const expected = parseKeypress(`\u001B${String.fromCodePoint(byte - 128)}`);

    expect(parseKeypress(input)).toEqual(expected);
    expect(buffer).toEqual(Buffer.from([0, byte, 0]));
    expect(parseKeypress(input)).toEqual(expected);
  }
});

test("byte parsing preserves ASCII and multibyte UTF-8 input", () => {
  for (const text of ["a", "hello", "é", "😀"]) {
    const input = Buffer.from(text);
    expect(parseKeypress(input)).toEqual(parseKeypress(text));
    expect(input).toEqual(Buffer.from(text));
  }
});

test("kitty functional keys preserve modifiers without an explicit event type", () => {
  for (const [sequence, name] of [
    ["\u001B[1;249A", "up"],
    ["\u001B[3;249~", "delete"],
    ["\u001B[13;249~", "f3"],
    ["\u001B[1;249P", "f1"],
  ] as const) {
    expect(parseKeypress(sequence)).toMatchObject({
      name,
      super: true,
      hyper: true,
      meta: true,
      capsLock: true,
      numLock: true,
      ctrl: false,
      shift: false,
      eventType: "press",
      isPrintable: false,
    });
  }

  expect(parseKeypress("\u001B[1;9A")).toMatchObject({ super: true, meta: false });
});

test("kitty modifiers and event types agree across key encodings", () => {
  const modifierNames = [
    "shift",
    "meta",
    "ctrl",
    "super",
    "hyper",
    "meta",
    "capsLock",
    "numLock",
  ] as const;
  for (const [bit, modifierName] of modifierNames.entries()) {
    for (const [eventCode, eventType] of [
      ["", "press"],
      [":1", "press"],
      [":2", "repeat"],
      [":3", "release"],
    ] as const) {
      const modifiers = `${2 ** bit + 1}${eventCode}`;
      for (const sequence of [
        `\u001B[97;${modifiers}u`,
        `\u001B[1;${modifiers}A`,
        `\u001B[3;${modifiers}~`,
      ]) {
        const key = parseKeypress(sequence);
        expect(key[modifierName], `Sequence: ${sequence}`).toBe(true);
        expect(key.eventType, `Sequence: ${sequence}`).toBe(eventType);
      }
    }
  }
});

test("kitty keypad Begin supports both functional encodings", () => {
  for (const sequence of ["\u001B[1E", "\u001B[57427~", "\u001B[1;1:2E", "\u001B[57427;1:2~"]) {
    expect(parseKeypress(sequence).name).toBe("clear");
  }
});

test("kitty text-only events have no key identity", () => {
  expect(parseKeypress("\u001B[0;;229:128169u")).toMatchObject({
    name: "",
    text: "å💩",
    isPrintable: true,
  });
});

test("kitty unknown functional and control codes do not invent printable characters", () => {
  for (const codepoint of [0, 1, 3, 31, 128, 159, 57_344, 63_743]) {
    expect(parseKeypress(`\u001B[${codepoint}u`)).toMatchObject({
      name: "",
      isPrintable: false,
      text: undefined,
    });
  }

  expect(parseKeypress("\u001B[63744u")).toMatchObject({
    text: String.fromCodePoint(63_744),
    isPrintable: true,
  });
});

test("legacy Ctrl+Space preserves the space key and modifiers", () => {
  for (const sequence of ["\u0000", "\u001B\u0000"]) {
    expect(parseKeypress(sequence)).toMatchObject({
      name: "space",
      ctrl: true,
      meta: sequence.length === 2,
      shift: false,
      sequence,
    });
  }
});

test("kitty keypad navigation keys use standard key names", () => {
  for (const [codepoint, name] of [
    [57_417, "left"],
    [57_418, "right"],
    [57_419, "up"],
    [57_420, "down"],
    [57_421, "pageup"],
    [57_422, "pagedown"],
    [57_423, "home"],
    [57_424, "end"],
    [57_425, "insert"],
    [57_426, "delete"],
  ] as const) {
    const sequence = `\u001B[${codepoint};5:2u`;
    expect(parseKeypress(sequence)).toMatchObject({
      name,
      ctrl: true,
      eventType: "repeat",
      isKittyProtocol: true,
      isPrintable: false,
      text: undefined,
      sequence,
    });
  }
});

test("legacy Ctrl+punctuation shortcuts preserve the key and modifiers", () => {
  for (const [character, name] of [
    ["\u001C", "\\"],
    ["\u001D", "]"],
    ["\u001E", "^"],
    ["\u001F", "_"],
  ]) {
    for (const prefix of ["", "\u001B"]) {
      const sequence = prefix + character;
      expect(parseKeypress(sequence)).toMatchObject({
        name,
        ctrl: true,
        meta: prefix.length > 0,
        shift: false,
        sequence,
      });
    }
  }
});

test("kitty alternate key codes preserve the primary key event", () => {
  for (const sequence of [
    "\u001B[97:65;6:2;65u",
    "\u001B[97:65:113;6:2;65u",
    "\u001B[97::113;6:2;65u",
  ]) {
    expect(parseKeypress(sequence)).toMatchObject({
      name: "a",
      text: "A",
      ctrl: true,
      shift: true,
      eventType: "repeat",
      isKittyProtocol: true,
      sequence,
    });
  }

  expect(parseKeypress("\u001B[1092::97;5u")).toMatchObject({
    name: "ф",
    text: "ф",
    ctrl: true,
    shift: false,
    eventType: "press",
    isKittyProtocol: true,
  });
});

test("kitty keypad associated text is printable input", () => {
  for (const [sequence, name, text] of [
    ["\u001B[57399;129;48u", "kp0", "0"],
    ["\u001B[57413;1;43u", "kpadd", "+"],
  ] as const) {
    const key = parseKeypress(sequence);
    expect(key.name).toBe(name);
    expect(key.text).toBe(text);
    expect(key.isPrintable).toBe(true);
    expect(key.isKittyProtocol).toBe(true);
  }
});

test("kitty keypad Enter produces a return key and carriage return text", () => {
  for (const [sequence, shift, eventType] of [
    ["\u001B[57414u", false, "press"],
    ["\u001B[57414;2:2u", true, "repeat"],
  ] as const) {
    const key = parseKeypress(sequence);
    expect(key.name).toBe("return");
    expect(key.text).toBe("\r");
    expect(key.isPrintable).toBe(true);
    expect(key.isKittyProtocol).toBe(true);
    expect(key.sequence).toBe(sequence);
    expect(key.shift).toBe(shift);
    expect(key.eventType).toBe(eventType);
  }
});

test("application keypad Enter maps to Return with carriage return sequence", () => {
  for (const [sequence, meta] of [
    ["\u001BOM", false],
    ["\u001B\u001BOM", true],
  ] as const) {
    const key = parseKeypress(sequence);
    expect(key.name).toBe("return");
    expect(key.sequence).toBe("\r");
    expect(key.raw).toBeUndefined();
    expect(key.meta).toBe(meta);
    expect(key.ctrl).toBe(false);
    expect(key.shift).toBe(false);
  }
});

test("Meta+Tab preserves the tab key and Meta modifier", () => {
  const key = parseKeypress("\u001B\t");
  expect(key.name).toBe("tab");
  expect(key.meta).toBe(true);
  expect(key.ctrl).toBe(false);
  expect(key.shift).toBe(false);
  expect(key.sequence).toBe("\u001B\t");
});

test("Ctrl+Meta letters preserve both modifiers and the letter name", () => {
  for (const [controlCharacter, name] of [
    ["\u0002", "b"],
    ["\u0006", "f"],
    ["\u0018", "x"],
  ]) {
    const sequence = `\u001B${controlCharacter}`;
    const key = parseKeypress(sequence);
    expect(key.name).toBe(name);
    expect(key.ctrl).toBe(true);
    expect(key.meta).toBe(true);
    expect(key.shift).toBe(false);
    expect(key.sequence).toBe(sequence);
  }
});

test("kitty associated text accepts an omitted modifier value", () => {
  const key = parseKeypress("\u001B[0;;229u");
  expect(key.isKittyProtocol).toBe(true);
  expect(key.isPrintable).toBe(true);
  expect(key.text).toBe("å");
  expect(key.eventType).toBe("press");
  expect(key.ctrl).toBe(false);
  expect(key.meta).toBe(false);
  expect(key.shift).toBe(false);
});

test("Meta modifier is recognized for punctuation and Unicode characters", () => {
  for (const character of [".", ",", "/", "-", "é", "😀"]) {
    const sequence = `\u001B${character}`;
    const key = parseKeypress(sequence);
    expect(key.meta, `Meta modifier for ${character}`).toBe(true);
    expect(key.name).toBe(character);
    expect(key.sequence).toBe(sequence);
    expect(key.ctrl).toBe(false);
    expect(key.shift).toBe(false);
  }
});

test("incomplete and multi-character sequences are not Meta characters", () => {
  for (const sequence of ["\u001B[", "\u001B[1;", "\u001Bhello"]) {
    expect(parseKeypress(sequence).meta, `Sequence ${sequence}`).toBe(false);
  }
});

test("legacy function, editing, and rxvt modifier key sequences", () => {
  for (const [code, name, shift, ctrl] of [
    ["OP", "f1", false, false],
    ["OQ", "f2", false, false],
    ["OR", "f3", false, false],
    ["OS", "f4", false, false],
    ["[P", "f1", false, false],
    ["[Q", "f2", false, false],
    ["[R", "f3", false, false],
    ["[S", "f4", false, false],
    ["[11~", "f1", false, false],
    ["[12~", "f2", false, false],
    ["[13~", "f3", false, false],
    ["[14~", "f4", false, false],
    ["[[A", "f1", false, false],
    ["[[B", "f2", false, false],
    ["[[C", "f3", false, false],
    ["[[D", "f4", false, false],
    ["[[E", "f5", false, false],
    ["[15~", "f5", false, false],
    ["[17~", "f6", false, false],
    ["[18~", "f7", false, false],
    ["[19~", "f8", false, false],
    ["[20~", "f9", false, false],
    ["[21~", "f10", false, false],
    ["[23~", "f11", false, false],
    ["[24~", "f12", false, false],
    ["[A", "up", false, false],
    ["[B", "down", false, false],
    ["[C", "right", false, false],
    ["[D", "left", false, false],
    ["[E", "clear", false, false],
    ["[F", "end", false, false],
    ["[H", "home", false, false],
    ["OA", "up", false, false],
    ["OB", "down", false, false],
    ["OC", "right", false, false],
    ["OD", "left", false, false],
    ["OE", "clear", false, false],
    ["OF", "end", false, false],
    ["OH", "home", false, false],
    ["[1~", "home", false, false],
    ["[2~", "insert", false, false],
    ["[3~", "delete", false, false],
    ["[4~", "end", false, false],
    ["[5~", "pageup", false, false],
    ["[6~", "pagedown", false, false],
    ["[[5~", "pageup", false, false],
    ["[[6~", "pagedown", false, false],
    ["[7~", "home", false, false],
    ["[8~", "end", false, false],
    ["[a", "up", true, false],
    ["[b", "down", true, false],
    ["[c", "right", true, false],
    ["[d", "left", true, false],
    ["[e", "clear", true, false],
    ["[2$", "insert", true, false],
    ["[3$", "delete", true, false],
    ["[5$", "pageup", true, false],
    ["[6$", "pagedown", true, false],
    ["[7$", "home", true, false],
    ["[8$", "end", true, false],
    ["Oa", "up", false, true],
    ["Ob", "down", false, true],
    ["Oc", "right", false, true],
    ["Od", "left", false, true],
    ["Oe", "clear", false, true],
    ["[2^", "insert", false, true],
    ["[3^", "delete", false, true],
    ["[5^", "pageup", false, true],
    ["[6^", "pagedown", false, true],
    ["[7^", "home", false, true],
    ["[8^", "end", false, true],
    ["[Z", "tab", true, false],
  ] as const) {
    expect(parseKeypress(`\u001B${code}`), code).toMatchObject({
      name,
      shift,
      ctrl,
      meta: false,
    });
    // Plain `[N~` codes that the kitty special-key parser recognizes never
    // reach the legacy table. A leading ESC adds Meta and resolves every code
    // through the table, which `code` confirms.
    expect(parseKeypress(`\u001B\u001B${code}`), `Meta+${code}`).toMatchObject({
      name,
      shift,
      ctrl,
      meta: true,
      code,
    });
  }
});

test("legacy xterm modifier parameters set Meta and Ctrl", () => {
  expect(parseKeypress("\u001BO1;9A")).toMatchObject({
    name: "up",
    meta: true,
    ctrl: false,
    shift: false,
  });
  expect(parseKeypress("\u001B\u001B[2;5~")).toMatchObject({
    name: "insert",
    meta: true,
    ctrl: true,
    shift: false,
  });
});
