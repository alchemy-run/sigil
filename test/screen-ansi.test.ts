import { expect, test } from "vite-plus/test";

import { cellAttributes, cellsFromAnsi } from "#/screen/index.ts";

test("converts ANSI colors and attributes to a structured cell", () => {
  const [cell] = cellsFromAnsi("\u001B[1;31;48;2;10;20;30mA\u001B[0m");

  expect(cell).toEqual({
    grapheme: "A",
    width: 1,
    style: {
      foreground: { model: "indexed", index: 1, encoding: "ansi16" },
      background: { model: "rgb", red: 10, green: 20, blue: 30, alpha: 255 },
      underline: "none",
      attributes: cellAttributes.bold,
    },
  });
});

test("converts T.416 underline variants, underline color, and indexed colors", () => {
  const [cell] = cellsFromAnsi("\u001B[4:3m\u001B[58;5;201m\u001B[38;5;123mA");

  expect(cell?.style).toEqual({
    foreground: { model: "indexed", index: 123, encoding: "ansi256" },
    underlineColor: { model: "indexed", index: 201, encoding: "ansi256" },
    underline: "curly",
    attributes: cellAttributes.none,
  });
});

test("converts OSC 8 links and grapheme widths", () => {
  const [cell] = cellsFromAnsi("\u001B]8;id=docs;https://example.com\u0007界\u001B]8;;\u0007");

  expect(cell).toMatchObject({
    grapheme: "界",
    width: 2,
    hyperlink: { url: "https://example.com", parameters: "id=docs" },
  });
});

test("keeps combining sequences in one cell", () => {
  const [cell] = cellsFromAnsi("e\u0301");

  expect(cell).toMatchObject({ grapheme: "e\u0301", width: 1 });
});

test("does not turn non-rendering controls into cells", () => {
  expect(cellsFromAnsi("\u001B]0;title\u0007A")).toHaveLength(1);
});
