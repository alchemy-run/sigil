import { expect, test } from "vite-plus/test";

import { AnsiText, Box, render, Static, Text } from "#/index.ts";
import { cellsFromAnsi, createCell, emptyCell, Screen } from "#/screen/index.ts";
import { serializeScreen } from "#/screen/serialize.ts";
import { wrapStructuredText } from "#/structured-text.ts";
import { wrapText } from "#/wrap-text.ts";

import createStdout from "./helpers/create-stdout.ts";
import { renderToString } from "./helpers/render-to-string.ts";

const longLine =
  "INFO (#430): durable object reconciliation " +
  `{"oldDoClassNameByLogicalId":{},"currentDoClassNameByLogicalId":{},"deletedClasses":[]}`;

test("wrapText leaves text untouched for none", () => {
  expect(wrapText("hello world", 5, "none")).toBe("hello world");
});

test("wrapStructuredText leaves lines untouched for none", () => {
  const line = cellsFromAnsi("hello world");
  const output = wrapStructuredText([line], 5, "none");

  expect(output).toHaveLength(1);
  expect(output[0]?.map((cell) => cell.grapheme).join("")).toBe("hello world");
});

test("wrapStructuredText keeps full lines for none even below one column", () => {
  const output = wrapStructuredText([cellsFromAnsi("abc")], 0, "none");

  expect(output[0]?.map((cell) => cell.grapheme).join("")).toBe("abc");
});

test("screen setCell clips past the width without overflow", () => {
  const screen = new Screen(3, 1);

  screen.setCell(5, 0, createCell("a", 1));

  expect(screen.rowLength(0)).toBe(3);
  expect(screen.cellAt(5, 0)).toBeUndefined();
});

test("screen setCell grows the row for overflow writes", () => {
  const screen = new Screen(3, 1);
  const cell = createCell("a", 1);

  screen.setCell(5, 0, cell, { overflow: true });

  expect(screen.width).toBe(3);
  expect(screen.rowLength(0)).toBe(6);
  expect(screen.cellAt(5, 0)).toBe(cell);
  expect(screen.cellAt(3, 0)).toBe(emptyCell);
  expect(serializeScreen(screen, { colorProfile: "none" })).toBe("     a");
});

test("overflow writes handle wide graphemes across the boundary", () => {
  const screen = new Screen(3, 1);

  screen.setCell(2, 0, createCell("界", 2), { overflow: true });

  expect(screen.cellAt(2, 0)).toMatchObject({ grapheme: "界", width: 2 });
  expect(screen.cellAt(3, 0)).toMatchObject({ grapheme: "", width: 0 });
});

test("text with wrap none overflows the render width", () => {
  const output = renderToString(<Text wrap="none">{longLine}</Text>, { columns: 40 });

  expect(output).toBe(longLine);
});

test("ansi text with wrap none overflows the render width", () => {
  const output = renderToString(<AnsiText wrap="none">{longLine}</AnsiText>, {
    columns: 40,
  });

  expect(output).toBe(longLine);
});

test("wrap none does not disturb sibling rows", () => {
  const output = renderToString(
    <Box flexDirection="column">
      <Text wrap="none">{longLine}</Text>
      <Text>short</Text>
    </Box>,
    { columns: 40 },
  );

  expect(output).toBe(`${longLine}\nshort`);
});

test("wrap none still clips inside an overflow hidden box", () => {
  const output = renderToString(
    <Box width={10} overflow="hidden">
      <Text wrap="none">abcdefghijklmnop</Text>
    </Box>,
    { columns: 40 },
  );

  expect(output).toBe("abcdefghij");
});

test("static transcript lines with wrap none keep their full width", () => {
  const output = renderToString(
    <Static items={[longLine]}>
      {(item) => (
        <AnsiText key={item} wrap="none">
          {item}
        </AnsiText>
      )}
    </Static>,
    { columns: 40 },
  );

  expect(output).toContain(longLine);
});

test("interactive presenter emits overflowing static lines in full", () => {
  const stdout = createStdout(40);

  const instance = render(
    <>
      <Static items={[longLine]}>
        {(item) => (
          <AnsiText key={item} wrap="none">
            {item}
          </AnsiText>
        )}
      </Static>
      <Text>live row</Text>
    </>,
    { stdout, colorProfile: "none" },
  );

  const everything = stdout.getWrites().join("");
  instance.unmount();

  expect(everything).toContain(`${longLine}\n`);
});
