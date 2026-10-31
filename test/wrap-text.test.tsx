import { expect, test } from "vite-plus/test";

import { AnsiText, Box, Text } from "#/index.ts";
import { wrapText, wrapTextCache } from "#/wrap-text.ts";

import { renderToString } from "./helpers/render-to-string.ts";
import { renderAsync } from "./helpers/test-renderer.ts";

test("changing text wrapping recalculates the container height", async () => {
  function Example({ truncate }: { readonly truncate: boolean }) {
    return (
      <Box width={7} borderStyle="single">
        <Text wrap={truncate ? "truncate" : "wrap"}>abcdefghij</Text>
      </Box>
    );
  }

  const { getOutput, rerenderAsync, unmount } = await renderAsync(<Example truncate={false} />);

  try {
    expect(getOutput()).toBe("┌─────┐\n│abcde│\n│fghij│\n└─────┘");

    await rerenderAsync(<Example truncate />);
    expect(getOutput()).toBe("┌─────┐\n│abcd…│\n└─────┘");

    await rerenderAsync(<Example truncate={false} />);
    expect(getOutput()).toBe("┌─────┐\n│abcde│\n│fghij│\n└─────┘");
  } finally {
    unmount();
  }
});

test("wraps text", () => {
  expect(wrapText("hello world", 5, "wrap")).toBe("hello\n \nworld");
});

test("truncates text at the end", () => {
  expect(wrapText("hello world", 5, "truncate-end")).toBe("hell…");
});

test("truncates each line of multi-line text separately", () => {
  expect(wrapText("hello world\nfoo", 6, "truncate-end")).toBe("hello…\nfoo");
  expect(wrapText("foo\nhello world", 6, "truncate-end")).toBe("foo\nhello…");
  expect(wrapText("ab\ncdefgh\nij", 4, "truncate-end")).toBe("ab\ncde…\nij");
  expect(wrapText("hello world\nfoo", 6, "truncate-middle")).toBe("hel…ld\nfoo");
  expect(wrapText("hello world\nfoo", 6, "truncate-start")).toBe("…world\nfoo");
});

test("truncated multi-line text keeps styles that span a newline", () => {
  expect(wrapText("\u001B[31mabcdef\nuvwxyz\u001B[39m", 4, "truncate-end")).toBe(
    "\u001B[31mabc…\u001B[39m\n\u001B[31muvw…\u001B[39m",
  );

  const link = "\u001B]8;;https://example.com\u0007";
  const linkEnd = "\u001B]8;;\u0007";
  expect(wrapText(`${link}abcdef\nuvwxyz${linkEnd}`, 4, "truncate-end")).toBe(
    `${link}abc${linkEnd}…\n${link}uvw${linkEnd}…`,
  );
});

test("truncated multi-line text keeps its lines in the layout", () => {
  const output = renderToString(
    <Box width={8} borderStyle="single">
      <Text wrap="truncate">{"hello world\nfoo"}</Text>
    </Box>,
  );

  expect(output).toBe("┌──────┐\n│hello…│\n│foo   │\n└──────┘");
});

// Ordinary `Text` strips embedded styling, so these use `AnsiText` and compare
// each encoding against its ESC/semicolon equivalent.
for (const [name, text, standard] of [
  ["C1 SGR color", "\u009B31mabcdef\nuvwxyz\u009B39m", "\u001B[31mabcdef\nuvwxyz\u001B[39m"],
  [
    "C1 OSC hyperlink",
    "\u009D8;;https://example.com\u009Cabcdef\nuvwxyz\u009D8;;\u009C",
    "\u001B]8;;https://example.com\u001B\\abcdef\nuvwxyz\u001B]8;;\u001B\\",
  ],
  [
    "colon 256-color",
    "\u001B[38:5:196mabcdef\nuvwxyz\u001B[39m",
    "\u001B[38;5;196mabcdef\nuvwxyz\u001B[39m",
  ],
  [
    "colon truecolor",
    "\u001B[38:2::255:0:0mabcdef\nuvwxyz\u001B[39m",
    "\u001B[38;2;255;0;0mabcdef\nuvwxyz\u001B[39m",
  ],
] as const) {
  test(`truncated multi-line text keeps a ${name} that spans a newline`, () => {
    const view = (value: string) =>
      renderToString(
        <Box width={4}>
          <AnsiText wrap="truncate">{value}</AnsiText>
        </Box>,
      );

    const output = view(text);
    expect(output).toBe(view(standard));
    expect(output.split("\n")).toHaveLength(2);
    expect(output.split("\n").every((line) => line.includes("…"))).toBe(true);
  });
}

test("keeps text at its natural width when there is no room to wrap", () => {
  expect(wrapText("hello", 0, "wrap")).toBe("hello");
  expect(wrapText("hello", 0, "hard")).toBe("hello");
  expect(wrapText("hello", -1, "wrap")).toBe("hello");
});

test("wraps a fraction of a column like one column", () => {
  expect(wrapText("hello", 0.5, "wrap")).toBe("h\ne\nl\nl\no");
  expect(wrapText("hello", 0.5, "hard")).toBe("h\ne\nl\nl\no");
});

test("leaves truncation at zero columns alone", () => {
  expect(wrapText("hello", 0, "truncate")).toBe("");
});

test("uses separate cache entries for different widths", () => {
  expect(wrapText("hello world", 5, "truncate-end")).toBe("hell…");
  expect(wrapText("hello world", 8, "truncate-end")).toBe("hello w…");
});

test("evicts old cached results", () => {
  const cacheKey = "5\u0000truncate-end\u0000cache-test-first";
  wrapTextCache.clear();
  wrapText("cache-test-first", 5, "truncate-end");
  expect(wrapTextCache.has(cacheKey)).toBe(true);

  // The cache is bounded by text size, so a few large texts push out the rest.
  for (let index = 0; index < 20; index++) {
    wrapText(`${"x".repeat(100_000)}${index}`, 5, "truncate-end");
  }

  expect(wrapTextCache.has(cacheKey)).toBe(false);
});

test("uses separate cache entries for texts that end with digits", () => {
  wrapTextCache.clear();

  expect(wrapText("ab", 12, "wrap")).toBe("ab");
  expect(wrapText("ab1", 2, "wrap")).toBe("ab\n1");
});

test("does not reuse a cached result from a wider box", () => {
  wrapTextCache.clear();

  renderToString(
    <Box width={15}>
      <Text>一二三四五六七八九十</Text>
    </Box>,
  );

  const output = renderToString(
    <Box width={5}>
      <Text>一二三四五六七八九十1</Text>
    </Box>,
  );

  expect(output).toBe("一二\n三四\n五六\n七八\n九十1");
});
