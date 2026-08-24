import { graphemes } from "#/ansi/graphemes.ts";
import { stringWidth } from "#/ansi/string-width.ts";
import type { Paint, PaintContext } from "#/color/paint.ts";
import { samplePaint } from "#/color/sample.ts";
import { type DOMNode } from "#/dom.ts";
import { BOXES } from "#/glyphs.ts";
import type { Canvas } from "#/screen/canvas.ts";
import type { Rect } from "#/screen/geometry.ts";
import { cellAttributes, createCell, type Cell } from "#/screen/index.ts";

const stylePiece = (
  segment: string,
  x: number,
  y: number,
  bounds: Rect,
  context: PaintContext,
  fg?: Paint,
  bg?: Paint,
  dim?: boolean,
): Cell[] => {
  let column = x;
  return [...graphemes(segment)].map((grapheme) => {
    const foreground = fg ? samplePaint(fg, column, y, bounds, context) : undefined;
    const background = bg ? samplePaint(bg, column, y, bounds, context) : undefined;
    const width = Math.max(1, stringWidth(grapheme));
    column += width;
    return createCell(grapheme, width, {
      ...(foreground ? { foreground } : {}),
      ...(background ? { background } : {}),
      underline: "none",
      attributes: dim ? cellAttributes.faint : cellAttributes.none,
    });
  });
};

export const renderBorder = (x: number, y: number, node: DOMNode, output: Canvas): void => {
  if (node.style.borderStyle) {
    const width = node.yogaNode!.getComputedWidth();
    const height = node.yogaNode!.getComputedHeight();
    const bounds = { x, y, width, height };
    const box =
      typeof node.style.borderStyle === "string"
        ? BOXES[node.style.borderStyle]
        : node.style.borderStyle;

    const topBorderColor = node.style.borderTopColor ?? node.style.borderColor;
    const bottomBorderColor = node.style.borderBottomColor ?? node.style.borderColor;
    const leftBorderColor = node.style.borderLeftColor ?? node.style.borderColor;
    const rightBorderColor = node.style.borderRightColor ?? node.style.borderColor;

    const topBorderBackgroundColor =
      node.style.borderTopBackgroundColor ?? node.style.borderBackgroundColor;
    const bottomBorderBackgroundColor =
      node.style.borderBottomBackgroundColor ?? node.style.borderBackgroundColor;
    const leftBorderBackgroundColor =
      node.style.borderLeftBackgroundColor ?? node.style.borderBackgroundColor;
    const rightBorderBackgroundColor =
      node.style.borderRightBackgroundColor ?? node.style.borderBackgroundColor;

    const dimTopBorderColor = node.style.borderTopDimColor ?? node.style.borderDimColor;

    const dimBottomBorderColor = node.style.borderBottomDimColor ?? node.style.borderDimColor;

    const dimLeftBorderColor = node.style.borderLeftDimColor ?? node.style.borderDimColor;

    const dimRightBorderColor = node.style.borderRightDimColor ?? node.style.borderDimColor;

    const showTopBorder = node.style.borderTop !== false;
    const showBottomBorder = node.style.borderBottom !== false;
    const showLeftBorder = node.style.borderLeft !== false;
    const showRightBorder = node.style.borderRight !== false;

    const contentWidth = width - (showLeftBorder ? 1 : 0) - (showRightBorder ? 1 : 0);

    const topBorder = showTopBorder
      ? (showLeftBorder ? box.topLeft : "") +
        box.top.repeat(contentWidth) +
        (showRightBorder ? box.topRight : "")
      : undefined;

    let verticalBorderHeight = height;

    if (showTopBorder) {
      verticalBorderHeight -= 1;
    }

    if (showBottomBorder) {
      verticalBorderHeight -= 1;
    }

    const offsetY = showTopBorder ? 1 : 0;

    const bottomBorder = showBottomBorder
      ? (showLeftBorder ? box.bottomLeft : "") +
        box.bottom.repeat(contentWidth) +
        (showRightBorder ? box.bottomRight : "")
      : undefined;

    if (topBorder) {
      output.writeCells(x, y, [
        stylePiece(
          topBorder,
          x,
          y,
          bounds,
          output.paintContext,
          topBorderColor,
          topBorderBackgroundColor,
          dimTopBorderColor,
        ),
      ]);
    }

    if (showLeftBorder) {
      output.writeCells(
        x,
        y + offsetY,
        Array.from({ length: verticalBorderHeight }, (_, row) =>
          stylePiece(
            box.left,
            x,
            y + offsetY + row,
            bounds,
            output.paintContext,
            leftBorderColor,
            leftBorderBackgroundColor,
            dimLeftBorderColor,
          ),
        ),
      );
    }

    if (showRightBorder) {
      output.writeCells(
        x + width - 1,
        y + offsetY,
        Array.from({ length: verticalBorderHeight }, (_, row) =>
          stylePiece(
            box.right,
            x + width - 1,
            y + offsetY + row,
            bounds,
            output.paintContext,
            rightBorderColor,
            rightBorderBackgroundColor,
            dimRightBorderColor,
          ),
        ),
      );
    }

    if (bottomBorder) {
      output.writeCells(x, y + height - 1, [
        stylePiece(
          bottomBorder,
          x,
          y + height - 1,
          bounds,
          output.paintContext,
          bottomBorderColor,
          bottomBorderBackgroundColor,
          dimBottomBorderColor,
        ),
      ]);
    }
  }
};
