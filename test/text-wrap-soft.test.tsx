import { EventEmitter } from "node:events";
import { stripVTControlCharacters } from "node:util";

import { expect, test, vi } from "vite-plus/test";

import { ansiEscapes } from "#/ansi/escapes.ts";
import { Box, Hyperlink, Text } from "#/index.ts";
import { createCell, Screen } from "#/screen/index.ts";
import { cellsFromAnsi } from "#/screen/index.ts";
import { serializeScreen } from "#/screen/serialize.ts";
import { wrapStructuredText } from "#/structured-text.ts";
import { ScreenPresenter } from "#/terminal/screen-presenter.ts";
import { wrapText } from "#/wrap-text.ts";

import { renderToString } from "./helpers/render-to-string.ts";

const url = "https://example.com/authorize?client_id=abcdefghijklmnopqrstuvwxyz&state=0123456789";

test("soft lays out like hard: breaks at any character", () => {
  expect(wrapText("abcdefgh", 3, "soft")).toBe(wrapText("abcdefgh", 3, "hard"));
  const lines = wrapStructuredText([cellsFromAnsi("abcdefgh")], 3, "soft");
  expect(lines.map((line) => line.map((cell) => cell.grapheme).join(""))).toEqual([
    "abc",
    "def",
    "gh",
  ]);
});

test("soft text at the left edge serializes as one line the terminal wraps", () => {
  const output = renderToString(<Text wrap="soft">{url}</Text>, { columns: 20 });

  expect(output).toBe(url);
});

test("soft text keeps the rows after it on their own lines", () => {
  const output = renderToString(
    <Box flexDirection="column">
      <Text>above</Text>
      <Text wrap="soft">{url}</Text>
      <Text>below</Text>
    </Box>,
    { columns: 20 },
  );

  expect(output).toBe(`above\n${url}\nbelow`);
});

test("indented soft text falls back to hard wrapping", () => {
  const output = renderToString(
    <Box paddingLeft={2}>
      <Text wrap="soft">{url}</Text>
    </Box>,
    { columns: 20 },
  );

  // Rows that don't start at the edge can't be joined by the terminal.
  expect(output.split("\n")).toHaveLength(Math.ceil(url.length / 18));
});

const softFrame = (...lines: string[]): Screen => {
  const width = Math.max(0, ...lines.map((line) => line.length));
  const screen = new Screen(width, lines.length);
  for (const [y, line] of lines.entries()) {
    for (let x = 0; x < line.length; x++) {
      screen.setCell(x, y, createCell(line.charAt(x), 1));
    }
  }
  return screen;
};

const presenter = () => {
  const stream = new EventEmitter() as NodeJS.WritableStream;
  const writes: string[] = [];
  stream.write = vi.fn((data: string) => {
    writes.push(data);
    return true;
  });
  const subject = new ScreenPresenter((data) => {
    writes.push(data);
    return true;
  }, stream);
  return { subject, writes };
};

test("a soft-wrapped row is joined only when it reaches the right edge", () => {
  const full = softFrame("abcd", "ef  ");
  full.markSoftWrapped(0);
  expect(serializeScreen(full, { colorProfile: "none" })).toBe("abcdef");

  const short = softFrame("ab  ", "cd  ");
  short.markSoftWrapped(0);
  expect(serializeScreen(short, { colorProfile: "none" })).toBe("ab\ncd");
});

test("rewriting a row inside a soft-wrapped run restarts at the run", () => {
  const { subject, writes } = presenter();
  const before = softFrame("spin", "abcd", "efgh", "ij  ", "old ");
  before.markSoftWrapped(1);
  before.markSoftWrapped(2);
  subject.present(before, { colorProfile: "none" });
  writes.length = 0;

  const after = softFrame("spin", "abcd", "efgh", "ij  ", "new ");
  after.markSoftWrapped(1);
  after.markSoftWrapped(2);
  subject.present(after, { colorProfile: "none" });
  // Only the last row changed; the run above it is untouched.
  expect(writes).toEqual([ansiEscapes.eraseLines(2) + "new\n"]);

  writes.length = 0;
  const changedTail = softFrame("spin", "abcd", "efgh", "IJ  ", "new ");
  changedTail.markSoftWrapped(1);
  changedTail.markSoftWrapped(2);
  subject.present(changedTail, { colorProfile: "none" });
  // A change on the run's last row rewrites the whole run, still one line.
  expect(writes).toEqual([ansiEscapes.eraseLines(5) + "abcdefghIJ\nnew\n"]);
});

test("a change in soft-wrap marks alone repaints the row", () => {
  const { subject, writes } = presenter();
  subject.present(softFrame("abcd", "ef  "), { colorProfile: "none" });
  writes.length = 0;

  const joined = softFrame("abcd", "ef  ");
  joined.markSoftWrapped(0);
  subject.present(joined, { colorProfile: "none" });

  expect(writes).toEqual([ansiEscapes.eraseLines(3) + "abcdef\n"]);
});

test("a soft-wrapped hyperlink stays one line", () => {
  // Hyperlink lays its text out through a Transform, which must carry the wrap.
  const output = renderToString(
    <Hyperlink url={url} wrap="soft" fallback={false}>
      {url}
    </Hyperlink>,
    { columns: 20 },
  );

  expect(stripVTControlCharacters(output)).toBe(url);
});
