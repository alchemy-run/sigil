import { expect, test } from "vite-plus/test";

import { adaptive, rgb, samplePaint } from "#/color/index.ts";
import { createCell, serializeLine, type ColorProfile } from "#/screen/index.ts";

test("golden serialization for every output color profile", () => {
  const line = [
    createCell("A", 1, {
      foreground: rgb(255, 0, 0),
      background: rgb(0, 0, 255),
      underline: "none",
      attributes: 0,
    }),
  ];
  const output = Object.fromEntries(
    (["none", "ansi16", "ansi256", "truecolor"] satisfies ColorProfile[]).map((profile) => [
      profile,
      serializeLine(line, { colorProfile: profile, trimEnd: false }),
    ]),
  );
  expect(output).toEqual({
    none: "A",
    ansi16: "\u001B[104m\u001B[91mA\u001B[39m\u001B[49m",
    ansi256: "\u001B[48;5;21m\u001B[38;5;196mA\u001B[39m\u001B[49m",
    truecolor: "\u001B[48;2;0;0;255m\u001B[38;2;255;0;0mA\u001B[39m\u001B[49m",
  });
});

test("golden adaptive colors for light, dark, and unknown appearance", () => {
  const paint = adaptive(rgb(10, 20, 30), rgb(220, 230, 240));
  const bounds = { x: 0, y: 0, width: 1, height: 1 };
  expect(samplePaint(paint, 0, 0, bounds, { appearance: "light" })).toEqual(rgb(10, 20, 30));
  expect(samplePaint(paint, 0, 0, bounds, { appearance: "dark" })).toEqual(rgb(220, 230, 240));
  expect(samplePaint(paint, 0, 0, bounds)).toEqual(rgb(220, 230, 240));
});
