import { tokenizeAnsi } from "#/ansi-tokenizer.ts";
import { graphemes } from "#/ansi/graphemes.ts";
import { stringWidth } from "#/ansi/string-width.ts";
import { stripAnsi } from "#/ansi/strip.ts";
import { samplePaint, type PaintContext } from "#/color/index.ts";
import type { Paint } from "#/color/paint.ts";
import type { DOMElement, DOMNode } from "#/dom.ts";
import { createCell, type Cell, type CellStyle } from "#/screen/cell.ts";
import type { Rect } from "#/screen/geometry.ts";
import {
  emptySemanticTextStyle,
  mergeSemanticTextStyles,
  semanticTextStyleToCellStyle,
  type SemanticTextStyle,
} from "#/semantic-text-style.ts";
import type { Styles } from "#/styles.ts";

type SemanticCell = Cell & {
  readonly foregroundPaint?: Paint;
  readonly backgroundPaint?: Paint;
};

/** Whether a text subtree must retain the ANSI compatibility pipeline. */
export function hasCompatibilityText(node: DOMElement): boolean {
  if (node.internal_transform && !node.internal_textStyle) {
    return true;
  }

  return node.childNodes.some((child) => child.nodeName !== "#text" && hasCompatibilityText(child));
}

/** Rasterizes an unwrapped native Text subtree into semantic cell lines. */
export function structuredTextLines(node: DOMElement): readonly (readonly SemanticCell[])[] {
  const lines: SemanticCell[][] = [[]];
  appendNode(node, emptySemanticTextStyle, lines);
  return lines;
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
  if (maxWidth < 1) {
    return [[]];
  }

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

function appendNode(node: DOMNode, inherited: SemanticTextStyle, lines: SemanticCell[][]): void {
  if (node.nodeName === "#text") {
    appendText(node.nodeValue, inherited, lines);
    return;
  }

  const style = mergeSemanticTextStyles(inherited, node.internal_textStyle);
  for (const child of node.childNodes) {
    appendNode(child, style, lines);
  }
}

function appendText(text: string, style: SemanticTextStyle, lines: SemanticCell[][]): void {
  const cellStyle = semanticTextStyleToCellStyle(style);

  const plainText = tokenizeAnsi(text)
    .filter((token) => token.type === "text")
    .map((token) => token.value)
    .join("");
  for (const segment of graphemes(stripAnsi(plainText))) {
    if (segment === "\n" || segment === "\r\n") {
      lines.push([]);
      continue;
    }

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
