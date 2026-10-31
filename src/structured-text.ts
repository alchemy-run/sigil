import { tokenizeAnsi } from "#/ansi-tokenizer.ts";
import { graphemes } from "#/ansi/graphemes.ts";
import { stringWidth } from "#/ansi/string-width.ts";
import { stripAnsi } from "#/ansi/strip.ts";
import { samplePaint, type PaintContext } from "#/color/index.ts";
import type { Paint } from "#/color/paint.ts";
import type { DOMElement, DOMNode } from "#/dom.ts";
import { sanitizeAnsi } from "#/sanitize-ansi.ts";
import { cellsFromAnsi } from "#/screen/ansi.ts";
import { createCell, type Cell, type CellStyle } from "#/screen/cell.ts";
import type { Rect } from "#/screen/geometry.ts";
import { serializeLine } from "#/screen/serialize.ts";
import {
  emptySemanticTextStyle,
  mergeSemanticTextStyles,
  semanticTextStyleToCellStyle,
  type SemanticTextStyle,
} from "#/semantic-text-style.ts";
import type { Styles } from "#/styles.ts";
import type { AnsiTransformer } from "#/transform-adapter.ts";

type SemanticCell = Cell & {
  readonly foregroundPaint?: Paint;
  readonly backgroundPaint?: Paint;
};

/**
Whether a text node must retain the ANSI compatibility pipeline. Nested
transforms are applied while building its lines, so only its own counts.
*/
export function hasCompatibilityText(node: DOMElement): boolean {
  return Boolean(node.internal_transform && !node.internal_textStyle);
}

/** Rasterizes an unwrapped native Text subtree into semantic cell lines. */
export function structuredTextLines(node: DOMElement): readonly (readonly SemanticCell[])[] {
  const lines: SemanticCell[][] = [[]];
  appendNode(node, emptySemanticTextStyle, lines, false);
  return lines.map((line) => expandTabs(line));
}

// Tabs expand to the next 8-column stop after nested text is combined, the
// same way measurement expands them.
function expandTabs(line: SemanticCell[]): SemanticCell[] {
  if (!line.some((cell) => cell.grapheme === "\t")) {
    return line;
  }

  const output: SemanticCell[] = [];
  let column = 0;

  for (const cell of line) {
    if (cell.grapheme !== "\t") {
      output.push(cell);
      column += cell.width;
      continue;
    }

    const spaces = 8 - (column % 8);
    for (let index = 0; index < spaces; index++) {
      output.push({ ...cell, grapheme: " ", width: 1 });
    }

    column += spaces;
  }

  return output;
}

/** Samples semantic paints only after wrapping and final layout are known. */
export function sampleStructuredText(
  lines: readonly (readonly SemanticCell[])[],
  bounds: Rect,
  context: PaintContext,
): readonly (readonly Cell[])[] {
  return lines.map((line, row) => {
    let column = 0;
    return line.map((cell) => {
      const foreground = cell.foregroundPaint
        ? samplePaint(cell.foregroundPaint, bounds.x + column, bounds.y + row, bounds, context)
        : cell.style.foreground;
      const background = cell.backgroundPaint
        ? samplePaint(cell.backgroundPaint, bounds.x + column, bounds.y + row, bounds, context)
        : cell.style.background;
      column += cell.width;
      return createCell(
        cell.grapheme,
        cell.width,
        {
          ...cell.style,
          ...(foreground ? { foreground } : {}),
          ...(background ? { background } : {}),
        },
        cell.hyperlink,
        cell.reset,
      );
    });
  });
}

export function structuredTextBaseStyle(node: DOMElement): CellStyle {
  return semanticTextStyleToCellStyle(
    mergeSemanticTextStyles(emptySemanticTextStyle, node.internal_textStyle),
  );
}

/** Wraps or truncates semantic cells without converting them through ANSI. */
export function wrapStructuredText(
  input: readonly (readonly Cell[])[],
  maxWidth: number,
  wrap: Styles["textWrap"],
  baseStyle?: CellStyle,
): readonly (readonly Cell[])[] {
  // Text with no room to wrap keeps its natural width, like measurement does.
  if (wrap === "none" || (maxWidth <= 0 && (wrap === "wrap" || wrap === "hard"))) {
    return input.map((line) => [...line]);
  }

  if (maxWidth <= 0) {
    return [[]];
  }

  maxWidth = Math.max(1, maxWidth);

  return input.flatMap((line) => {
    if (lineWidth(line) <= maxWidth) {
      return [[...line]];
    }

    if (wrap === "hard") {
      return hardWrap(line, maxWidth);
    }

    if (wrap === "wrap") {
      return wordWrap(line, maxWidth);
    }

    return [truncate(line, maxWidth, wrap, baseStyle)];
  });
}

