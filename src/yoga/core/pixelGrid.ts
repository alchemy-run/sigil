// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

// Port of yoga/algorithm/PixelGrid.cpp.

import { Dimension, NodeType } from "../generated/YGEnums.ts";
import { PhysicalEdge } from "./helpers.ts";
import type { Node } from "./node.ts";
import { inexactEquals } from "./numeric.ts";

export function roundValueToPixelGrid(
  value: number,
  pointScaleFactor: number,
  forceCeil: boolean,
  forceFloor: boolean,
): number {
  if (pointScaleFactor === 1 && Number.isInteger(value)) {
    return value === 0 ? 0 : value;
  }
  let scaledValue = value * pointScaleFactor;
  // We want to calculate `fractial` such that `floor(scaledValue) = scaledValue
  // - fractial`. For negative values, adding 1 to fmod's result gives us this.
  let fractial = scaledValue % 1.0;
  if (fractial < 0) {
    ++fractial;
  }
  // The epsilon comparisons below are the inexactEquals checks from the C++
  // inlined for the known ranges (fractial is in [0, 1) or NaN; NaN falls
  // through every comparison to the final +0 branch).
  if (fractial < 0.0001) {
    // First we check if the value is already rounded
    scaledValue = scaledValue - fractial;
  } else if (fractial - 1.0 > -0.0001) {
    scaledValue = scaledValue - fractial + 1.0;
  } else if (forceCeil) {
    // Next we check if we need to use forced rounding
    scaledValue = scaledValue - fractial + 1.0;
  } else if (forceFloor) {
    scaledValue = scaledValue - fractial;
  } else {
    // Finally we just round the value (half-up, with the 0.5 comparison
    // itself subject to the epsilon).
    scaledValue = scaledValue - fractial + (fractial - 0.5 > -0.0001 ? 1.0 : 0.0);
  }
  return Number.isNaN(scaledValue) || Number.isNaN(pointScaleFactor)
    ? NaN
    : scaledValue / pointScaleFactor;
}

export function roundLayoutResultsToPixelGrid(
  node: Node,
  absoluteLeft: number,
  absoluteTop: number,
): void {
  const layout = node.layout;
  const pointScaleFactor = node.config.getPointScaleFactor();

  // Skip subtrees whose inputs are identical to the previous pass: no layout
  // write anywhere below (roundingDirty), the same absolute offset, and the
  // same point scale. The pass is a deterministic function of those inputs,
  // so re-running it would reproduce the stored values exactly.
  if (
    !layout.roundingDirty &&
    layout.roundedAbsLeft === absoluteLeft &&
    layout.roundedAbsTop === absoluteTop &&
    layout.roundedScale === pointScaleFactor
  ) {
    return;
  }
  layout.roundedAbsLeft = absoluteLeft;
  layout.roundedAbsTop = absoluteTop;
  layout.roundedScale = pointScaleFactor;
  layout.roundingDirty = false;

  const nodeLeft = layout.position(PhysicalEdge.Left);
  const nodeTop = layout.position(PhysicalEdge.Top);

  const nodeWidth = layout.dimension(Dimension.Width);
  const nodeHeight = layout.dimension(Dimension.Height);

  const absoluteNodeLeft = absoluteLeft + nodeLeft;
  const absoluteNodeTop = absoluteTop + nodeTop;

  const absoluteNodeRight = absoluteNodeLeft + nodeWidth;
  const absoluteNodeBottom = absoluteNodeTop + nodeHeight;

  if (pointScaleFactor !== 0) {
    // If a node has a custom measure function we never want to round down its
    // size as this could lead to unwanted text truncation.
    const textRounding = node.nodeType === NodeType.Text;

    // Written directly to the layout (not via Node.setLayoutPosition) so the
    // pass's own writes do not re-mark the subtree as rounding-dirty.
    layout.setPosition(
      PhysicalEdge.Left,
      roundValueToPixelGrid(nodeLeft, pointScaleFactor, false, textRounding),
    );

    layout.setPosition(
      PhysicalEdge.Top,
      roundValueToPixelGrid(nodeTop, pointScaleFactor, false, textRounding),
    );

    // We multiply dimension by scale factor and if the result is close to the
    // whole number, we don't have any fraction. To verify if the result is
    // close to whole number we want to check both floor and ceil numbers.
    const scaledNodeWidth = nodeWidth * pointScaleFactor;
    const hasFractionalWidth = !inexactEquals(Math.round(scaledNodeWidth), scaledNodeWidth);

    const scaledNodeHeight = nodeHeight * pointScaleFactor;
    const hasFractionalHeight = !inexactEquals(Math.round(scaledNodeHeight), scaledNodeHeight);

    node.layout.setDimension(
      Dimension.Width,
      roundValueToPixelGrid(
        absoluteNodeRight,
        pointScaleFactor,
        textRounding && hasFractionalWidth,
        textRounding && !hasFractionalWidth,
      ) - roundValueToPixelGrid(absoluteNodeLeft, pointScaleFactor, false, textRounding),
    );

    node.layout.setDimension(
      Dimension.Height,
      roundValueToPixelGrid(
        absoluteNodeBottom,
        pointScaleFactor,
        textRounding && hasFractionalHeight,
        textRounding && !hasFractionalHeight,
      ) - roundValueToPixelGrid(absoluteNodeTop, pointScaleFactor, false, textRounding),
    );
  }

  roundChildren(node, absoluteNodeLeft, absoluteNodeTop);
}

// Recurse into children, checking the skip condition at the call site to
// avoid the function-call overhead for clean subtrees.
function roundChildren(node: Node, absoluteNodeLeft: number, absoluteNodeTop: number): void {
  for (const child of node.children) {
    const childLayout = child.layout;
    if (
      childLayout.roundingDirty ||
      childLayout.roundedAbsLeft !== absoluteNodeLeft ||
      childLayout.roundedAbsTop !== absoluteNodeTop ||
      childLayout.roundedScale !== child.config.getPointScaleFactor()
    ) {
      roundLayoutResultsToPixelGrid(child, absoluteNodeLeft, absoluteNodeTop);
    }
  }
}
