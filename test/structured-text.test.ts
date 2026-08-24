import { expect, test } from "vite-plus/test";

import { cellsFromAnsi } from "#/screen/index.ts";
import { wrapStructuredText } from "#/structured-text.ts";
import { wrapText } from "#/wrap-text.ts";

const cases = [
  "hello world",
  " hello world",
  "hello  world",
  "hello world ",
  "a bb ccc dddd",
  "aa bbbbbbb",
  "a bbbbbbb c",
  "あいう えお",
  "あいうえおか",
];

for (const mode of ["wrap", "hard"] as const) {
  for (const width of [2, 5, 7]) {
    test(`matches visible ${mode} behavior at width ${width}`, () => {
      for (const input of cases) {
        const legacy = wrapText(input, width, mode)
          .split("\n")
          .map((line) => line.trimEnd())
          .join("\n");
        const structured = wrapStructuredText([cellsFromAnsi(input)], width, mode)
          .map((line) =>
            line
              .map((cell) => cell.grapheme)
              .join("")
              .trimEnd(),
          )
          .join("\n");

        expect(structured, input).toBe(legacy);
      }
    });
  }
}

test("matches truncation positions", () => {
  const input = cellsFromAnsi("Hello World");

  expect(visible(wrapStructuredText([input], 7, "truncate-end"))).toBe("Hello …");
  expect(visible(wrapStructuredText([input], 7, "truncate-middle"))).toBe("Hel…rld");
  expect(visible(wrapStructuredText([input], 7, "truncate-start"))).toBe("… World");
});

test("does not split wide graphemes during truncation", () => {
  const input = cellsFromAnsi("あいうえおかきくけこ|end");
  const modes: Array<NonNullable<Parameters<typeof wrapStructuredText>[2]>> = [
    "truncate-end",
    "truncate-middle",
    "truncate-start",
  ];

  for (const mode of modes) {
    const [line] = wrapStructuredText([input], 20, mode);
    expect(line.reduce((width, cell) => width + cell.width, 0)).toBeLessThanOrEqual(20);
  }
});

function visible(lines: readonly (readonly { grapheme: string }[])[]): string {
  return lines.map((line) => line.map((cell) => cell.grapheme).join("")).join("\n");
}
