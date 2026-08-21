// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

// Port of yoga/algorithm/FlexDirection.h, yoga/algorithm/Align.h,
// yoga/algorithm/SizingMode.h, yoga/algorithm/TrailingPosition.h and
// yoga/algorithm/BoundAxis.h, plus the internal PhysicalEdge enum.

import {
  Align,
  Dimension,
  Direction,
  Display,
  FlexDirection,
  Justify,
  MeasureMode,
} from "../generated/YGEnums.ts";
import type { Node } from "./node.ts";
import { maxOrDefined } from "./numeric.ts";

export const PhysicalEdge = {
  Left: 0,
  Top: 1,
  Right: 2,
  Bottom: 3,
} as const;
export type PhysicalEdge = (typeof PhysicalEdge)[keyof typeof PhysicalEdge];

// Port of yoga/algorithm/SizingMode.h
export const SizingMode = {
  StretchFit: 0,
  MaxContent: 1,
  FitContent: 2,
} as const;
export type SizingMode = (typeof SizingMode)[keyof typeof SizingMode];

export function measureMode(mode: SizingMode): MeasureMode {
  switch (mode) {
    case SizingMode.StretchFit:
      return MeasureMode.Exactly;
    case SizingMode.MaxContent:
      return MeasureMode.Undefined;
    case SizingMode.FitContent:
      return MeasureMode.AtMost;
  }
}

export function sizingMode(mode: MeasureMode): SizingMode {
  switch (mode) {
    case MeasureMode.Exactly:
      return SizingMode.StretchFit;
    case MeasureMode.Undefined:
      return SizingMode.MaxContent;
    case MeasureMode.AtMost:
      return SizingMode.FitContent;
  }
}

// Port of yoga/algorithm/FlexDirection.h

export function isRow(flexDirection: FlexDirection): boolean {
  return (flexDirection & FlexDirection.Row) !== 0;
}

export function isColumn(flexDirection: FlexDirection): boolean {
  return (flexDirection & FlexDirection.Row) === 0;
}

export function resolveDirection(
  flexDirection: FlexDirection,
  direction: Direction,
): FlexDirection {
  if (direction === Direction.RTL) {
    if (flexDirection === FlexDirection.Row) {
      return FlexDirection.RowReverse;
    } else if (flexDirection === FlexDirection.RowReverse) {
      return FlexDirection.Row;
    }
  }

  return flexDirection;
}

export function resolveCrossDirection(
  flexDirection: FlexDirection,
  direction: Direction,
): FlexDirection {
  return isColumn(flexDirection)
    ? resolveDirection(FlexDirection.Row, direction)
    : FlexDirection.Column;
}

// Table-lookup forms of the per-axis switches, indexed by FlexDirection
// (Column, ColumnReverse, Row, RowReverse).
const FLEX_START_EDGE = [
  PhysicalEdge.Top,
  PhysicalEdge.Bottom,
  PhysicalEdge.Left,
  PhysicalEdge.Right,
] as const;

const FLEX_END_EDGE = [
  PhysicalEdge.Bottom,
  PhysicalEdge.Top,
  PhysicalEdge.Right,
  PhysicalEdge.Left,
] as const;

const DIMENSION_OF_AXIS = [
  Dimension.Height,
  Dimension.Height,
  Dimension.Width,
  Dimension.Width,
] as const;

export function flexStartEdge(flexDirection: FlexDirection): PhysicalEdge {
  return FLEX_START_EDGE[flexDirection];
}

export function flexEndEdge(flexDirection: FlexDirection): PhysicalEdge {
  return FLEX_END_EDGE[flexDirection];
}

export function inlineStartEdge(flexDirection: FlexDirection, direction: Direction): PhysicalEdge {
  if (isRow(flexDirection)) {
    return direction === Direction.RTL ? PhysicalEdge.Right : PhysicalEdge.Left;
  }

  return PhysicalEdge.Top;
}

export function inlineEndEdge(flexDirection: FlexDirection, direction: Direction): PhysicalEdge {
  if (isRow(flexDirection)) {
    return direction === Direction.RTL ? PhysicalEdge.Left : PhysicalEdge.Right;
  }

  return PhysicalEdge.Bottom;
}

export function dimension(flexDirection: FlexDirection): Dimension {
  return DIMENSION_OF_AXIS[flexDirection];
}