function wordWrap(line: readonly Cell[], maxWidth: number): Cell[][] {
  const words: Cell[][] = [[]];
  const spaces: Cell[] = [];

  for (const cell of line) {
    if (cell.grapheme === " ") {
      spaces.push(cell);
      words.push([]);
    } else {
      words.at(-1)!.push(cell);
    }
  }

  const output: Cell[][] = [[]];
  appendHard(output, words[0]!, maxWidth);

  for (let index = 1; index < words.length; index++) {
    appendHard(output, [spaces[index - 1]!], maxWidth);
    const word = words[index]!;
    const current = output.at(-1)!;
    const wordWidth = lineWidth(word);
    const currentWidth = lineWidth(current);

    if (wordWidth <= maxWidth && currentWidth + wordWidth > maxWidth) {
      output.push([]);
    } else if (wordWidth > maxWidth && currentWidth > 0) {
      const remaining = maxWidth - currentWidth;
      const breaksHere = 1 + Math.floor((wordWidth - remaining - 1) / maxWidth);
      const breaksNext = Math.floor((wordWidth - 1) / maxWidth);
      if (breaksNext < breaksHere) {
        output.push([]);
      }
    }

    appendHard(output, word, maxWidth);
  }

  return output;
}

function hardWrap(line: readonly Cell[], maxWidth: number): Cell[][] {
  const output: Cell[][] = [[]];
  appendHard(output, line, maxWidth);
  return output;
}

function appendHard(output: Cell[][], cells: readonly Cell[], maxWidth: number): void {
  for (const cell of cells) {
    const current = output.at(-1)!;
    if (current.length > 0 && lineWidth(current) + cell.width > maxWidth) {
      output.push([]);
    }

    output.at(-1)!.push(cell);
  }
}

function truncate(
  line: readonly Cell[],
  maxWidth: number,
  wrap: Styles["textWrap"],
  baseStyle: CellStyle | undefined,
): Cell[] {
  if (maxWidth === 1) {
    return [ellipsis(baseStyle ?? cellStyleIntersection(line.at(0), line.at(-1)))];
  }

  if (wrap === "truncate-start") {
    const right = sliceCells(line, lineWidth(line) - maxWidth + 1, lineWidth(line));
    return [ellipsis(right[0]?.style), ...right];
  }

  if (wrap === "truncate-middle") {
    const half = Math.min(Math.floor(maxWidth / 2), maxWidth - 1);
    const left = sliceCells(line, 0, half);
    const rightWidth = maxWidth - half - 1;
    const right = sliceCells(line, lineWidth(line) - rightWidth, lineWidth(line));
    return [
      ...left,
      ellipsis(baseStyle ?? cellStyleIntersection(left.at(-1), right.at(0))),
      ...right,
    ];
  }

  const left = sliceCells(line, 0, maxWidth - 1);
  return [...left, ellipsis(left.at(-1)?.style)];
}

function sliceCells(line: readonly Cell[], start: number, end: number): Cell[] {
  const output: Cell[] = [];
  let column = 0;

  for (const cell of line) {
    const nextColumn = column + cell.width;
    if (column >= start && nextColumn <= end) {
      output.push(cell);
    }

    column = nextColumn;
  }

  return output;
}

function ellipsis(style = semanticTextStyleToCellStyle(emptySemanticTextStyle)): Cell {
  return createCell("…", 1, style);
}

function cellStyleIntersection(left: Cell | undefined, right: Cell | undefined): Cell["style"] {
  if (!left) {
    return right?.style ?? semanticTextStyleToCellStyle(emptySemanticTextStyle);
  }

  if (!right) {
    return left.style;
  }

  return {
    ...(sameColor(left.style.foreground, right.style.foreground)
      ? { foreground: left.style.foreground }
      : {}),
    ...(sameColor(left.style.background, right.style.background)
      ? { background: left.style.background }
      : {}),
    ...(sameColor(left.style.underlineColor, right.style.underlineColor)
      ? { underlineColor: left.style.underlineColor }
      : {}),
    underline: left.style.underline === right.style.underline ? left.style.underline : "none",
    // eslint-disable-next-line no-bitwise
    attributes: left.style.attributes & right.style.attributes,
  };
}

