import { expect, test } from "vite-plus/test";

import { cellAttributes, createCell, emptyCell, Screen } from "#/screen/index.ts";

test("creates an empty screen with stable dimensions", () => {
  const screen = new Screen(3, 2);

  expect(screen.width).toBe(3);
  expect(screen.height).toBe(2);
  expect(screen.toRows()).toEqual([
    [emptyCell, emptyCell, emptyCell],
    [emptyCell, emptyCell, emptyCell],
  ]);
});

test("writes a grapheme into one cell", () => {
  const screen = new Screen(3, 1);
  const cell = createCell("a", 1);

  screen.setCell(1, 0, cell);

  expect(screen.cellAt(1, 0)).toBe(cell);
});

test("marks continuation columns of a wide grapheme", () => {
  const screen = new Screen(4, 1);

  screen.setCell(1, 0, createCell("界", 2));

  expect(screen.cellAt(1, 0)).toMatchObject({ grapheme: "界", width: 2 });
  expect(screen.cellAt(2, 0)).toMatchObject({ grapheme: "", width: 0 });
});

test("clears a wide grapheme when its leading column is overwritten", () => {
  const screen = new Screen(4, 1);
  const replacement = createCell("x", 1);

  screen.setCell(1, 0, createCell("界", 2));
  screen.setCell(1, 0, replacement);

  expect(screen.cellAt(1, 0)).toBe(replacement);
  expect(screen.cellAt(2, 0)).toBe(emptyCell);
});

test("clears a wide grapheme when its continuation column is overwritten", () => {
  const screen = new Screen(4, 1);
  const replacement = createCell("x", 1);

  screen.setCell(1, 0, createCell("界", 2));
  screen.setCell(2, 0, replacement);

  expect(screen.cellAt(1, 0)).toBe(emptyCell);
  expect(screen.cellAt(2, 0)).toBe(replacement);
});

test("clears every wide grapheme overlapped by a new write", () => {
  const screen = new Screen(6, 1);

  screen.setCell(0, 0, createCell("界", 2));
  screen.setCell(2, 0, createCell("語", 2));
  screen.setCell(1, 0, createCell("🦄", 2));

  expect(screen.cellAt(0, 0)).toBe(emptyCell);
  expect(screen.cellAt(1, 0)).toMatchObject({ grapheme: "🦄", width: 2 });
  expect(screen.cellAt(2, 0)).toMatchObject({ grapheme: "", width: 0 });
  expect(screen.cellAt(3, 0)).toBe(emptyCell);
});

test("does not leave a partial wide grapheme at the right boundary", () => {
  const screen = new Screen(3, 1);

  screen.setCell(2, 0, createCell("界", 2));

  expect(screen.cellAt(2, 0)).toBe(emptyCell);
});

test("ignores writes outside the screen", () => {
  const screen = new Screen(2, 1);

  screen.setCell(-1, 0, createCell("x", 1));
  screen.setCell(2, 0, createCell("x", 1));
  screen.setCell(0, 1, createCell("x", 1));

  expect(screen.toRows()).toEqual([[emptyCell, emptyCell]]);
});

test("rejects invalid dimensions and cells", () => {
  expect(() => new Screen(-1, 1)).toThrow("Screen dimensions");
  expect(() => createCell("", 1)).toThrow("one grapheme");
  expect(() => createCell("x", 0)).toThrow("positive integer");
});

test("distinguishes transparent composition from an explicit blank", () => {
  const screen = new Screen(1, 1);
  const original = createCell("x", 1);
  screen.setCell(0, 0, original);

  screen.composeCell(0, 0, undefined);
  expect(screen.cellAt(0, 0)).toBe(original);

  screen.composeCell(0, 0, { content: { grapheme: " ", width: 1 } });
  expect(screen.cellAt(0, 0)).toMatchObject({ grapheme: " ", width: 1 });
});

test("composes style channels without replacing content", () => {
  const screen = new Screen(2, 1);
  screen.setCell(
    0,
    0,
    createCell("界", 2, {
      foreground: { model: "indexed", index: 1 },
      underline: "none",
      attributes: cellAttributes.bold,
    }),
  );

  screen.composeCell(1, 0, {
    foreground: null,
    background: { model: "rgb", red: 10, green: 20, blue: 30, alpha: 255 },
  });

  expect(screen.cellAt(0, 0)).toMatchObject({
    grapheme: "界",
    width: 2,
    style: {
      background: { model: "rgb", red: 10, green: 20, blue: 30, alpha: 255 },
      underline: "none",
      attributes: cellAttributes.bold,
    },
  });
  expect(screen.cellAt(0, 0)?.style).not.toHaveProperty("foreground");
  expect(screen.cellAt(1, 0)?.style).toEqual(screen.cellAt(0, 0)?.style);
});

test("composes replacement content at the requested wide continuation column", () => {
  const screen = new Screen(4, 1);
  screen.setCell(0, 0, createCell("界", 2));

  screen.composeCell(1, 0, { content: { grapheme: "X", width: 1 } });

  expect(screen.cellAt(0, 0)).toBe(emptyCell);
  expect(screen.cellAt(1, 0)?.grapheme).toBe("X");
});

test("fills a clipped rectangle by composing its channels", () => {
  const screen = new Screen(4, 2);
  screen.setCell(1, 0, createCell("A", 1));

  // eslint-disable-next-line unicorn/no-array-fill-with-reference-type -- this is Screen.fill, not Array.fill
  screen.fill({ x: -1, y: 0, width: 4, height: 1 }, { background: { model: "indexed", index: 4 } });

  expect(screen.cellAt(0, 0)?.style.background).toEqual({ model: "indexed", index: 4 });
  expect(screen.cellAt(1, 0)).toMatchObject({
    grapheme: "A",
    style: { background: { model: "indexed", index: 4 } },
  });
  expect(screen.cellAt(2, 0)?.style.background).toEqual({ model: "indexed", index: 4 });
  expect(screen.cellAt(3, 0)?.style.background).toBeUndefined();
  expect(screen.cellAt(0, 1)?.style.background).toBeUndefined();
});

test("resizes while preserving only complete graphemes", () => {
  const screen = new Screen(4, 2);
  screen.setCell(0, 0, createCell("A", 1));
  screen.setCell(2, 0, createCell("界", 2));

  screen.resize(3, 3);

  expect(screen.bounds()).toEqual({ x: 0, y: 0, width: 3, height: 3 });
  expect(screen.cellAt(0, 0)?.grapheme).toBe("A");
  expect(screen.cellAt(2, 0)).toBe(emptyCell);
  expect(screen.toRows()).toHaveLength(3);
});

test("tracks and consumes merged dirty spans", () => {
  const screen = new Screen(5, 2);

  expect(screen.takeDirtySpans()).toEqual([
    { y: 0, start: 0, end: 5 },
    { y: 1, start: 0, end: 5 },
  ]);
  expect(screen.takeDirtySpans()).toEqual([]);

  screen.setCell(1, 0, createCell("A", 1));
  screen.setCell(3, 0, createCell("B", 1));

  expect(screen.dirtySpans()).toEqual([{ y: 0, start: 1, end: 4 }]);
  expect(screen.takeDirtySpans()).toEqual([{ y: 0, start: 1, end: 4 }]);
  expect(screen.dirtySpans()).toEqual([]);
});
