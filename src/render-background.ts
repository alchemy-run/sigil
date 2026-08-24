import { samplePaint } from "#/color/sample.ts";
import { type DOMNode } from "#/dom.ts";
import type { Canvas } from "#/screen/canvas.ts";
import { cellAttributes, createCell } from "#/screen/index.ts";

export const renderBackground = (x: number, y: number, node: DOMNode, output: Canvas): void => {
  if (node.style.backgroundColor === undefined) {
    return;
  }

  const width = node.yogaNode!.getComputedWidth();
  const height = node.yogaNode!.getComputedHeight();

  // Calculate the actual content area considering borders
  const leftBorderWidth = node.style.borderStyle && node.style.borderLeft !== false ? 1 : 0;
  const rightBorderWidth = node.style.borderStyle && node.style.borderRight !== false ? 1 : 0;
  const topBorderHeight = node.style.borderStyle && node.style.borderTop !== false ? 1 : 0;
  const bottomBorderHeight = node.style.borderStyle && node.style.borderBottom !== false ? 1 : 0;

  const contentWidth = width - leftBorderWidth - rightBorderWidth;
  const contentHeight = height - topBorderHeight - bottomBorderHeight;

  if (!(contentWidth > 0 && contentHeight > 0)) {
    return;
  }

  const bounds = {
    x: x + leftBorderWidth,
    y: y + topBorderHeight,
    width: contentWidth,
    height: contentHeight,
  };
  const lines = Array.from({ length: contentHeight }, (_unused, row) =>
    Array.from({ length: contentWidth }, (_empty, column) => {
      const resetBackground = node.style.backgroundColor === "";
      const background = resetBackground
        ? undefined
        : samplePaint(
            node.style.backgroundColor!,
            bounds.x + column,
            bounds.y + row,
            bounds,
            output.paintContext,
          );
      return createCell(
        " ",
        1,
        {
          ...(background ? { background } : {}),
          underline: "none",
          attributes: cellAttributes.none,
        },
        undefined,
        resetBackground ? { background: true } : undefined,
      );
    }),
  );
  output.writeCells(bounds.x, bounds.y, lines);
};