function sameColor(left: Cell["style"]["foreground"], right: Cell["style"]["foreground"]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function lineWidth(line: readonly Cell[]): number {
  return line.reduce((width, cell) => width + cell.width, 0);
}

function appendNode(
  node: DOMNode,
  inherited: SemanticTextStyle,
  lines: SemanticCell[][],
  ansi: boolean,
): void {
  if (node.nodeName === "#text") {
    const text = sanitizeAnsi(node.nodeValue);
    if (ansi) appendAnsiText(text, inherited, lines);
    else appendText(text, inherited, lines);
    return;
  }

  if (node.isHidden) {
    return;
  }

  // Suspense hides nested text by flagging its virtual-text node.
  if (node.isHidden) {
    return;
  }

  const style = mergeSemanticTextStyles(inherited, node.internal_textStyle);
  const childAnsi = ansi || node.internal_ansi === true;
  for (const child of node.childNodes) {
    if (child.nodeName !== "#text" && child.internal_transform && !child.internal_textStyle) {
      appendTransformedNode(child, child.internal_transform, style, lines, childAnsi);
    } else {
      appendNode(child, style, lines, childAnsi);
    }
  }
}

// Nested transforms run before wrapping, like measurement, and receive each
// explicit line of their own subtree with its index.
function appendTransformedNode(
  node: DOMElement,
  transform: AnsiTransformer,
  inherited: SemanticTextStyle,
  lines: SemanticCell[][],
  ansi: boolean,
): void {
  const ownLines: SemanticCell[][] = [[]];
  appendNode(node, inherited, ownLines, ansi);

  if (ownLines.length === 1 && ownLines[0]!.length === 0) {
    return;
  }

  for (const [index, line] of ownLines.entries()) {
    if (index > 0) {
      lines.push([]);
    }

    const serialized = serializeLine(line, { colorProfile: "truecolor", trimEnd: false });
    for (const cell of cellsFromAnsi(transform(serialized, index))) {
      if (cell.grapheme === "\n" || cell.grapheme === "\r\n") {
        lines.push([]);
      } else {
        lines.at(-1)!.push(cell);
      }
    }
  }
}

function appendAnsiText(text: string, semantic: SemanticTextStyle, lines: SemanticCell[][]): void {
  const base = semanticTextStyleToCellStyle(semantic);
  for (const [index, cell] of cellsFromAnsi(text).entries()) {
    if (cell.grapheme === "\n" || cell.grapheme === "\r\n") {
      lines.push([]);
      continue;
    }

    if (attachMarks(lines.at(-1)!, cell.grapheme, index === 0)) {
      continue;
    }
    if (isInvisible(cell.grapheme)) continue;

    const hasForeground = cell.style.foreground !== undefined;
    const hasBackground = cell.style.background !== undefined;
    lines.at(-1)!.push({
      ...cell,
      style: {
        ...((cell.style.foreground ?? base.foreground)
          ? { foreground: cell.style.foreground ?? base.foreground }
          : {}),
        ...((cell.style.background ?? base.background)
          ? { background: cell.style.background ?? base.background }
          : {}),
        ...(cell.style.underlineColor ? { underlineColor: cell.style.underlineColor } : {}),
        underline: cell.style.underline === "none" ? base.underline : cell.style.underline,
        // eslint-disable-next-line no-bitwise
        attributes: base.attributes | cell.style.attributes,
      },
      ...(!hasForeground && semantic.foreground ? { foregroundPaint: semantic.foreground } : {}),
      ...(!hasBackground && semantic.background ? { backgroundPaint: semantic.background } : {}),
    });
  }
}

// Standalone invisible characters (e.g. zero-width spaces) measure as zero
// columns, so they must not occupy a terminal cell either.
const isInvisible = (grapheme: string): boolean =>
  /^\p{Default_Ignorable_Code_Point}+$/u.test(grapheme);

function appendText(text: string, style: SemanticTextStyle, lines: SemanticCell[][]): void {
  const cellStyle = semanticTextStyleToCellStyle(style);

  const plainText = tokenizeAnsi(text)
    .filter((token) => token.type === "text")
    .map((token) => token.value)
    .join("");
  for (const [index, segment] of [...graphemes(stripAnsi(plainText))].entries()) {
    if (segment === "\n" || segment === "\r\n") {
      lines.push([]);
      continue;
    }

    if (attachMarks(lines.at(-1)!, segment, index === 0)) {
      continue;
    }
    if (isInvisible(segment)) continue;

    lines.at(-1)!.push({
      ...createCell(
        segment,
        Math.max(1, stringWidth(segment)),
        cellStyle,
        undefined,
        style.resetForeground || style.resetBackground
          ? { foreground: style.resetForeground, background: style.resetBackground }
          : undefined,
      ),
      ...(style.foreground ? { foregroundPaint: style.foreground } : {}),
      ...(style.background ? { backgroundPaint: style.background } : {}),
    });
  }
}

const leadingMarkRegex = /^\p{Mark}/u;

// A text node can start with combining marks or other grapheme extenders that
// belong to the previous node's last character. They join that cell and keep
// its style, as they would in a terminal. Marks with no base to join can't
// occupy a cell of their own, so they are dropped.
function attachMarks(line: SemanticCell[], segment: string, isFirstSegment: boolean): boolean {
  const previous = line.at(-1);
  if (isFirstSegment && previous) {
    const joined = previous.grapheme + segment;
    if ([...graphemes(joined)].length === 1) {
      line[line.length - 1] = {
        ...previous,
        grapheme: joined,
        width: Math.max(1, stringWidth(joined)),
      };
      return true;
    }
  }

  return leadingMarkRegex.test(segment);
}
