// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

// Port of yoga/algorithm/FlexLine.h and yoga/algorithm/FlexLine.cpp.
//
// The C++ version advances a shared LayoutableChildren iterator; here the
// caller materializes the layout children into an array once and this function
// receives the start index, returning the index of the first child of the next
// line alongside the line itself.

import { boundAxisWithinMinAndMax, resolveDirection } from "#/yoga/core/helpers.ts";
import type { Node } from "#/yoga/core/node.ts";
import { Direction, Display, PositionType, Wrap } from "#/yoga/generated/YGEnums.ts";

export interface FlexLineRunningLayout {
  // Total flex grow factors of flex items which are to be laid in the current
  // line. This is decremented as free space is distributed.
  totalFlexGrowFactors: number;

  // Total flex shrink factors of flex items which are to be laid in the
  // current line. This is decremented as free space is distributed.
  totalFlexShrinkScaledFactors: number;

  // The amount of available space within inner dimensions of the line which
  // may still be distributed.
  remainingFreeSpace: number;

  // The size of the mainDim for the row after considering size, padding,
  // margin and border of flex items. This is used to calculate maxLineDim
  // after going through all the rows to decide on the main axis size of owner.
  mainDim: number;

  // The size of the crossDim for the row after considering size, padding,
  // margin and border of flex items. Used for calculating containers
  // crossSize.
  crossDim: number;
}

export interface FlexLine {
  // List of children which are part of the line flow. This means they are not
  // positioned absolutely, or with `display: "none"`, and do not overflow the
  // available dimensions.
  itemsInFlow: Node[];

  // Accumulation of the dimensions and margin of all the children on the
  // current line. This will be used in order to either set the dimensions of
  // the node if none already exist or to compute the remaining space left for
  // the flexible children.
  sizeConsumed: number;

  // Number of edges along the line flow with an auto margin.
  numberOfAutoMargins: number;

  // Index into the layout-children array of the first child of the next line.
  endIndex: number;

  // Layout information about the line computed in steps after line-breaking
  layout: FlexLineRunningLayout;
}

// Calculates where a line starting at a given index should break, returning
// information about the collective children on the line.
//
// This function assumes that all the children of node have their
// computedFlexBasis properly computed (to do this use the
// computeFlexBasisForChildren function).
export function calculateFlexLine(
  node: Node,
  ownerDirection: Direction,
  ownerWidth: number,
  mainAxisOwnerSize: number,
  availableInnerWidth: number,
  availableInnerMainDim: number,
  layoutChildren: readonly Node[],
  startIndex: number,
  lineCount: number,
  flexLine: FlexLine,
): void {
  const itemsInFlow = flexLine.itemsInFlow;
  itemsInFlow.length = 0;

  let sizeConsumed = 0;
  let totalFlexGrowFactors = 0;
  let totalFlexShrinkScaledFactors = 0;
  let numberOfAutoMargins = 0;
  let firstElementInLine: Node | null = null;

  let sizeConsumedIncludingMinConstraint = 0;
  const direction = node.resolveDirection(ownerDirection);
  const mainAxis = resolveDirection(node.style.flexDirection(), direction);
  const isNodeFlexWrap = node.style.flexWrap() !== Wrap.NoWrap;
  const gap = node.style.computeGapForAxis(mainAxis, availableInnerMainDim);

  let index = startIndex;
  // Add items to the current line until it's full or we run out of items.
  for (; index < layoutChildren.length; index++) {
    const child = layoutChildren[index]!;
    if (
      child.style.display() === Display.None ||
      child.style.positionType() === PositionType.Absolute
    ) {
      continue;
    }

    if (firstElementInLine === null) {
      firstElementInLine = child;
    }

    if (child.style.flexStartMarginIsAuto(mainAxis, ownerDirection)) {
      numberOfAutoMargins++;
    }
    if (child.style.flexEndMarginIsAuto(mainAxis, ownerDirection)) {
      numberOfAutoMargins++;
    }

    child.lineIndex = lineCount;
    const childMarginMainAxis = child.style.computeMarginForAxis(mainAxis, availableInnerWidth);
    const childLeadingGapMainAxis = child === firstElementInLine ? 0 : gap;
    const flexBasisWithMinAndMaxConstraints = boundAxisWithinMinAndMax(
      child,
      direction,
      mainAxis,
      child.layout.computedFlexBasis,
      mainAxisOwnerSize,
      ownerWidth,
    );

    // If this is a multi-line flow and this item pushes us over the available
    // size, we've hit the end of the current line. Break out of the loop and
    // lay out the current line.
    if (
      sizeConsumedIncludingMinConstraint +
        flexBasisWithMinAndMaxConstraints +
        childMarginMainAxis +
        childLeadingGapMainAxis >
        availableInnerMainDim &&
      isNodeFlexWrap &&
      itemsInFlow.length > 0
    ) {
      break;
    }

    sizeConsumedIncludingMinConstraint +=
      flexBasisWithMinAndMaxConstraints + childMarginMainAxis + childLeadingGapMainAxis;
    sizeConsumed +=
      flexBasisWithMinAndMaxConstraints + childMarginMainAxis + childLeadingGapMainAxis;

    if (child.isNodeFlexible()) {
      totalFlexGrowFactors += child.resolveFlexGrow();

      // Unlike the grow factor, the shrink factor is scaled relative to the
      // child dimension.
      totalFlexShrinkScaledFactors += -child.resolveFlexShrink() * child.layout.computedFlexBasis;
    }

    itemsInFlow.push(child);
  }

  // The total flex factor needs to be floored to 1.
  if (totalFlexGrowFactors > 0 && totalFlexGrowFactors < 1) {
    totalFlexGrowFactors = 1;
  }

  // The total flex shrink factor needs to be floored to 1.
  if (totalFlexShrinkScaledFactors > 0 && totalFlexShrinkScaledFactors < 1) {
    totalFlexShrinkScaledFactors = 1;
  }

  flexLine.sizeConsumed = sizeConsumed;
  flexLine.numberOfAutoMargins = numberOfAutoMargins;
  flexLine.endIndex = index;
  flexLine.layout.totalFlexGrowFactors = totalFlexGrowFactors;
  flexLine.layout.totalFlexShrinkScaledFactors = totalFlexShrinkScaledFactors;
  flexLine.layout.remainingFreeSpace = 0;
  flexLine.layout.mainDim = 0;
  flexLine.layout.crossDim = 0;
}
