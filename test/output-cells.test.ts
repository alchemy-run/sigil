import { expect, test } from "vite-plus/test";

import { stripAnsi } from "#/ansi/strip.ts";
import { Canvas } from "#/screen/canvas.ts";
import { cellAttributes, createCell, serializeScreen } from "#/screen/index.ts";

test("native cell writes preserve an existing background and honor the output profile", () => {
  const output = new Canvas({ width: 3, height: 1, colorProfile: "ansi16" });
  output.writeAnsi(0, 0, "\u001B[42m   \u001B[49m", { transformers: [] });
  output.writeCells(1, 0, [
    [
      createCell("A", 1, {
        foreground: { model: "rgb", red: 255, green: 0, blue: 0, alpha: 255 },
        underline: "none",
        attributes: cellAttributes.bold,
      }),
    ],
  ]);

  const rendered = serializeScreen(output.finish(), { colorProfile: "ansi16" });
  expect(stripAnsi(rendered)).toBe(" A ");
  expect(rendered).toContain("\u001B[42m");
  expect(rendered).toContain("\u001B[91m");
  expect(rendered).not.toContain("38;2");
});

test("native cell clipping never emits half a wide grapheme", () => {
  const output = new Canvas({ width: 3, height: 1 });
  output.clip({ x1: 0, x2: 2, y1: 0, y2: 1 });
  output.writeCells(1, 0, [[createCell("界", 2)]]);
  output.unclip();

  expect(serializeScreen(output.finish(), { colorProfile: "truecolor" })).toBe("");
});

test("the no-color profile preserves content and non-color attributes", () => {
  const output = new Canvas({
    width: 1,
    height: 1,
    colorProfile: "none",
  });
  output.writeCells(0, 0, [
    [
      createCell("A", 1, {
        foreground: { model: "indexed", index: 1 },
        underline: "single",
        attributes: cellAttributes.bold,
      }),
    ],
  ]);

  expect(stripAnsi(serializeScreen(output.finish(), { colorProfile: "none" }))).toBe("A");
});
