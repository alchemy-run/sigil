// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

// Port of yoga/algorithm/Baseline.cpp.

import { PhysicalEdge, isColumn, resolveChildAlignment } from "#/yoga/core/helpers.ts";
import type { Node } from "#/yoga/core/node.ts";
import { Align, Dimension, PositionType } from "#/yoga/generated/YGEnums.ts";

export function calculateBaseline(node: Node): number {
  if (node.hasBaselineFunc()) {
    const baseline = node.baseline(
      node.layout.measuredDimension(Dimension.Width),
      node.layout.measuredDimension(Dimension.Height),
    );

    if (Number.isNaN(baseline)) {
      throw new Error("Expect custom baseline function to not return NaN");
    }
    return baseline;
  }

  let baselineChild: Node | null = null;
  for (const child of node.getLayoutChildren()) {
    if (child.lineIndex > 0) {
      break;
    }
    if (child.style.positionType() === PositionType.Absolute) {
      continue;
    }
    if (resolveChildAlignment(node, child) === Align.Baseline || child.isReferenceBaseline_) {
      baselineChild = child;
      break;
    }

    if (baselineChild === null) {
      baselineChild = child;
    }
  }

  if (baselineChild === null) {
    return node.layout.measuredDimension(Dimension.Height);
  }

  const baseline = calculateBaseline(baselineChild);
  return baseline + baselineChild.layout.position(PhysicalEdge.Top);
}

export function isBaselineLayout(node: Node): boolean {
  if (isColumn(node.style.flexDirection())) {
    return false;
  }
  if (node.style.alignItems() === Align.Baseline) {
    return true;
  }
  for (const child of node.getLayoutChildren()) {
    if (
      child.style.positionType() !== PositionType.Absolute &&
      child.style.alignSelf() === Align.Baseline
    ) {
      return true;
    }
  }

  return false;
}
