import { expect, test } from "vite-plus/test";

import { AnsiText, Box } from "#/index.ts";

import { renderToString } from "./helpers/render-to-string.ts";

// Ordinary `Text` strips embedded styling, so these use `AnsiText`.
for (const [name, encoded, standard] of [
  ["color", "\u009B31mred\u009B0m", "\u001B[31mred\u001B[0m"],
  [
    "hyperlink",
    "\u009D8;;https://example.com\u009Clink\u009D8;;\u009C",
    "\u001B]8;;https://example.com\u001B\\link\u001B]8;;\u001B\\",
  ],
  [
    "hyperlink with BEL terminators",
    "\u009D8;;https://example.com\u0007link\u009D8;;\u0007",
    "\u001B]8;;https://example.com\u0007link\u001B]8;;\u0007",
  ],
  ["mixed color encodings", "\u001B[31mred\u009B0m", "\u001B[31mred\u001B[0m"],
] as const) {
  for (const width of [4, 8]) {
    test(`C1 ${name} preserves layout and styling at width ${width}`, () => {
      const output = (text: string) =>
        renderToString(
          <Box width={width} borderStyle="single">
            <AnsiText>{text}</AnsiText>
          </Box>,
        );

      expect(output(encoded)).toBe(output(standard));
    });
  }
}
