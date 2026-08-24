import { expect, test } from "vite-plus/test";

import {
  cellAttributes,
  colorProfileFromLevel,
  createCell,
  quantizeColor,
  Screen,
  serializeLine,
  serializeScreen,
} from "#/screen/index.ts";

test("maps capability levels to explicit color profiles", () => {
  expect([0, 1, 2, 3].map((level) => colorProfileFromLevel(level as 0 | 1 | 2 | 3))).toEqual([
    "none",
    "ansi16",
    "ansi256",
    "truecolor",
  ]);
});

test("quantizes RGB at the serialization boundary", () => {
  const orange = { model: "rgb", red: 255, green: 136, blue: 0, alpha: 255 } as const;

  expect(quantizeColor(orange, "truecolor")).toBe(orange);
  expect(quantizeColor(orange, "ansi256")).toEqual({
    model: "indexed",
    index: 214,
    encoding: "ansi256",
  });
  expect(quantizeColor(orange, "ansi16")).toEqual({
    model: "indexed",
    index: 11,
    encoding: "ansi16",
  });
  expect(quantizeColor(orange, "none")).toBeUndefined();
  expect(quantizeColor({ model: "indexed", index: 196 }, "ansi16")).toEqual({
    model: "indexed",
    index: 9,
    encoding: "ansi16",
  });
});

test("serializes truecolor cells and resets the pen", () => {
  const line = [
    createCell("A", 1, {
      foreground: { model: "rgb", red: 10, green: 20, blue: 30, alpha: 255 },
      underline: "none",
      attributes: cellAttributes.none,
    }),
  ];

  expect(serializeLine(line, { colorProfile: "truecolor" })).toBe(
    "\u001B[38;2;10;20;30mA\u001B[39m",
  );
});

test("preserves an explicitly requested ANSI-256 encoding", () => {
  const line = [
    createCell("A", 1, {
      foreground: { model: "indexed", index: 9, encoding: "ansi256" },
      underline: "none",
      attributes: cellAttributes.none,
    }),
  ];

  expect(serializeLine(line, { colorProfile: "truecolor" })).toBe("\u001B[38;5;9mA\u001B[39m");
  expect(serializeLine(line, { colorProfile: "ansi16" })).toBe("\u001B[91mA\u001B[39m");
});

test("downsamples colors while preserving non-color attributes", () => {
  const line = [
    createCell("A", 1, {
      foreground: { model: "rgb", red: 255, green: 0, blue: 0, alpha: 255 },
      underline: "none",
      attributes: cellAttributes.bold,
    }),
  ];

  expect(serializeLine(line, { colorProfile: "ansi256" })).toBe(
    "\u001B[1m\u001B[38;5;196mA\u001B[39m\u001B[22m",
  );
  expect(serializeLine(line, { colorProfile: "ansi16" })).toBe(
    "\u001B[1m\u001B[91mA\u001B[39m\u001B[22m",
  );
  expect(serializeLine(line, { colorProfile: "none" })).toBe("\u001B[1mA\u001B[22m");
});

test("serializes underline variants, underline colors, and hyperlinks", () => {
  const line = [
    createCell(
      "A",
      1,
      {
        underlineColor: { model: "indexed", index: 201 },
        underline: "curly",
        attributes: cellAttributes.none,
      },
      { url: "https://example.com", parameters: "id=docs" },
    ),
  ];

  expect(serializeLine(line, { colorProfile: "ansi256" })).toBe(
    "\u001B]8;id=docs;https://example.com\u0007\u001B[4:3m\u001B[58;5;201mA" +
      "\u001B[59m\u001B[24m\u001B]8;;\u0007",
  );
});

test("coalesces equal adjacent styles and omits continuation glyphs", () => {
  const screen = new Screen(3, 1);
  const style = {
    foreground: { model: "indexed", index: 1 } as const,
    underline: "none" as const,
    attributes: cellAttributes.none,
  };
  screen.setCell(0, 0, createCell("界", 2, style));
  screen.setCell(2, 0, createCell("A", 1, style));

  expect(serializeScreen(screen, { colorProfile: "truecolor" })).toBe("\u001B[31m界A\u001B[39m");
});

test("coalesces colors that become equal after profile quantization", () => {
  const line = [
    createCell("A", 1, {
      foreground: { model: "rgb", red: 255, green: 0, blue: 0, alpha: 255 },
      underline: "none",
      attributes: cellAttributes.none,
    }),
    createCell("B", 1, {
      foreground: { model: "rgb", red: 240, green: 0, blue: 0, alpha: 255 },
      underline: "none",
      attributes: cellAttributes.none,
    }),
  ];

  expect(serializeLine(line, { colorProfile: "ansi16" })).toBe("\u001B[91mAB\u001B[39m");
  expect(serializeLine(line, { colorProfile: "none" })).toBe("AB");
});