// Port of yoga/algorithm/Align.h

export function resolveChildAlignment(node: Node, child: Node): Align {
  const align =
    child.style.alignSelf() === Align.Auto ? node.style.alignItems() : child.style.alignSelf();

  if (
    node.style.display() === Display.Flex &&
    align === Align.Baseline &&
    isColumn(node.style.flexDirection())
  ) {
    return Align.FlexStart;
  }

  return align;
}

export function resolveChildJustification(node: Node, child: Node): Justify {
  return child.style.justifySelf() === Justify.Auto
    ? node.style.justifyItems()
    : child.style.justifySelf();
}

/**
 * Fallback alignment to use on overflow
 * https://www.w3.org/TR/css-align-3/#distribution-values
 */
export function fallbackAlignment(align: Align): Align {
  switch (align) {
    // Fallback to flex-start
    case Align.SpaceBetween:
    case Align.Stretch:
      return Align.FlexStart;

    // Fallback to safe center. TODO (T208209388): This should be aligned to
    // Start instead of FlexStart (for row-reverse containers)
    case Align.SpaceAround:
    case Align.SpaceEvenly:
      return Align.FlexStart;
    default:
      return align;
  }
}

export function fallbackJustification(align: Justify): Justify {
  switch (align) {
    // Fallback to flex-start
    case Justify.SpaceBetween:
      return Justify.FlexStart;

    // Fallback to safe center. TODO (T208209388): This should be aligned to
    // Start instead of FlexStart (for row-reverse containers)
    case Justify.SpaceAround:
    case Justify.SpaceEvenly:
      return Justify.FlexStart;
    default:
      return align;
  }
}

// Port of yoga/algorithm/BoundAxis.h

export function paddingAndBorderForAxis(
  node: Node,
  axis: FlexDirection,
  direction: Direction,
  widthSize: number,
): number {
  if (!node.style.hasPaddingOrBorder()) {
    return 0;
  }
  return (
    node.style.computeInlineStartPaddingAndBorder(axis, direction, widthSize) +
    node.style.computeInlineEndPaddingAndBorder(axis, direction, widthSize)
  );
}

export function boundAxisWithinMinAndMax(
  node: Node,
  direction: Direction,
  axis: FlexDirection,
  value: number,
  axisSize: number,
  widthSize: number,
): number {
  let min = NaN;
  let max = NaN;

  if (isColumn(axis)) {
    min = node.style.resolvedMinDimension(direction, Dimension.Height, axisSize, widthSize);
    max = node.style.resolvedMaxDimension(direction, Dimension.Height, axisSize, widthSize);
  } else if (isRow(axis)) {
    min = node.style.resolvedMinDimension(direction, Dimension.Width, axisSize, widthSize);
    max = node.style.resolvedMaxDimension(direction, Dimension.Width, axisSize, widthSize);
  }

  if (max >= 0 && value > max) {
    return max;
  }

  if (min >= 0 && value < min) {
    return min;
  }

  return value;
}

// Like boundAxisWithinMinAndMax but also ensures that the value doesn't
// go below the padding and border amount.
export function boundAxis(
  node: Node,
  axis: FlexDirection,
  direction: Direction,
  value: number,
  axisSize: number,
  widthSize: number,
): number {
  return maxOrDefined(
    boundAxisWithinMinAndMax(node, direction, axis, value, axisSize, widthSize),
    paddingAndBorderForAxis(node, axis, direction, widthSize),
  );
}

// Port of yoga/algorithm/TrailingPosition.h

// Given an offset to an edge, returns the offset to the opposite edge on the
// same axis. This assumes that the width/height of both nodes is determined at
// this point.
export function getPositionOfOppositeEdge(
  position: number,
  axis: FlexDirection,
  containingNode: Node,
  node: Node,
): number {
  return (
    containingNode.layout.measuredDimension(dimension(axis)) -
    node.layout.measuredDimension(dimension(axis)) -
    position
  );
}

export function setChildTrailingPosition(node: Node, child: Node, axis: FlexDirection): void {
  child.setLayoutPosition(
    getPositionOfOppositeEdge(child.layout.position(flexStartEdge(axis)), axis, node, child),
    flexEndEdge(axis),
  );
}

export function needsTrailingPosition(axis: FlexDirection): boolean {
  return axis === FlexDirection.RowReverse || axis === FlexDirection.ColumnReverse;
}
