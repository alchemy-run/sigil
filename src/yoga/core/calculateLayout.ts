// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

// Port of yoga/algorithm/CalculateLayout.cpp. The event system and
// LayoutPassReason-keyed instrumentation are reduced to plain counters.

import { layoutAbsoluteDescendants } from "#/yoga/core/absoluteLayout.ts";
import { calculateBaseline, isBaselineLayout } from "#/yoga/core/baseline.ts";
import { canUseCachedMeasurement } from "#/yoga/core/cache.ts";
import { type FlexLine, calculateFlexLine } from "#/yoga/core/flexLine.ts";
import {
  PhysicalEdge,
  SizingMode,
  boundAxis,
  boundAxisWithinMinAndMax,
  dimension,
  fallbackAlignment,
  fallbackJustification,
  flexStartEdge,
  isColumn,
  isRow,
  measureMode,
  needsTrailingPosition,
  paddingAndBorderForAxis,
  resolveChildAlignment,
  resolveCrossDirection,
  resolveDirection,
  setChildTrailingPosition,
} from "#/yoga/core/helpers.ts";
import { CachedMeasurement, LayoutResults } from "#/yoga/core/layoutResults.ts";
import type { Node } from "#/yoga/core/node.ts";
import {
  isDefined,
  isUndefined,
  inexactEquals,
  maxOrDefined,
  minOrDefined,
} from "#/yoga/core/numeric.ts";
import { roundLayoutResultsToPixelGrid } from "#/yoga/core/pixelGrid.ts";
import type { Style } from "#/yoga/core/style.ts";
import type { StyleLength } from "#/yoga/core/types.ts";
import {
  Align,
  Dimension,
  Direction,
  Display,
  Edge,
  Errata,
  ExperimentalFeature,
  FlexDirection,
  Gutter,
  Justify,
  MeasureMode,
  Overflow,
  PositionType,
  Wrap,
} from "#/yoga/generated/YGEnums.ts";

export const LayoutPassReason = {
  Initial: 0,
  AbsLayout: 1,
  Stretch: 2,
  MultilineStretch: 3,
  FlexLayout: 4,
  MeasureChild: 5,
  AbsMeasureChild: 6,
  FlexMeasure: 7,
} as const;
export type LayoutPassReason = (typeof LayoutPassReason)[keyof typeof LayoutPassReason];

export interface LayoutData {
  layouts: number;
  measures: number;
  maxMeasureCache: number;
  cachedLayouts: number;
  cachedMeasures: number;
  measureCallbacks: number;
}

export function newLayoutData(): LayoutData {
  return {
    layouts: 0,
    measures: 0,
    maxMeasureCache: 0,
    cachedLayouts: 0,
    cachedMeasures: 0,
    measureCallbacks: 0,
  };
}

let gCurrentGenerationCount = 0;

function hasAutoHorizontalMargin(style: Style): boolean {
  for (const direction of [Direction.LTR, Direction.RTL]) {
    if (
      style.flexStartMarginIsAuto(FlexDirection.Row, direction) ||
      style.flexEndMarginIsAuto(FlexDirection.Row, direction)
    ) {
      return true;
    }
  }
  return false;
}

function isColumnStretchEdge(owner: Node | null, child: Node | null): boolean {
  if (owner === null || child === null) {
    return false;
  }
  const ownerStyle = owner.style;
  const childStyle = child.style;
  const childWidth = child.getProcessedDimension(Dimension.Width);
  return (
    ownerStyle.display() === Display.Flex &&
    isColumn(ownerStyle.flexDirection()) &&
    ownerStyle.flexWrap() === Wrap.NoWrap &&
    childStyle.positionType() !== PositionType.Absolute &&
    !isDefined(childStyle.aspectRatio()) &&
    (childWidth.isAuto() || childWidth.isUndefined()) &&
    !hasAutoHorizontalMargin(childStyle) &&
    resolveChildAlignment(owner, child) === Align.Stretch
  );
}

function isInColumnStretchScrollSubtree(node: Node): boolean {
  let current: Node | null = node;
  while (current !== null) {
    let owner: Node | null = current.owner;
    while (owner !== null && owner.style.display() === Display.Contents) {
      owner = owner.owner;
    }
    if (owner === null || !isColumnStretchEdge(owner, current)) {
      return false;
    }
    if (owner.style.overflow() === Overflow.Scroll) {
      return true;
    }
    current = owner;
  }
  return false;
}

function isNonZeroLength(length: StyleLength): boolean {
  return length.isAuto() || (isDefined(length.value) && length.value !== 0);
}

function hasNonZeroVerticalSpacing(style: Style): boolean {
  const verticalEdges = [Edge.Top, Edge.Bottom, Edge.Vertical, Edge.All];
  for (const edge of verticalEdges) {
    if (
      isNonZeroLength(style.margin(edge)) ||
      isNonZeroLength(style.padding(edge)) ||
      isNonZeroLength(style.border(edge))
    ) {
      return true;
    }
  }
  return false;
}

function hasPercentageLength(style: Style): boolean {
  const edges = [
    Edge.Left,
    Edge.Top,
    Edge.Right,
    Edge.Bottom,
    Edge.Start,
    Edge.End,
    Edge.Horizontal,
    Edge.Vertical,
    Edge.All,
  ];
  for (const edge of edges) {
    if (
      style.margin(edge).isPercent() ||
      style.position(edge).isPercent() ||
      style.padding(edge).isPercent() ||
      style.border(edge).isPercent()
    ) {
      return true;
    }
  }

  for (const dim of [Dimension.Width, Dimension.Height]) {
    if (
      style.dimension(dim).isPercent() ||
      style.minDimension(dim).isPercent() ||
      style.maxDimension(dim).isPercent()
    ) {
      return true;
    }
  }

  return (
    style.flexBasis().isPercent() ||
    style.gap(Gutter.Column).isPercent() ||
    style.gap(Gutter.Row).isPercent() ||
    style.gap(Gutter.All).isPercent()
  );
}

function hasNonZeroFlex(node: Node): boolean {
  const style = node.style;
  const flex = style.flex();
  const flexGrow = style.flexGrow();
  const flexShrink = style.flexShrink();
  const config = node.config;
  const canGrow = isDefined(flexGrow) ? flexGrow !== 0 : isDefined(flex) && flex > 0;
  const canShrink = isDefined(flexShrink)
    ? flexShrink !== 0
    : config.useWebDefaults() || (isDefined(flex) && flex < 0);
  return canGrow || canShrink;
}

function isHeightFitContentIndependent(node: Node): boolean {
  const style = node.style;
  const height = style.dimension(Dimension.Height);
  const flexBasis = style.flexBasis();
  const hasRelativePercentPosition =
    style.position(Edge.Top).isPercent() ||
    style.position(Edge.Bottom).isPercent() ||
    style.position(Edge.Vertical).isPercent() ||
    style.position(Edge.All).isPercent();
  return (
    !node.hasMeasureFunc() &&
    !node.hasBaselineFunc() &&
    !node.isReferenceBaseline_ &&
    (height.isAuto() || height.isUndefined()) &&
    style.minDimension(Dimension.Height).isUndefined() &&
    style.maxDimension(Dimension.Height).isUndefined() &&
    (flexBasis.isAuto() || flexBasis.isUndefined()) &&
    !hasNonZeroFlex(node) &&
    style.boxSizing() === 0 /* BoxSizing.BorderBox */ &&
    !isDefined(style.aspectRatio()) &&
    style.positionType() !== PositionType.Absolute &&
    style.overflow() !== Overflow.Scroll &&
    style.display() === Display.Flex &&
    isColumn(style.flexDirection()) &&
    style.alignItems() === Align.Stretch &&
    (style.alignSelf() === Align.Auto || style.alignSelf() === Align.Stretch) &&
    style.justifyContent() === Justify.FlexStart &&
    style.flexWrap() === Wrap.NoWrap &&
    !style.gap(Gutter.All).isDefined() &&
    !style.gap(Gutter.Row).isDefined() &&
    !hasRelativePercentPosition &&
    !hasNonZeroVerticalSpacing(style) &&
    !hasPercentageLength(style)
  );
}

function canSkipHeightFitContent(root: Node | null): boolean {
  if (root === null) {
    return false;
  }

  const maxPendingNodes = 64;
  const stack: Node[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (!isHeightFitContentIndependent(node)) {
      return false;
    }
    for (const child of node.getLayoutChildren()) {
      if (stack.length === maxPendingNodes) {
        return false;
      }
      stack.push(child);
    }
  }
  return true;
}

interface ModeAndSize {
  mode: SizingMode;
  size: number;
}

// Reusable in/out pairs for constrainMaxSizeForMode. Their values are always
// copied out before any recursion into calculateLayoutInternal, so a single
// pair per (width, height) role is safe despite the recursive algorithm.
const scratchModeA: ModeAndSize = { mode: SizingMode.StretchFit, size: 0 };
const scratchModeB: ModeAndSize = { mode: SizingMode.StretchFit, size: 0 };

export function constrainMaxSizeForMode(
  node: Node,
  direction: Direction,
  axis: FlexDirection,
  ownerAxisSize: number,
  ownerWidth: number,
  modeAndSize: ModeAndSize,
): void {
  const maxSize =
    node.style.resolvedMaxDimension(direction, dimension(axis), ownerAxisSize, ownerWidth) +
    node.style.computeMarginForAxis(axis, ownerWidth);
  switch (modeAndSize.mode) {
    case SizingMode.StretchFit:
    case SizingMode.FitContent:
      modeAndSize.size =
        isUndefined(maxSize) || modeAndSize.size < maxSize ? modeAndSize.size : maxSize;
      break;
    case SizingMode.MaxContent:
      if (isDefined(maxSize)) {
        modeAndSize.mode = SizingMode.FitContent;
        modeAndSize.size = maxSize;
      }
      break;
  }
}

function computeFlexBasisForChild(
  node: Node,
  child: Node,
  width: number,
  widthMode: SizingMode,
  height: number,
  ownerWidth: number,
  ownerHeight: number,
  heightMode: SizingMode,
  direction: Direction,
  layoutMarkerData: LayoutData,
  depth: number,
  generationCount: number,
): void {
  const mainAxis = resolveDirection(node.style.flexDirection(), direction);
  const isMainAxisRow = isRow(mainAxis);
  const mainAxisSize = isMainAxisRow ? width : height;
  const mainAxisOwnerSize = isMainAxisRow ? ownerWidth : ownerHeight;

  let childWidth = NaN;
  let childHeight = NaN;
  let childWidthSizingMode: SizingMode;
  let childHeightSizingMode: SizingMode;

  const resolvedFlexBasis = child.resolveFlexBasis(
    direction,
    mainAxis,
    mainAxisOwnerSize,
    ownerWidth,
  );
  const isRowStyleDimDefined = child.hasDefiniteLength(Dimension.Width, ownerWidth);
  const isColumnStyleDimDefined = child.hasDefiniteLength(Dimension.Height, ownerHeight);

  const fixFlexBasisFitContent = node.config.isExperimentalFeatureEnabled(
    ExperimentalFeature.FixFlexBasisFitContent,
  );

  const useResolvedFlexBasis = isDefined(resolvedFlexBasis) && isDefined(mainAxisSize);

  if (useResolvedFlexBasis) {
    if (
      isUndefined(child.layout.computedFlexBasis) ||
      (child.config.isExperimentalFeatureEnabled(ExperimentalFeature.WebFlexBasis) &&
        child.layout.computedFlexBasisGeneration !== generationCount)
    ) {
      const paddingAndBorder = paddingAndBorderForAxis(child, mainAxis, direction, ownerWidth);
      child.setLayoutComputedFlexBasis(maxOrDefined(resolvedFlexBasis, paddingAndBorder));
    }
  } else if (isMainAxisRow && isRowStyleDimDefined) {
    // The width is definite, so use that as the flex basis.
    const paddingAndBorder = paddingAndBorderForAxis(
      child,
      FlexDirection.Row,
      direction,
      ownerWidth,
    );

    child.setLayoutComputedFlexBasis(
      maxOrDefined(
        child.getResolvedDimension(direction, Dimension.Width, ownerWidth, ownerWidth),
        paddingAndBorder,
      ),
    );
  } else if (!isMainAxisRow && isColumnStyleDimDefined) {
    // The height is definite, so use that as the flex basis.
    const paddingAndBorder = paddingAndBorderForAxis(
      child,
      FlexDirection.Column,
      direction,
      ownerWidth,
    );
    child.setLayoutComputedFlexBasis(
      maxOrDefined(
        child.getResolvedDimension(direction, Dimension.Height, ownerHeight, ownerWidth),
        paddingAndBorder,
      ),
    );
  } else {
    // Compute the flex basis and hypothetical main size (i.e. the clamped flex
    // basis).
    childWidthSizingMode = SizingMode.MaxContent;
    childHeightSizingMode = SizingMode.MaxContent;

    const marginRow = child.style.computeMarginForAxis(FlexDirection.Row, ownerWidth);
    const marginColumn = child.style.computeMarginForAxis(FlexDirection.Column, ownerWidth);

    if (isRowStyleDimDefined) {
      childWidth =
        child.getResolvedDimension(direction, Dimension.Width, ownerWidth, ownerWidth) + marginRow;
      childWidthSizingMode = SizingMode.StretchFit;
    }
    if (isColumnStyleDimDefined) {
      childHeight =
        child.getResolvedDimension(direction, Dimension.Height, ownerHeight, ownerWidth) +
        marginColumn;
      childHeightSizingMode = SizingMode.StretchFit;
    }

    // The W3C spec doesn't say anything about the 'overflow' property, but all
    // major browsers appear to implement the following logic.
    if (
      (!isMainAxisRow && node.style.overflow() === Overflow.Scroll) ||
      node.style.overflow() !== Overflow.Scroll
    ) {
      if (isUndefined(childWidth) && isDefined(width)) {
        childWidth = width;
        childWidthSizingMode = SizingMode.FitContent;
      }
    }

    // A zero-intrinsic-height column subtree has the same layout with an
    // unbounded height, allowing its measurement cache to survive unrelated
    // size changes elsewhere in a vertical scroll subtree.
    const parentDoesNotScroll = node.style.overflow() !== Overflow.Scroll;
    let applyHeightFitContent = isMainAxisRow || parentDoesNotScroll;
    if (fixFlexBasisFitContent) {
      const childHadOverflow = child.isDirty() && child.layout.hadOverflow();
      const hasHeightIndependentSubtree =
        !isMainAxisRow &&
        parentDoesNotScroll &&
        isUndefined(childHeight) &&
        isDefined(height) &&
        isColumnStretchEdge(node, child) &&
        isInColumnStretchScrollSubtree(node) &&
        canSkipHeightFitContent(child);
      if (hasHeightIndependentSubtree && childHadOverflow) {
        child.setLayoutHadOverflow(false);
      }
      if (hasHeightIndependentSubtree) {
        applyHeightFitContent = false;
      }
    }
    if (applyHeightFitContent && isUndefined(childHeight) && isDefined(height)) {
      childHeight = height;
      childHeightSizingMode = SizingMode.FitContent;
    }

    const childStyle = child.style;
    if (isDefined(childStyle.aspectRatio())) {
      if (!isMainAxisRow && childWidthSizingMode === SizingMode.StretchFit) {
        childHeight = marginColumn + (childWidth - marginRow) / childStyle.aspectRatio();
        childHeightSizingMode = SizingMode.StretchFit;
      } else if (isMainAxisRow && childHeightSizingMode === SizingMode.StretchFit) {
        childWidth = marginRow + (childHeight - marginColumn) * childStyle.aspectRatio();
        childWidthSizingMode = SizingMode.StretchFit;
      }
    }

    // If child has no defined size in the cross axis and is set to stretch,
    // set the cross axis to be measured exactly with the available inner width

    const hasExactWidth = isDefined(width) && widthMode === SizingMode.StretchFit;
    const childWidthStretch =
      resolveChildAlignment(node, child) === Align.Stretch &&
      childWidthSizingMode !== SizingMode.StretchFit;
    if (!isMainAxisRow && !isRowStyleDimDefined && hasExactWidth && childWidthStretch) {
      childWidth = width;
      childWidthSizingMode = SizingMode.StretchFit;
      if (isDefined(childStyle.aspectRatio())) {
        childHeight = (childWidth - marginRow) / childStyle.aspectRatio();
        childHeightSizingMode = SizingMode.StretchFit;
      }
    }

    const hasExactHeight = isDefined(height) && heightMode === SizingMode.StretchFit;
    const childHeightStretch =
      resolveChildAlignment(node, child) === Align.Stretch &&
      childHeightSizingMode !== SizingMode.StretchFit;
    if (isMainAxisRow && !isColumnStyleDimDefined && hasExactHeight && childHeightStretch) {
      childHeight = height;
      childHeightSizingMode = SizingMode.StretchFit;

      if (isDefined(childStyle.aspectRatio())) {
        childWidth = (childHeight - marginColumn) * childStyle.aspectRatio();
        childWidthSizingMode = SizingMode.StretchFit;
      }
    }

    const widthModeAndSize = scratchModeA;
    widthModeAndSize.mode = childWidthSizingMode;
    widthModeAndSize.size = childWidth;
    constrainMaxSizeForMode(
      child,
      direction,
      FlexDirection.Row,
      ownerWidth,
      ownerWidth,
      widthModeAndSize,
    );
    const heightModeAndSize = scratchModeB;
    heightModeAndSize.mode = childHeightSizingMode;
    heightModeAndSize.size = childHeight;
    constrainMaxSizeForMode(
      child,
      direction,
      FlexDirection.Column,
      ownerHeight,
      ownerWidth,
      heightModeAndSize,
    );

    // Measure the child
    calculateLayoutInternal(
      child,
      widthModeAndSize.size,
      heightModeAndSize.size,
      direction,
      widthModeAndSize.mode,
      heightModeAndSize.mode,
      ownerWidth,
      ownerHeight,
      false,
      LayoutPassReason.MeasureChild,
      layoutMarkerData,
      depth,
      generationCount,
    );

    child.setLayoutComputedFlexBasis(
      maxOrDefined(
        child.layout.measuredDimension(dimension(mainAxis)),
        paddingAndBorderForAxis(child, mainAxis, direction, ownerWidth),
      ),
    );
  }
  child.setLayoutComputedFlexBasisGeneration(generationCount);
}

function measureNodeWithMeasureFunc(
  node: Node,
  direction: Direction,
  availableWidth: number,
  availableHeight: number,
  widthSizingMode: SizingMode,
  heightSizingMode: SizingMode,
  ownerWidth: number,
  ownerHeight: number,
  layoutMarkerData: LayoutData,
): void {
  if (widthSizingMode === SizingMode.MaxContent) {
    availableWidth = NaN;
  }
  if (heightSizingMode === SizingMode.MaxContent) {
    availableHeight = NaN;
  }

  const layout = node.layout;
  const paddingAndBorderAxisRow =
    layout.padding(PhysicalEdge.Left) +
    layout.padding(PhysicalEdge.Right) +
    layout.border(PhysicalEdge.Left) +
    layout.border(PhysicalEdge.Right);
  const paddingAndBorderAxisColumn =
    layout.padding(PhysicalEdge.Top) +
    layout.padding(PhysicalEdge.Bottom) +
    layout.border(PhysicalEdge.Top) +
    layout.border(PhysicalEdge.Bottom);

  // We want to make sure we don't call measure with negative size
  const innerWidth = isUndefined(availableWidth)
    ? availableWidth
    : maxOrDefined(0, availableWidth - paddingAndBorderAxisRow);
  const innerHeight = isUndefined(availableHeight)
    ? availableHeight
    : maxOrDefined(0, availableHeight - paddingAndBorderAxisColumn);

  if (widthSizingMode === SizingMode.StretchFit && heightSizingMode === SizingMode.StretchFit) {
    // Don't bother sizing the text if both dimensions are already defined.
    node.setLayoutMeasuredDimension(
      boundAxis(node, FlexDirection.Row, direction, availableWidth, ownerWidth, ownerWidth),
      Dimension.Width,
    );
    node.setLayoutMeasuredDimension(
      boundAxis(node, FlexDirection.Column, direction, availableHeight, ownerHeight, ownerWidth),
      Dimension.Height,
    );
  } else {
    // Measure the text under the current constraints.
    const measuredSize = node.measure(
      innerWidth,
      measureMode(widthSizingMode),
      innerHeight,
      measureMode(heightSizingMode),
    );

    layoutMarkerData.measureCallbacks += 1;

    node.setLayoutMeasuredDimension(
      boundAxis(
        node,
        FlexDirection.Row,
        direction,
        widthSizingMode === SizingMode.MaxContent || widthSizingMode === SizingMode.FitContent
          ? measuredSize.width + paddingAndBorderAxisRow
          : availableWidth,
        ownerWidth,
        ownerWidth,
      ),
      Dimension.Width,
    );

    node.setLayoutMeasuredDimension(
      boundAxis(
        node,
        FlexDirection.Column,
        direction,
        heightSizingMode === SizingMode.MaxContent || heightSizingMode === SizingMode.FitContent
          ? measuredSize.height + paddingAndBorderAxisColumn
          : availableHeight,
        ownerHeight,
        ownerWidth,
      ),
      Dimension.Height,
    );
  }
}

// For nodes with no children, use the available values if they were provided,
// or the minimum size as indicated by the padding and border sizes.
function measureNodeWithoutChildren(
  node: Node,
  direction: Direction,
  availableWidth: number,
  availableHeight: number,
  widthSizingMode: SizingMode,
  heightSizingMode: SizingMode,
  ownerWidth: number,
  ownerHeight: number,
): void {
  const layout = node.layout;

  let width = availableWidth;
  if (widthSizingMode === SizingMode.MaxContent || widthSizingMode === SizingMode.FitContent) {
    width =
      layout.padding(PhysicalEdge.Left) +
      layout.padding(PhysicalEdge.Right) +
      layout.border(PhysicalEdge.Left) +
      layout.border(PhysicalEdge.Right);
  }
  node.setLayoutMeasuredDimension(
    boundAxis(node, FlexDirection.Row, direction, width, ownerWidth, ownerWidth),
    Dimension.Width,
  );

  let height = availableHeight;
  if (heightSizingMode === SizingMode.MaxContent || heightSizingMode === SizingMode.FitContent) {
    height =
      layout.padding(PhysicalEdge.Top) +
      layout.padding(PhysicalEdge.Bottom) +
      layout.border(PhysicalEdge.Top) +
      layout.border(PhysicalEdge.Bottom);
  }
  node.setLayoutMeasuredDimension(
    boundAxis(node, FlexDirection.Column, direction, height, ownerHeight, ownerWidth),
    Dimension.Height,
  );
}

function isFixedSize(dim: number, sizingMode: SizingMode): boolean {
  return (
    sizingMode === SizingMode.StretchFit ||
    (isDefined(dim) && sizingMode === SizingMode.FitContent && dim <= 0)
  );
}

function measureNodeWithFixedSize(
  node: Node,
  direction: Direction,
  availableWidth: number,
  availableHeight: number,
  widthSizingMode: SizingMode,
  heightSizingMode: SizingMode,
  ownerWidth: number,
  ownerHeight: number,
): boolean {
  if (
    isFixedSize(availableWidth, widthSizingMode) &&
    isFixedSize(availableHeight, heightSizingMode)
  ) {
    node.setLayoutMeasuredDimension(
      boundAxis(
        node,
        FlexDirection.Row,
        direction,
        isUndefined(availableWidth) ||
          (widthSizingMode === SizingMode.FitContent && availableWidth < 0)
          ? 0
          : availableWidth,
        ownerWidth,
        ownerWidth,
      ),
      Dimension.Width,
    );

    node.setLayoutMeasuredDimension(
      boundAxis(
        node,
        FlexDirection.Column,
        direction,
        isUndefined(availableHeight) ||
          (heightSizingMode === SizingMode.FitContent && availableHeight < 0)
          ? 0
          : availableHeight,
        ownerHeight,
        ownerWidth,
      ),
      Dimension.Height,
    );
    return true;
  }

  return false;
}

export function zeroOutLayoutRecursively(node: Node): void {
  node.layout = new LayoutResults();
  node.setLayoutDimension(0, Dimension.Width);
  node.setLayoutDimension(0, Dimension.Height);
  node.hasNewLayout_ = true;

  node.cloneChildrenIfNeeded();
  for (const child of node.children) {
    zeroOutLayoutRecursively(child);
  }
}

export function cleanupContentsNodesRecursively(node: Node, didPerformLayout: boolean): void {
  if (node.hasContentsChildren()) {
    node.cloneContentsChildrenIfNeeded();
    for (const child of node.children) {
      if (child.style.display() === Display.Contents) {
        child.layout = new LayoutResults();
        child.setLayoutDimension(0, Dimension.Width);
        child.setLayoutDimension(0, Dimension.Height);
        if (didPerformLayout) {
          child.hasNewLayout_ = true;
        }
        child.setDirty(false);
        child.cloneChildrenIfNeeded();

        cleanupContentsNodesRecursively(child, didPerformLayout);
      }
    }
  }
}

export function calculateAvailableInnerDimension(
  node: Node,
  direction: Direction,
  dim: Dimension,
  availableDim: number,
  paddingAndBorder: number,
  ownerDim: number,
  ownerWidth: number,
): number {
  let availableInnerDim = availableDim - paddingAndBorder;
  // Max dimension overrides predefined dimension value; Min dimension in turn
  // overrides both of the above
  if (isDefined(availableInnerDim)) {
    // We want to make sure our available height does not violate min and max
    // constraints
    const minDimensionOptional = node.style.resolvedMinDimension(
      direction,
      dim,
      ownerDim,
      ownerWidth,
    );
    const minInnerDim = isUndefined(minDimensionOptional)
      ? 0
      : minDimensionOptional - paddingAndBorder;

    const maxDimensionOptional = node.style.resolvedMaxDimension(
      direction,
      dim,
      ownerDim,
      ownerWidth,
    );

    const maxInnerDim = isUndefined(maxDimensionOptional)
      ? Number.MAX_VALUE
      : maxDimensionOptional - paddingAndBorder;
    availableInnerDim = maxOrDefined(minOrDefined(availableInnerDim, maxInnerDim), minInnerDim);
  }

  return availableInnerDim;
}

function computeFlexBasisForChildren(
  node: Node,
  layoutChildren: readonly Node[],
  availableInnerWidth: number,
  availableInnerHeight: number,
  ownerWidth: number,
  ownerHeight: number,
  widthSizingMode: SizingMode,
  heightSizingMode: SizingMode,
  direction: Direction,
  mainAxis: FlexDirection,
  performLayout: boolean,
  layoutMarkerData: LayoutData,
  depth: number,
  generationCount: number,
): number {
  let totalOuterFlexBasis = 0;
  let singleFlexChild: Node | null = null;
  const sizingModeMainDim = isRow(mainAxis) ? widthSizingMode : heightSizingMode;
  // If there is only one child with flexGrow + flexShrink it means we can set
  // the computedFlexBasis to 0 instead of measuring and shrinking / flexing
  // the child to exactly match the remaining space
  if (sizingModeMainDim === SizingMode.StretchFit) {
    for (const child of layoutChildren) {
      if (child.isNodeFlexible()) {
        if (
          singleFlexChild !== null ||
          inexactEquals(child.resolveFlexGrow(), 0) ||
          inexactEquals(child.resolveFlexShrink(), 0)
        ) {
          // There is already a flexible child, or this flexible child doesn't
          // have flexGrow and flexShrink, abort
          singleFlexChild = null;
          break;
        } else {
          singleFlexChild = child;
        }
      }
    }
  }

  for (const child of layoutChildren) {
    child.processDimensions();
    if (child.style.display() === Display.None) {
      // Only mutate display: none children during layout passes. Zeroing them
      // out during measure-only passes contributes nothing to the
      // measurement, but sets `hasNewLayout` on nodes the parent's layout
      // pass may never visit.
      if (performLayout) {
        zeroOutLayoutRecursively(child);
        child.hasNewLayout_ = true;
        child.setDirty(false);
      }
      continue;
    }
    if (performLayout) {
      // Set the initial position (relative to the owner).
      const childDirection = child.resolveDirection(direction);
      child.setPositionFromStyle(childDirection, availableInnerWidth, availableInnerHeight);
    }

    if (child.style.positionType() === PositionType.Absolute) {
      continue;
    }
    if (child === singleFlexChild) {
      child.setLayoutComputedFlexBasisGeneration(generationCount);
      child.setLayoutComputedFlexBasis(0);
    } else {
      computeFlexBasisForChild(
        node,
        child,
        availableInnerWidth,
        widthSizingMode,
        availableInnerHeight,
        ownerWidth,
        ownerHeight,
        heightSizingMode,
        direction,
        layoutMarkerData,
        depth,
        generationCount,
      );
    }

    totalOuterFlexBasis +=
      child.layout.computedFlexBasis +
      child.style.computeMarginForAxis(mainAxis, availableInnerWidth);
  }

  return totalOuterFlexBasis;
}

// Returns the min-content size of `node` along `requestedAxis`, used by CSS
// Flexbox §4.5 automatic minimum sizing. See CalculateLayout.cpp for the full
// description of the algorithm.
function computeMinContentMainSize(
  node: Node,
  requestedAxis: FlexDirection,
  ownerDirection: Direction,
  ownerWidth: number,
  // oxlint-disable-next-line oxc/only-used-in-recursion -- kept for call-site parity with upstream Yoga
  ownerHeight: number,
): number {
  const wantRow = isRow(requestedAxis);

  if (node.hasMeasureFunc()) {
    // Fall back to the regular measure function with `AtMost 0`, which text
    // measurers naturally answer with longest-word width.
    const size = node.measure(
      wantRow ? 0 : NaN,
      wantRow ? MeasureMode.AtMost : MeasureMode.Undefined,
      wantRow ? NaN : 0,
      wantRow ? MeasureMode.Undefined : MeasureMode.AtMost,
    );
    // Add the leaf's own padding and border, like the container branch below.
    const leafDirection = node.resolveDirection(ownerDirection);
    const paddingAndBorder =
      node.style.computeFlexStartPaddingAndBorder(requestedAxis, leafDirection, ownerWidth) +
      node.style.computeFlexEndPaddingAndBorder(requestedAxis, leafDirection, ownerWidth);
    return (wantRow ? size.width : size.height) + paddingAndBorder;
  }

  if (node.getChildCount() === 0) {
    return 0;
  }

  const direction = node.resolveDirection(ownerDirection);
  const nodeMainAxis = resolveDirection(node.style.flexDirection(), direction);
  const nodeCrossAxis = resolveCrossDirection(nodeMainAxis, direction);

  let mainTotal = 0;
  let crossMax = 0;

  for (let i = 0; i < node.getChildCount(); i++) {
    const child = node.getChild(i);
    if (
      child.style.display() === Display.None ||
      child.style.positionType() === PositionType.Absolute
    ) {
      continue;
    }

    let childMain = computeMinContentMainSize(
      child,
      nodeMainAxis,
      direction,
      ownerWidth,
      ownerHeight,
    );
    childMain += child.style.computeMarginForAxis(nodeMainAxis, ownerWidth);

    let childCross = computeMinContentMainSize(
      child,
      nodeCrossAxis,
      direction,
      ownerWidth,
      ownerHeight,
    );
    childCross += child.style.computeMarginForAxis(nodeCrossAxis, ownerWidth);

    mainTotal += childMain;
    crossMax = Math.max(crossMax, childCross);
  }

  mainTotal +=
    node.style.computeFlexStartPaddingAndBorder(nodeMainAxis, direction, ownerWidth) +
    node.style.computeFlexEndPaddingAndBorder(nodeMainAxis, direction, ownerWidth);
  crossMax +=
    node.style.computeFlexStartPaddingAndBorder(nodeCrossAxis, direction, ownerWidth) +
    node.style.computeFlexEndPaddingAndBorder(nodeCrossAxis, direction, ownerWidth);

  const nodeMainIsRow = isRow(nodeMainAxis);
  const widthMin = nodeMainIsRow ? mainTotal : crossMax;
  const heightMin = nodeMainIsRow ? crossMax : mainTotal;
  return wantRow ? widthMin : heightMin;
}

// Computes the CSS Flexbox §4.5 automatic minimum main-axis size for `child`.
// Returns NaN when no auto-min applies; 0 when the item's own
// `overflow != visible` (the spec's per-item escape hatch); or a concrete
// floor otherwise. See https://www.w3.org/TR/css-flexbox-1/#min-size-auto.
function computeAutoMinMainSize(
  child: Node,
  mainAxis: FlexDirection,
  direction: Direction,
  ownerMainAxisSize: number,
  ownerWidth: number,
  ownerHeight: number,
): number {
  if (child.hasErrata(Errata.MinSizeUndefinedInsteadOfAuto)) {
    return NaN;
  }
  if (child.style.display() === Display.None) {
    return NaN;
  }
  // Explicit `min-{w,h}` (including `0`) wins over auto. This is the
  // CSS-spec opt-out (§4.5).
  if (child.style.minDimension(dimension(mainAxis)).isDefined()) {
    return NaN;
  }
  // Per CSS §4.5: a flex item whose own `overflow` is not `visible` gets
  // auto-min = 0 (let scroll/clip handle overflow rather than enforce a
  // content-based minimum).
  if (child.style.overflow() !== Overflow.Visible) {
    return 0;
  }

  const mainDim = dimension(mainAxis);
  const crossDim = isRow(mainAxis) ? Dimension.Height : Dimension.Width;
  const isMainAxisRow = isRow(mainAxis);

  // Specified size suggestion: the resolved main-axis style dimension.
  const specifiedMain = child.getResolvedDimension(
    direction,
    mainDim,
    ownerMainAxisSize,
    ownerWidth,
  );

  // Transferred size suggestion: cross × aspect-ratio, if both are definite.
  let transferredMain = NaN;
  const aspectRatio = child.style.aspectRatio();
  if (isDefined(aspectRatio)) {
    const crossOwner = isMainAxisRow ? ownerHeight : ownerWidth;
    const crossResolved = child.getResolvedDimension(direction, crossDim, crossOwner, ownerWidth);
    if (isDefined(crossResolved)) {
      transferredMain = isMainAxisRow ? crossResolved * aspectRatio : crossResolved / aspectRatio;
    }
  }

  // Content size suggestion: probe via min-content recursion.
  const contentMain = computeMinContentMainSize(
    child,
    mainAxis,
    direction,
    ownerWidth,
    ownerHeight,
  );

  // Combine per §4.5: floor = min(content, specified) when specified is
  // definite; otherwise floor = min(content, transferred) when transferred
  // applies; else floor = content.
  let floor = contentMain;
  if (isDefined(specifiedMain)) {
    if (isUndefined(floor) || specifiedMain < floor) {
      floor = specifiedMain;
    }
  } else if (isDefined(transferredMain)) {
    if (isUndefined(floor) || transferredMain < floor) {
      floor = transferredMain;
    }
  }

  // §4.5: cap by the max main size.
  const maxMain = child.style.resolvedMaxDimension(
    direction,
    mainDim,
    ownerMainAxisSize,
    ownerWidth,
  );
  if (isDefined(maxMain) && floor > maxMain) {
    floor = maxMain;
  }

  if (isUndefined(floor) || floor < 0) {
    floor = 0;
  }
  return floor;
}

// boundAxis with an additional lower bound from `child`'s cached
// `computedAutoMinMainSize`, applied on the main axis only.
function boundAxisWithAutoMin(
  child: Node,
  axis: FlexDirection,
  direction: Direction,
  value: number,
  axisSize: number,
  widthSize: number,
): number {
  let bounded = boundAxis(child, axis, direction, value, axisSize, widthSize);
  const autoMin = child.layout.computedAutoMinMainSize;
  if (isDefined(autoMin) && bounded < autoMin) {
    bounded = autoMin;
  }
  return bounded;
}

// It distributes the free space to the flexible items and ensures that the
// size of the flex items abide the min and max constraints. At the end of this
// function the child nodes would have proper size. Prior using this function
// please ensure that distributeFreeSpaceFirstPass is called.
function distributeFreeSpaceSecondPass(
  flexLine: FlexLine,
  node: Node,
  mainAxis: FlexDirection,
  crossAxis: FlexDirection,
  direction: Direction,
  ownerWidth: number,
  mainAxisOwnerSize: number,
  availableInnerMainDim: number,
  availableInnerCrossDim: number,
  availableInnerWidth: number,
  availableInnerHeight: number,
  mainAxisOverflows: boolean,
  sizingModeCrossDim: SizingMode,
  performLayout: boolean,
  layoutMarkerData: LayoutData,
  depth: number,
  generationCount: number,
): number {
  let childFlexBasis = 0;
  let flexShrinkScaledFactor = 0;
  let flexGrowFactor = 0;
  let deltaFreeSpace = 0;
  const isMainAxisRow = isRow(mainAxis);
  const isNodeFlexWrap = node.style.flexWrap() !== Wrap.NoWrap;

  for (const currentLineChild of flexLine.itemsInFlow) {
    childFlexBasis = boundAxisWithinMinAndMax(
      currentLineChild,
      direction,
      mainAxis,
      currentLineChild.layout.computedFlexBasis,
      mainAxisOwnerSize,
      ownerWidth,
    );
    let updatedMainSize = childFlexBasis;

    if (isDefined(flexLine.layout.remainingFreeSpace) && flexLine.layout.remainingFreeSpace < 0) {
      flexShrinkScaledFactor = -currentLineChild.resolveFlexShrink() * childFlexBasis;
      // Is this child able to shrink?
      if (flexShrinkScaledFactor !== 0) {
        let childSize = NaN;

        if (
          isDefined(flexLine.layout.totalFlexShrinkScaledFactors) &&
          flexLine.layout.totalFlexShrinkScaledFactors === 0
        ) {
          childSize = childFlexBasis + flexShrinkScaledFactor;
        } else {
          childSize =
            childFlexBasis +
            (flexLine.layout.remainingFreeSpace / flexLine.layout.totalFlexShrinkScaledFactors) *
              flexShrinkScaledFactor;
        }

        updatedMainSize = boundAxisWithAutoMin(
          currentLineChild,
          mainAxis,
          direction,
          childSize,
          availableInnerMainDim,
          availableInnerWidth,
        );
      }
    } else if (
      isDefined(flexLine.layout.remainingFreeSpace) &&
      flexLine.layout.remainingFreeSpace > 0
    ) {
      flexGrowFactor = currentLineChild.resolveFlexGrow();

      // Is this child able to grow?
      if (!Number.isNaN(flexGrowFactor) && flexGrowFactor !== 0) {
        updatedMainSize = boundAxisWithAutoMin(
          currentLineChild,
          mainAxis,
          direction,
          childFlexBasis +
            (flexLine.layout.remainingFreeSpace / flexLine.layout.totalFlexGrowFactors) *
              flexGrowFactor,
          availableInnerMainDim,
          availableInnerWidth,
        );
      }
    }

    deltaFreeSpace += updatedMainSize - childFlexBasis;

    const marginMain = currentLineChild.style.computeMarginForAxis(mainAxis, availableInnerWidth);
    const marginCross = currentLineChild.style.computeMarginForAxis(crossAxis, availableInnerWidth);

    let childCrossSize = NaN;
    const childMainSize = updatedMainSize + marginMain;
    let childCrossSizingMode: SizingMode;
    const childMainSizingMode = SizingMode.StretchFit;

    // These are pure reads repeated below; evaluate once per child.
    const crossDim = dimension(crossAxis);
    const hasDefiniteCrossLength = currentLineChild.hasDefiniteLength(
      crossDim,
      availableInnerCrossDim,
    );
    const childAlignment = resolveChildAlignment(node, currentLineChild);
    const crossStartMarginIsAuto = currentLineChild.style.flexStartMarginIsAuto(
      crossAxis,
      direction,
    );
    const crossEndMarginIsAuto = currentLineChild.style.flexEndMarginIsAuto(crossAxis, direction);

    const childStyle = currentLineChild.style;
    if (isDefined(childStyle.aspectRatio())) {
      childCrossSize = isMainAxisRow
        ? (childMainSize - marginMain) / childStyle.aspectRatio()
        : (childMainSize - marginMain) * childStyle.aspectRatio();
      childCrossSizingMode = SizingMode.StretchFit;

      childCrossSize += marginCross;
    } else if (
      !Number.isNaN(availableInnerCrossDim) &&
      !hasDefiniteCrossLength &&
      sizingModeCrossDim === SizingMode.StretchFit &&
      !(isNodeFlexWrap && mainAxisOverflows) &&
      childAlignment === Align.Stretch &&
      !crossStartMarginIsAuto &&
      !crossEndMarginIsAuto
    ) {
      childCrossSize = availableInnerCrossDim;
      childCrossSizingMode = SizingMode.StretchFit;
    } else if (!hasDefiniteCrossLength) {
      childCrossSize = availableInnerCrossDim;
      childCrossSizingMode = isUndefined(childCrossSize)
        ? SizingMode.MaxContent
        : SizingMode.FitContent;
    } else {
      childCrossSize =
        currentLineChild.getResolvedDimension(
          direction,
          crossDim,
          availableInnerCrossDim,
          availableInnerWidth,
        ) + marginCross;
      const isLoosePercentageMeasurement =
        currentLineChild.getProcessedDimension(crossDim).isPercent() &&
        sizingModeCrossDim !== SizingMode.StretchFit;
      childCrossSizingMode =
        isUndefined(childCrossSize) || isLoosePercentageMeasurement
          ? SizingMode.MaxContent
          : SizingMode.StretchFit;
    }

    const mainModeAndSize = scratchModeA;
    mainModeAndSize.mode = childMainSizingMode;
    mainModeAndSize.size = childMainSize;
    constrainMaxSizeForMode(
      currentLineChild,
      direction,
      mainAxis,
      availableInnerMainDim,
      availableInnerWidth,
      mainModeAndSize,
    );
    const crossModeAndSize = scratchModeB;
    crossModeAndSize.mode = childCrossSizingMode;
    crossModeAndSize.size = childCrossSize;
    constrainMaxSizeForMode(
      currentLineChild,
      direction,
      crossAxis,
      availableInnerCrossDim,
      availableInnerWidth,
      crossModeAndSize,
    );

    const requiresStretchLayout =
      !hasDefiniteCrossLength &&
      childAlignment === Align.Stretch &&
      !crossStartMarginIsAuto &&
      !crossEndMarginIsAuto;

    const childWidth = isMainAxisRow ? mainModeAndSize.size : crossModeAndSize.size;
    const childHeight = !isMainAxisRow ? mainModeAndSize.size : crossModeAndSize.size;

    const childWidthSizingMode = isMainAxisRow ? mainModeAndSize.mode : crossModeAndSize.mode;
    const childHeightSizingMode = !isMainAxisRow ? mainModeAndSize.mode : crossModeAndSize.mode;

    const isLayoutPass = performLayout && !requiresStretchLayout;
    // Recursively call the layout algorithm for this child with the updated
    // main size.
    calculateLayoutInternal(
      currentLineChild,
      childWidth,
      childHeight,
      node.layout.direction(),
      childWidthSizingMode,
      childHeightSizingMode,
      availableInnerWidth,
      availableInnerHeight,
      isLayoutPass,
      isLayoutPass ? LayoutPassReason.FlexLayout : LayoutPassReason.FlexMeasure,
      layoutMarkerData,
      depth,
      generationCount,
    );
    node.setLayoutHadOverflow(node.layout.hadOverflow() || currentLineChild.layout.hadOverflow());
  }
  return deltaFreeSpace;
}

// It distributes the free space to the flexible items. For those flexible
// items whose min and max constraints are triggered, those flex item's clamped
// size is removed from the remaining free space.
function distributeFreeSpaceFirstPass(
  flexLine: FlexLine,
  direction: Direction,
  mainAxis: FlexDirection,
  ownerWidth: number,
  mainAxisOwnerSize: number,
  availableInnerMainDim: number,
  availableInnerWidth: number,
): void {
  let flexShrinkScaledFactor = 0;
  let flexGrowFactor = 0;
  let baseMainSize = 0;
  let boundMainSize = 0;
  let deltaFreeSpace = 0;

  for (const currentLineChild of flexLine.itemsInFlow) {
    const childFlexBasis = boundAxisWithinMinAndMax(
      currentLineChild,
      direction,
      mainAxis,
      currentLineChild.layout.computedFlexBasis,
      mainAxisOwnerSize,
      ownerWidth,
    );

    if (flexLine.layout.remainingFreeSpace < 0) {
      flexShrinkScaledFactor = -currentLineChild.resolveFlexShrink() * childFlexBasis;

      // Is this child able to shrink?
      if (isDefined(flexShrinkScaledFactor) && flexShrinkScaledFactor !== 0) {
        baseMainSize =
          childFlexBasis +
          (flexLine.layout.remainingFreeSpace / flexLine.layout.totalFlexShrinkScaledFactors) *
            flexShrinkScaledFactor;
        boundMainSize = boundAxisWithAutoMin(
          currentLineChild,
          mainAxis,
          direction,
          baseMainSize,
          availableInnerMainDim,
          availableInnerWidth,
        );
        if (isDefined(baseMainSize) && isDefined(boundMainSize) && baseMainSize !== boundMainSize) {
          // By excluding this item's size and flex factor from remaining,
          // this item's min/max constraints should also trigger in the second
          // pass resulting in the item's size calculation being identical in
          // the first and second passes.
          deltaFreeSpace += boundMainSize - childFlexBasis;
          flexLine.layout.totalFlexShrinkScaledFactors -=
            -currentLineChild.resolveFlexShrink() * currentLineChild.layout.computedFlexBasis;
        }
      }
    } else if (
      isDefined(flexLine.layout.remainingFreeSpace) &&
      flexLine.layout.remainingFreeSpace > 0
    ) {
      flexGrowFactor = currentLineChild.resolveFlexGrow();

      // Is this child able to grow?
      if (isDefined(flexGrowFactor) && flexGrowFactor !== 0) {
        baseMainSize =
          childFlexBasis +
          (flexLine.layout.remainingFreeSpace / flexLine.layout.totalFlexGrowFactors) *
            flexGrowFactor;
        boundMainSize = boundAxis(
          currentLineChild,
          mainAxis,
          direction,
          baseMainSize,
          availableInnerMainDim,
          availableInnerWidth,
        );

        if (isDefined(baseMainSize) && isDefined(boundMainSize) && baseMainSize !== boundMainSize) {
          // By excluding this item's size and flex factor from remaining,
          // this item's min/max constraints should also trigger in the second
          // pass resulting in the item's size calculation being identical in
          // the first and second passes.
          deltaFreeSpace += boundMainSize - childFlexBasis;
          flexLine.layout.totalFlexGrowFactors -= flexGrowFactor;
        }
      }
    }
  }
  flexLine.layout.remainingFreeSpace -= deltaFreeSpace;
}

// Do two passes over the flex items to figure out how to distribute the
// remaining space.
//
// The first pass finds the items whose min/max constraints trigger, freezes
// them at those sizes, and excludes those sizes from the remaining space.
//
// The second pass sets the size of each flexible item. It distributes the
// remaining space amongst the items whose min/max constraints didn't trigger
// in the first pass. For the other items, it sets their sizes by forcing
// their min/max constraints to trigger again.
//
// This two pass approach for resolving min/max constraints deviates from the
// spec. The spec (https://www.w3.org/TR/CSS-flexbox-1/#resolve-flexible-lengths)
// describes a process that needs to be repeated a variable number of times.
// The algorithm implemented here won't handle all cases but it was simpler to
// implement and it mitigates performance concerns because we know exactly how
// many passes it'll do.
//
// At the end of this function the child nodes would have the proper size
// assigned to them.
//
function resolveFlexibleLength(
  node: Node,
  flexLine: FlexLine,
  mainAxis: FlexDirection,
  crossAxis: FlexDirection,
  direction: Direction,
  ownerWidth: number,
  mainAxisOwnerSize: number,
  availableInnerMainDim: number,
  availableInnerCrossDim: number,
  availableInnerWidth: number,
  availableInnerHeight: number,
  mainAxisOverflows: boolean,
  sizingModeCrossDim: SizingMode,
  performLayout: boolean,
  layoutMarkerData: LayoutData,
  depth: number,
  generationCount: number,
): void {
  const originalFreeSpace = flexLine.layout.remainingFreeSpace;

  // CSS Flexbox §4.5: compute each item's automatic minimum main-axis size
  // up front so the bounding helpers below can floor shrunk values.
  if (!node.hasErrata(Errata.MinSizeUndefinedInsteadOfAuto)) {
    for (const currentLineChild of flexLine.itemsInFlow) {
      currentLineChild.layout.computedAutoMinMainSize = computeAutoMinMainSize(
        currentLineChild,
        mainAxis,
        direction,
        mainAxisOwnerSize,
        availableInnerWidth,
        availableInnerHeight,
      );
    }
  } else {
    for (const currentLineChild of flexLine.itemsInFlow) {
      currentLineChild.layout.computedAutoMinMainSize = NaN;
    }
  }

  // First pass: detect the flex items whose min/max constraints trigger
  distributeFreeSpaceFirstPass(
    flexLine,
    direction,
    mainAxis,
    ownerWidth,
    mainAxisOwnerSize,
    availableInnerMainDim,
    availableInnerWidth,
  );

  // Second pass: resolve the sizes of the flexible items
  const distributedFreeSpace = distributeFreeSpaceSecondPass(
    flexLine,
    node,
    mainAxis,
    crossAxis,
    direction,
    ownerWidth,
    mainAxisOwnerSize,
    availableInnerMainDim,
    availableInnerCrossDim,
    availableInnerWidth,
    availableInnerHeight,
    mainAxisOverflows,
    sizingModeCrossDim,
    performLayout,
    layoutMarkerData,
    depth,
    generationCount,
  );

  flexLine.layout.remainingFreeSpace = originalFreeSpace - distributedFreeSpace;
}

function justifyMainAxis(
  node: Node,
  flexLine: FlexLine,
  mainAxis: FlexDirection,
  crossAxis: FlexDirection,
  direction: Direction,
  sizingModeMainDim: SizingMode,
  sizingModeCrossDim: SizingMode,
  mainAxisOwnerSize: number,
  ownerWidth: number,
  availableInnerMainDim: number,
  availableInnerCrossDim: number,
  availableInnerWidth: number,
  performLayout: boolean,
): void {
  const style = node.style;

  const leadingPaddingAndBorderMain = node.style.computeFlexStartPaddingAndBorder(
    mainAxis,
    direction,
    ownerWidth,
  );
  const trailingPaddingAndBorderMain = node.style.computeFlexEndPaddingAndBorder(
    mainAxis,
    direction,
    ownerWidth,
  );

  const gap = node.style.computeGapForAxis(mainAxis, availableInnerMainDim);
  // If we are using "at most" rules in the main axis, make sure that
  // remainingFreeSpace is 0 when min main dimension is not given
  if (sizingModeMainDim === SizingMode.FitContent && flexLine.layout.remainingFreeSpace > 0) {
    if (
      style.minDimension(dimension(mainAxis)).isDefined() &&
      isDefined(
        style.resolvedMinDimension(direction, dimension(mainAxis), mainAxisOwnerSize, ownerWidth),
      )
    ) {
      // This condition makes sure that if the size of main dimension(after
      // considering child nodes main dim, leading and trailing padding etc)
      // falls below min dimension, then the remainingFreeSpace is reassigned
      // considering the min dimension

      // `minAvailableMainDim` denotes minimum available space in which child
      // can be laid out, it will exclude space consumed by padding and border.
      const minAvailableMainDim =
        style.resolvedMinDimension(direction, dimension(mainAxis), mainAxisOwnerSize, ownerWidth) -
        leadingPaddingAndBorderMain -
        trailingPaddingAndBorderMain;
      const occupiedSpaceByChildNodes = availableInnerMainDim - flexLine.layout.remainingFreeSpace;
      flexLine.layout.remainingFreeSpace = maxOrDefined(
        0,
        minAvailableMainDim - occupiedSpaceByChildNodes,
      );
    } else {
      flexLine.layout.remainingFreeSpace = 0;
    }
  }

  // In order to position the elements in the main axis, we have two controls.
  // The space between the beginning and the first element and the space
  // between each two elements.
  let leadingMainDim = 0;
  let betweenMainDim = gap;
  const justifyContent =
    flexLine.layout.remainingFreeSpace >= 0
      ? node.style.justifyContent()
      : fallbackJustification(node.style.justifyContent());

  if (flexLine.numberOfAutoMargins === 0) {
    switch (justifyContent) {
      case Justify.Start:
      case Justify.End:
      case Justify.Auto:
        // No-Op
        break;
      case Justify.Stretch:
        // No-Op
        break;
      case Justify.Center:
        leadingMainDim = flexLine.layout.remainingFreeSpace / 2;
        break;
      case Justify.FlexEnd:
        leadingMainDim = flexLine.layout.remainingFreeSpace;
        break;
      case Justify.SpaceBetween:
        if (flexLine.itemsInFlow.length > 1) {
          betweenMainDim += flexLine.layout.remainingFreeSpace / (flexLine.itemsInFlow.length - 1);
        }
        break;
      case Justify.SpaceEvenly:
        // Space is distributed evenly across all elements
        leadingMainDim = flexLine.layout.remainingFreeSpace / (flexLine.itemsInFlow.length + 1);
        betweenMainDim += leadingMainDim;
        break;
      case Justify.SpaceAround:
        // Space on the edges is half of the space between elements
        leadingMainDim = (0.5 * flexLine.layout.remainingFreeSpace) / flexLine.itemsInFlow.length;
        betweenMainDim += leadingMainDim * 2;
        break;
      case Justify.FlexStart:
        break;
    }
  }

  flexLine.layout.mainDim = leadingPaddingAndBorderMain + leadingMainDim;
  flexLine.layout.crossDim = 0;

  let maxAscentForCurrentLine = 0;
  let maxDescentForCurrentLine = 0;
  const isNodeBaselineLayout = isBaselineLayout(node);
  for (const child of flexLine.itemsInFlow) {
    const childLayout = child.layout;
    if (
      child.style.flexStartMarginIsAuto(mainAxis, direction) &&
      flexLine.layout.remainingFreeSpace > 0
    ) {
      flexLine.layout.mainDim += flexLine.layout.remainingFreeSpace / flexLine.numberOfAutoMargins;
    }

    if (performLayout) {
      child.setLayoutPosition(
        childLayout.position(flexStartEdge(mainAxis)) + flexLine.layout.mainDim,
        flexStartEdge(mainAxis),
      );
    }

    if (child !== flexLine.itemsInFlow[flexLine.itemsInFlow.length - 1]) {
      flexLine.layout.mainDim += betweenMainDim;
    }

    if (
      child.style.flexEndMarginIsAuto(mainAxis, direction) &&
      flexLine.layout.remainingFreeSpace > 0
    ) {
      flexLine.layout.mainDim += flexLine.layout.remainingFreeSpace / flexLine.numberOfAutoMargins;
    }
    const canSkipFlex = !performLayout && sizingModeCrossDim === SizingMode.StretchFit;
    if (canSkipFlex) {
      // If we skipped the flex step, then we can't rely on the measuredDims
      // because they weren't computed. This means we can't call
      // dimensionWithMargin.
      flexLine.layout.mainDim +=
        child.style.computeMarginForAxis(mainAxis, availableInnerWidth) +
        boundAxisWithinMinAndMax(
          child,
          direction,
          mainAxis,
          childLayout.computedFlexBasis,
          mainAxisOwnerSize,
          ownerWidth,
        );
      flexLine.layout.crossDim = availableInnerCrossDim;
    } else {
      // The main dimension is the sum of all the elements dimension plus
      // the spacing.
      flexLine.layout.mainDim += child.dimensionWithMargin(mainAxis, availableInnerWidth);

      if (isNodeBaselineLayout) {
        // If the child is baseline aligned then the cross dimension is
        // calculated by adding maxAscent and maxDescent from the baseline.
        const ascent =
          calculateBaseline(child) +
          child.style.computeFlexStartMargin(FlexDirection.Column, direction, availableInnerWidth);
        const descent =
          child.layout.measuredDimension(Dimension.Height) +
          child.style.computeMarginForAxis(FlexDirection.Column, availableInnerWidth) -
          ascent;

        maxAscentForCurrentLine = maxOrDefined(maxAscentForCurrentLine, ascent);
        maxDescentForCurrentLine = maxOrDefined(maxDescentForCurrentLine, descent);
      } else {
        // The cross dimension is the max of the elements dimension since
        // there can only be one element in that cross dimension in the case
        // when the items are not baseline aligned
        flexLine.layout.crossDim = maxOrDefined(
          flexLine.layout.crossDim,
          child.dimensionWithMargin(crossAxis, availableInnerWidth),
        );
      }
    }
  }
  flexLine.layout.mainDim += trailingPaddingAndBorderMain;

  if (isNodeBaselineLayout) {
    flexLine.layout.crossDim = maxAscentForCurrentLine + maxDescentForCurrentLine;
  }
}

//
// This is the main routine that implements a subset of the flexbox layout
// algorithm described in the W3C CSS documentation:
// https://www.w3.org/TR/CSS3-flexbox/. See CalculateLayout.cpp for the list of
// limitations and deviations from the standard.
//
function calculateLayoutImpl(
  node: Node,
  availableWidth: number,
  availableHeight: number,
  ownerDirection: Direction,
  widthSizingMode: SizingMode,
  heightSizingMode: SizingMode,
  ownerWidth: number,
  ownerHeight: number,
  performLayout: boolean,
  _reason: LayoutPassReason,
  layoutMarkerData: LayoutData,
  depth: number,
  generationCount: number,
): void {
  if (isUndefined(availableWidth) && widthSizingMode !== SizingMode.MaxContent) {
    throw new Error(
      "availableWidth is indefinite so widthSizingMode must be SizingMode::MaxContent",
    );
  }
  if (isUndefined(availableHeight) && heightSizingMode !== SizingMode.MaxContent) {
    throw new Error(
      "availableHeight is indefinite so heightSizingMode must be SizingMode::MaxContent",
    );
  }

  if (performLayout) {
    layoutMarkerData.layouts += 1;
  } else {
    layoutMarkerData.measures += 1;
  }

  // Set the resolved resolution in the node's layout.
  const direction = node.resolveDirection(ownerDirection);
  node.setLayoutDirection(direction);
  const fixFlexBasisFitContent = node.config.isExperimentalFeatureEnabled(
    ExperimentalFeature.FixFlexBasisFitContent,
  );
  if (fixFlexBasisFitContent && performLayout) {
    node.setLayoutHadOverflow(false);
  }

  const flexRowDirection = resolveDirection(FlexDirection.Row, direction);
  const flexColumnDirection = resolveDirection(FlexDirection.Column, direction);

  const startEdge = direction === Direction.LTR ? PhysicalEdge.Left : PhysicalEdge.Right;
  const endEdge = direction === Direction.LTR ? PhysicalEdge.Right : PhysicalEdge.Left;

  const marginRowLeading = node.style.computeInlineStartMargin(
    flexRowDirection,
    direction,
    ownerWidth,
  );
  node.setLayoutMargin(marginRowLeading, startEdge);
  const marginRowTrailing = node.style.computeInlineEndMargin(
    flexRowDirection,
    direction,
    ownerWidth,
  );
  node.setLayoutMargin(marginRowTrailing, endEdge);
  const marginColumnLeading = node.style.computeInlineStartMargin(
    flexColumnDirection,
    direction,
    ownerWidth,
  );
  node.setLayoutMargin(marginColumnLeading, PhysicalEdge.Top);
  const marginColumnTrailing = node.style.computeInlineEndMargin(
    flexColumnDirection,
    direction,
    ownerWidth,
  );
  node.setLayoutMargin(marginColumnTrailing, PhysicalEdge.Bottom);

  const marginAxisRow = marginRowLeading + marginRowTrailing;
  const marginAxisColumn = marginColumnLeading + marginColumnTrailing;

  node.setLayoutBorder(node.style.computeInlineStartBorder(flexRowDirection, direction), startEdge);
  node.setLayoutBorder(node.style.computeInlineEndBorder(flexRowDirection, direction), endEdge);
  node.setLayoutBorder(
    node.style.computeInlineStartBorder(flexColumnDirection, direction),
    PhysicalEdge.Top,
  );
  node.setLayoutBorder(
    node.style.computeInlineEndBorder(flexColumnDirection, direction),
    PhysicalEdge.Bottom,
  );

  node.setLayoutPadding(
    node.style.computeInlineStartPadding(flexRowDirection, direction, ownerWidth),
    startEdge,
  );
  node.setLayoutPadding(
    node.style.computeInlineEndPadding(flexRowDirection, direction, ownerWidth),
    endEdge,
  );
  node.setLayoutPadding(
    node.style.computeInlineStartPadding(flexColumnDirection, direction, ownerWidth),
    PhysicalEdge.Top,
  );
  node.setLayoutPadding(
    node.style.computeInlineEndPadding(flexColumnDirection, direction, ownerWidth),
    PhysicalEdge.Bottom,
  );

  if (node.hasMeasureFunc()) {
    measureNodeWithMeasureFunc(
      node,
      direction,
      availableWidth - marginAxisRow,
      availableHeight - marginAxisColumn,
      widthSizingMode,
      heightSizingMode,
      ownerWidth,
      ownerHeight,
      layoutMarkerData,
    );

    // Clean and update all display: contents nodes with a direct path to the
    // current node as they will not be traversed
    cleanupContentsNodesRecursively(node, performLayout);
    return;
  }

  const layoutChildren = node.getLayoutChildren();
  const childCount = layoutChildren.length;
  if (childCount === 0) {
    measureNodeWithoutChildren(
      node,
      direction,
      availableWidth - marginAxisRow,
      availableHeight - marginAxisColumn,
      widthSizingMode,
      heightSizingMode,
      ownerWidth,
      ownerHeight,
    );

    // Clean and update all display: contents nodes with a direct path to the
    // current node as they will not be traversed
    cleanupContentsNodesRecursively(node, performLayout);
    return;
  }

  // If we're not being asked to perform a full layout we can skip the
  // algorithm if we already know the size
  if (
    !performLayout &&
    measureNodeWithFixedSize(
      node,
      direction,
      availableWidth - marginAxisRow,
      availableHeight - marginAxisColumn,
      widthSizingMode,
      heightSizingMode,
      ownerWidth,
      ownerHeight,
    )
  ) {
    // Clean and update all display: contents nodes with a direct path to the
    // current node as they will not be traversed
    cleanupContentsNodesRecursively(node, /* didPerformLayout */ false);
    return;
  }

  // At this point we know we're going to perform work. Ensure that each child
  // has a mutable copy.
  node.cloneChildrenIfNeeded();
  if (!fixFlexBasisFitContent || !performLayout) {
    node.setLayoutHadOverflow(false);
  }
  // Clean and update all display: contents nodes with a direct path to the
  // current node as they will not be traversed
  cleanupContentsNodesRecursively(node, performLayout);

  // STEP 1: CALCULATE VALUES FOR REMAINDER OF ALGORITHM
  const mainAxis = resolveDirection(node.style.flexDirection(), direction);
  const crossAxis = resolveCrossDirection(mainAxis, direction);
  const isMainAxisRow = isRow(mainAxis);
  const isNodeFlexWrap = node.style.flexWrap() !== Wrap.NoWrap;

  const mainAxisOwnerSize = isMainAxisRow ? ownerWidth : ownerHeight;
  const crossAxisOwnerSize = isMainAxisRow ? ownerHeight : ownerWidth;

  const paddingAndBorderAxisMain = paddingAndBorderForAxis(node, mainAxis, direction, ownerWidth);
  const paddingAndBorderAxisCross = paddingAndBorderForAxis(node, crossAxis, direction, ownerWidth);
  const leadingPaddingAndBorderCross = node.style.computeFlexStartPaddingAndBorder(
    crossAxis,
    direction,
    ownerWidth,
  );

  let sizingModeMainDim = isMainAxisRow ? widthSizingMode : heightSizingMode;
  const sizingModeCrossDim = isMainAxisRow ? heightSizingMode : widthSizingMode;

  const paddingAndBorderAxisRow = isMainAxisRow
    ? paddingAndBorderAxisMain
    : paddingAndBorderAxisCross;
  const paddingAndBorderAxisColumn = isMainAxisRow
    ? paddingAndBorderAxisCross
    : paddingAndBorderAxisMain;

  // STEP 2: DETERMINE AVAILABLE SIZE IN MAIN AND CROSS DIRECTIONS

  const availableInnerWidth = calculateAvailableInnerDimension(
    node,
    direction,
    Dimension.Width,
    availableWidth - marginAxisRow,
    paddingAndBorderAxisRow,
    ownerWidth,
    ownerWidth,
  );
  const availableInnerHeight = calculateAvailableInnerDimension(
    node,
    direction,
    Dimension.Height,
    availableHeight - marginAxisColumn,
    paddingAndBorderAxisColumn,
    ownerHeight,
    ownerWidth,
  );

  let availableInnerMainDim = isMainAxisRow ? availableInnerWidth : availableInnerHeight;
  const availableInnerCrossDim = isMainAxisRow ? availableInnerHeight : availableInnerWidth;

  // STEP 3: DETERMINE FLEX BASIS FOR EACH ITEM

  // Computed basis + margins + gap
  let totalMainDim = 0;
  totalMainDim += computeFlexBasisForChildren(
    node,
    layoutChildren,
    availableInnerWidth,
    availableInnerHeight,
    availableInnerWidth,
    availableInnerHeight,
    widthSizingMode,
    heightSizingMode,
    direction,
    mainAxis,
    performLayout,
    layoutMarkerData,
    depth,
    generationCount,
  );

  if (childCount > 1) {
    totalMainDim +=
      node.style.computeGapForAxis(mainAxis, availableInnerMainDim) * (childCount - 1);
  }

  const mainAxisOverflows =
    sizingModeMainDim !== SizingMode.MaxContent && totalMainDim > availableInnerMainDim;

  if (isNodeFlexWrap && mainAxisOverflows && sizingModeMainDim === SizingMode.FitContent) {
    sizingModeMainDim = SizingMode.StretchFit;
  }
  // STEP 4: COLLECT FLEX ITEMS INTO FLEX LINES

  // Index of the first child of the current line.
  let startOfLineIndex = 0;

  // Number of lines.
  let lineCount = 0;

  // Accumulated cross dimensions of all lines so far.
  let totalLineCrossDim = 0;

  const crossAxisGap = node.style.computeGapForAxis(crossAxis, availableInnerCrossDim);

  // Max main dimension of all the lines.
  let maxLineMainDim = 0;
  const flexLine = (node.layout.flexLine ??= {
    itemsInFlow: [],
    sizeConsumed: 0,
    numberOfAutoMargins: 0,
    endIndex: 0,
    layout: {
      totalFlexGrowFactors: 0,
      totalFlexShrinkScaledFactors: 0,
      remainingFreeSpace: 0,
      mainDim: 0,
      crossDim: 0,
    },
  });
  const lineStarts = (node.layout.flexLineStarts ??= []);
  for (; startOfLineIndex < layoutChildren.length; lineCount++) {
    lineStarts[lineCount] = startOfLineIndex;
    calculateFlexLine(
      node,
      ownerDirection,
      ownerWidth,
      mainAxisOwnerSize,
      availableInnerWidth,
      availableInnerMainDim,
      layoutChildren,
      startOfLineIndex,
      lineCount,
      flexLine,
    );
    startOfLineIndex = flexLine.endIndex;

    // If we don't need to measure the cross axis, we can skip the entire flex
    // step.
    const canSkipFlex = !performLayout && sizingModeCrossDim === SizingMode.StretchFit;

    // STEP 5: RESOLVING FLEXIBLE LENGTHS ON MAIN AXIS
    // Calculate the remaining available space that needs to be allocated. If
    // the main dimension size isn't known, it is computed based on the line
    // length, so there's no more space left to distribute.

    let sizeBasedOnContent = false;
    // If we don't measure with exact main dimension we want to ensure we don't
    // violate min and max
    if (sizingModeMainDim !== SizingMode.StretchFit) {
      const style = node.style;
      const minInnerWidth =
        style.resolvedMinDimension(direction, Dimension.Width, ownerWidth, ownerWidth) -
        paddingAndBorderAxisRow;
      const maxInnerWidth =
        style.resolvedMaxDimension(direction, Dimension.Width, ownerWidth, ownerWidth) -
        paddingAndBorderAxisRow;
      const minInnerHeight =
        style.resolvedMinDimension(direction, Dimension.Height, ownerHeight, ownerWidth) -
        paddingAndBorderAxisColumn;
      const maxInnerHeight =
        style.resolvedMaxDimension(direction, Dimension.Height, ownerHeight, ownerWidth) -
        paddingAndBorderAxisColumn;

      const minInnerMainDim = isMainAxisRow ? minInnerWidth : minInnerHeight;
      const maxInnerMainDim = isMainAxisRow ? maxInnerWidth : maxInnerHeight;

      if (isDefined(minInnerMainDim) && flexLine.sizeConsumed < minInnerMainDim) {
        availableInnerMainDim = minInnerMainDim;
      } else if (isDefined(maxInnerMainDim) && flexLine.sizeConsumed > maxInnerMainDim) {
        availableInnerMainDim = maxInnerMainDim;
      } else {
        const useLegacyStretchBehaviour = node.hasErrata(Errata.StretchFlexBasis);

        if (
          !useLegacyStretchBehaviour &&
          ((isDefined(flexLine.layout.totalFlexGrowFactors) &&
            flexLine.layout.totalFlexGrowFactors === 0) ||
            (isDefined(node.resolveFlexGrow()) && node.resolveFlexGrow() === 0))
        ) {
          // If we don't have any children to flex or we can't flex the node
          // itself, space we've used is all space we need. Root node also
          // should be shrunk to minimum
          availableInnerMainDim = flexLine.sizeConsumed;
        }

        sizeBasedOnContent = !useLegacyStretchBehaviour;
      }
    }

    if (!sizeBasedOnContent && isDefined(availableInnerMainDim)) {
      flexLine.layout.remainingFreeSpace = availableInnerMainDim - flexLine.sizeConsumed;
    } else if (flexLine.sizeConsumed < 0) {
      // availableInnerMainDim is indefinite which means the node is being
      // sized based on its content. sizeConsumed is negative which means
      // the node will allocate 0 points for its content. Consequently,
      // remainingFreeSpace is 0 - sizeConsumed.
      flexLine.layout.remainingFreeSpace = -flexLine.sizeConsumed;
    }

    if (!canSkipFlex) {
      resolveFlexibleLength(
        node,
        flexLine,
        mainAxis,
        crossAxis,
        direction,
        ownerWidth,
        mainAxisOwnerSize,
        availableInnerMainDim,
        availableInnerCrossDim,
        availableInnerWidth,
        availableInnerHeight,
        mainAxisOverflows,
        sizingModeCrossDim,
        performLayout,
        layoutMarkerData,
        depth,
        generationCount,
      );
    }

    node.setLayoutHadOverflow(node.layout.hadOverflow() || flexLine.layout.remainingFreeSpace < 0);

    // STEP 6: MAIN-AXIS JUSTIFICATION & CROSS-AXIS SIZE DETERMINATION

    // At this point, all the children have their dimensions set in the main
    // axis. Their dimensions are also set in the cross axis with the exception
    // of items that are aligned "stretch". We need to compute these stretch
    // values and set the final positions.

    justifyMainAxis(
      node,
      flexLine,
      mainAxis,
      crossAxis,
      direction,
      sizingModeMainDim,
      sizingModeCrossDim,
      mainAxisOwnerSize,
      ownerWidth,
      availableInnerMainDim,
      availableInnerCrossDim,
      availableInnerWidth,
      performLayout,
    );

    let containerCrossAxis = availableInnerCrossDim;
    if (
      sizingModeCrossDim === SizingMode.MaxContent ||
      sizingModeCrossDim === SizingMode.FitContent
    ) {
      // Compute the cross axis from the max cross dimension of the children.
      containerCrossAxis =
        boundAxis(
          node,
          crossAxis,
          direction,
          flexLine.layout.crossDim + paddingAndBorderAxisCross,
          crossAxisOwnerSize,
          ownerWidth,
        ) - paddingAndBorderAxisCross;
    }

    // If there's no flex wrap, the cross dimension is defined by the
    // container.
    if (!isNodeFlexWrap && sizingModeCrossDim === SizingMode.StretchFit) {
      flexLine.layout.crossDim = availableInnerCrossDim;
    }

    // As-per https://www.w3.org/TR/css-flexbox-1/#cross-sizing, the
    // cross-size of the line within a single-line container should be bound
    // to min/max constraints before alignment within the line. In a
    // multi-line container, affecting alignment between the lines.
    if (!isNodeFlexWrap) {
      flexLine.layout.crossDim =
        boundAxis(
          node,
          crossAxis,
          direction,
          flexLine.layout.crossDim + paddingAndBorderAxisCross,
          crossAxisOwnerSize,
          ownerWidth,
        ) - paddingAndBorderAxisCross;
    }

    // STEP 7: CROSS-AXIS ALIGNMENT
    // We can skip child alignment if we're just measuring the container.
    if (performLayout) {
      for (const child of flexLine.itemsInFlow) {
        let leadingCrossDim = leadingPaddingAndBorderCross;

        // For a relative children, we're either using alignItems (owner) or
        // alignSelf (child) in order to determine the position in the cross
        // axis
        const alignItem = resolveChildAlignment(node, child);

        // If the child uses align stretch, we need to lay it out one more
        // time, this time forcing the cross-axis size to be the computed
        // cross size for the current line.
        if (
          alignItem === Align.Stretch &&
          !child.style.flexStartMarginIsAuto(crossAxis, direction) &&
          !child.style.flexEndMarginIsAuto(crossAxis, direction)
        ) {
          // If the child defines a definite size for its cross axis, there's
          // no need to stretch.
          if (!child.hasDefiniteLength(dimension(crossAxis), availableInnerCrossDim)) {
            let childMainSize = child.layout.measuredDimension(dimension(mainAxis));
            const childStyle = child.style;
            const childCrossSize = isDefined(childStyle.aspectRatio())
              ? child.style.computeMarginForAxis(crossAxis, availableInnerWidth) +
                (isMainAxisRow
                  ? childMainSize / childStyle.aspectRatio()
                  : childMainSize * childStyle.aspectRatio())
              : flexLine.layout.crossDim;

            childMainSize += child.style.computeMarginForAxis(mainAxis, availableInnerWidth);

            const childMainModeAndSize = scratchModeA;
            childMainModeAndSize.mode = SizingMode.StretchFit;
            childMainModeAndSize.size = childMainSize;
            constrainMaxSizeForMode(
              child,
              direction,
              mainAxis,
              availableInnerMainDim,
              availableInnerWidth,
              childMainModeAndSize,
            );
            const childCrossModeAndSize = scratchModeB;
            childCrossModeAndSize.mode = SizingMode.StretchFit;
            childCrossModeAndSize.size = childCrossSize;
            constrainMaxSizeForMode(
              child,
              direction,
              crossAxis,
              availableInnerCrossDim,
              availableInnerWidth,
              childCrossModeAndSize,
            );

            const childWidth = isMainAxisRow
              ? childMainModeAndSize.size
              : childCrossModeAndSize.size;
            const childHeight = !isMainAxisRow
              ? childMainModeAndSize.size
              : childCrossModeAndSize.size;

            const alignContent = node.style.alignContent();
            const crossAxisDoesNotGrow = alignContent !== Align.Stretch && isNodeFlexWrap;
            const childWidthSizingMode =
              isUndefined(childWidth) || (!isMainAxisRow && crossAxisDoesNotGrow)
                ? SizingMode.MaxContent
                : SizingMode.StretchFit;
            const childHeightSizingMode =
              isUndefined(childHeight) || (isMainAxisRow && crossAxisDoesNotGrow)
                ? SizingMode.MaxContent
                : SizingMode.StretchFit;

            calculateLayoutInternal(
              child,
              childWidth,
              childHeight,
              direction,
              childWidthSizingMode,
              childHeightSizingMode,
              availableInnerWidth,
              availableInnerHeight,
              true,
              LayoutPassReason.Stretch,
              layoutMarkerData,
              depth,
              generationCount,
            );
          }
        } else {
          const remainingCrossDim =
            containerCrossAxis - child.dimensionWithMargin(crossAxis, availableInnerWidth);

          if (
            child.style.flexStartMarginIsAuto(crossAxis, direction) &&
            child.style.flexEndMarginIsAuto(crossAxis, direction)
          ) {
            leadingCrossDim += maxOrDefined(0, remainingCrossDim / 2);
          } else if (child.style.flexEndMarginIsAuto(crossAxis, direction)) {
            // No-Op
          } else if (child.style.flexStartMarginIsAuto(crossAxis, direction)) {
            leadingCrossDim += maxOrDefined(0, remainingCrossDim);
          } else if (alignItem === Align.FlexStart) {
            // No-Op
          } else if (alignItem === Align.Center) {
            leadingCrossDim += remainingCrossDim / 2;
          } else {
            leadingCrossDim += remainingCrossDim;
          }
        }
        // And we apply the position
        child.setLayoutPosition(
          child.layout.position(flexStartEdge(crossAxis)) + totalLineCrossDim + leadingCrossDim,
          flexStartEdge(crossAxis),
        );
      }
    }

    const appliedCrossGap = lineCount !== 0 ? crossAxisGap : 0;
    totalLineCrossDim += flexLine.layout.crossDim + appliedCrossGap;
    maxLineMainDim = maxOrDefined(maxLineMainDim, flexLine.layout.mainDim);
  }

  // STEP 8: MULTI-LINE CONTENT ALIGNMENT
  // currentLead stores the size of the cross dim
  if (performLayout && (isNodeFlexWrap || isBaselineLayout(node))) {
    let leadPerLine = 0;
    let currentLead = leadingPaddingAndBorderCross;
    let extraSpacePerLine = 0;

    const unclampedCrossDim =
      sizingModeCrossDim === SizingMode.StretchFit
        ? availableInnerCrossDim + paddingAndBorderAxisCross
        : node.hasDefiniteLength(dimension(crossAxis), crossAxisOwnerSize)
          ? node.getResolvedDimension(
              direction,
              dimension(crossAxis),
              crossAxisOwnerSize,
              ownerWidth,
            )
          : totalLineCrossDim + paddingAndBorderAxisCross;

    const innerCrossDim =
      boundAxis(node, crossAxis, direction, unclampedCrossDim, crossAxisOwnerSize, ownerWidth) -
      paddingAndBorderAxisCross;

    const remainingAlignContentDim = innerCrossDim - totalLineCrossDim;

    const alignContent =
      remainingAlignContentDim >= 0
        ? node.style.alignContent()
        : fallbackAlignment(node.style.alignContent());

    switch (alignContent) {
      case Align.Start:
      case Align.End:
        // No-Op
        break;
      case Align.FlexEnd:
        currentLead += remainingAlignContentDim;
        break;
      case Align.Center:
        currentLead += remainingAlignContentDim / 2;
        break;
      case Align.Stretch:
        extraSpacePerLine = remainingAlignContentDim / lineCount;
        break;
      case Align.SpaceAround:
        currentLead += remainingAlignContentDim / (2 * lineCount);
        leadPerLine = remainingAlignContentDim / lineCount;
        break;
      case Align.SpaceEvenly:
        currentLead += remainingAlignContentDim / (lineCount + 1);
        leadPerLine = remainingAlignContentDim / (lineCount + 1);
        break;
      case Align.SpaceBetween:
        if (lineCount > 1) {
          leadPerLine = remainingAlignContentDim / (lineCount - 1);
        }
        break;
      case Align.Auto:
      case Align.FlexStart:
      case Align.Baseline:
        break;
    }

    for (let i = 0; i < lineCount; i++) {
      const lineStart = lineStarts[i]!;

      // compute the line's height and find the endIndex
      let lineHeight = 0;
      let maxAscentForCurrentLine = 0;
      let maxDescentForCurrentLine = 0;
      let endIndex = lineStart;
      for (let ii = lineStart; ii < layoutChildren.length; ii++) {
        const child = layoutChildren[ii]!;
        if (child.style.display() === Display.None) {
          endIndex = ii + 1;
          continue;
        }
        if (child.style.positionType() !== PositionType.Absolute) {
          if (child.lineIndex !== i) {
            break;
          }
          if (child.isLayoutDimensionDefined(crossAxis)) {
            lineHeight = maxOrDefined(
              lineHeight,
              child.layout.measuredDimension(dimension(crossAxis)) +
                child.style.computeMarginForAxis(crossAxis, availableInnerWidth),
            );
          }
          if (resolveChildAlignment(node, child) === Align.Baseline) {
            const ascent =
              calculateBaseline(child) +
              child.style.computeFlexStartMargin(
                FlexDirection.Column,
                direction,
                availableInnerWidth,
              );
            const descent =
              child.layout.measuredDimension(Dimension.Height) +
              child.style.computeMarginForAxis(FlexDirection.Column, availableInnerWidth) -
              ascent;
            maxAscentForCurrentLine = maxOrDefined(maxAscentForCurrentLine, ascent);
            maxDescentForCurrentLine = maxOrDefined(maxDescentForCurrentLine, descent);
            lineHeight = maxOrDefined(
              lineHeight,
              maxAscentForCurrentLine + maxDescentForCurrentLine,
            );
          }
        }
        endIndex = ii + 1;
      }
      currentLead += i !== 0 ? crossAxisGap : 0;
      lineHeight += extraSpacePerLine;

      for (let ii = lineStart; ii < endIndex; ii++) {
        const child = layoutChildren[ii]!;
        if (child.style.display() === Display.None) {
          continue;
        }
        if (child.style.positionType() !== PositionType.Absolute) {
          switch (resolveChildAlignment(node, child)) {
            case Align.Start:
            case Align.End:
              // Not yet implemented
              break;
            case Align.FlexStart: {
              child.setLayoutPosition(
                currentLead +
                  child.style.computeFlexStartPosition(crossAxis, direction, availableInnerWidth),
                flexStartEdge(crossAxis),
              );
              break;
            }
            case Align.FlexEnd: {
              child.setLayoutPosition(
                currentLead +
                  lineHeight -
                  child.style.computeFlexEndMargin(crossAxis, direction, availableInnerWidth) -
                  child.layout.measuredDimension(dimension(crossAxis)),
                flexStartEdge(crossAxis),
              );
              break;
            }
            case Align.Center: {
              const childHeight = child.layout.measuredDimension(dimension(crossAxis));

              child.setLayoutPosition(
                currentLead + (lineHeight - childHeight) / 2,
                flexStartEdge(crossAxis),
              );
              break;
            }
            case Align.Stretch: {
              child.setLayoutPosition(
                currentLead +
                  child.style.computeFlexStartMargin(crossAxis, direction, availableInnerWidth),
                flexStartEdge(crossAxis),
              );

              // Remeasure child with the line height as it as been only
              // measured with the owners height yet.
              if (!child.hasDefiniteLength(dimension(crossAxis), availableInnerCrossDim)) {
                const childWidth = isMainAxisRow
                  ? child.layout.measuredDimension(Dimension.Width) +
                    child.style.computeMarginForAxis(mainAxis, availableInnerWidth)
                  : leadPerLine + lineHeight;

                const childHeight = !isMainAxisRow
                  ? child.layout.measuredDimension(Dimension.Height) +
                    child.style.computeMarginForAxis(crossAxis, availableInnerWidth)
                  : leadPerLine + lineHeight;

                if (
                  !(
                    inexactEquals(childWidth, child.layout.measuredDimension(Dimension.Width)) &&
                    inexactEquals(childHeight, child.layout.measuredDimension(Dimension.Height))
                  )
                ) {
                  calculateLayoutInternal(
                    child,
                    childWidth,
                    childHeight,
                    direction,
                    SizingMode.StretchFit,
                    SizingMode.StretchFit,
                    availableInnerWidth,
                    availableInnerHeight,
                    true,
                    LayoutPassReason.MultilineStretch,
                    layoutMarkerData,
                    depth,
                    generationCount,
                  );
                }
              }
              break;
            }
            case Align.Baseline: {
              child.setLayoutPosition(
                currentLead +
                  maxAscentForCurrentLine -
                  calculateBaseline(child) +
                  child.style.computeFlexStartPosition(
                    FlexDirection.Column,
                    direction,
                    availableInnerCrossDim,
                  ),
                PhysicalEdge.Top,
              );

              break;
            }
            case Align.Auto:
            case Align.SpaceBetween:
            case Align.SpaceAround:
            case Align.SpaceEvenly:
              break;
          }
        }
      }

      currentLead = currentLead + leadPerLine + lineHeight;
    }
  }

  // STEP 9: COMPUTING FINAL DIMENSIONS

  node.setLayoutMeasuredDimension(
    boundAxis(
      node,
      FlexDirection.Row,
      direction,
      availableWidth - marginAxisRow,
      ownerWidth,
      ownerWidth,
    ),
    Dimension.Width,
  );

  node.setLayoutMeasuredDimension(
    boundAxis(
      node,
      FlexDirection.Column,
      direction,
      availableHeight - marginAxisColumn,
      ownerHeight,
      ownerWidth,
    ),
    Dimension.Height,
  );

  // If the user didn't specify a width or height for the node, set the
  // dimensions based on the children.
  if (
    sizingModeMainDim === SizingMode.MaxContent ||
    (node.style.overflow() !== Overflow.Scroll && sizingModeMainDim === SizingMode.FitContent)
  ) {
    // Clamp the size to the min/max size, if specified, and make sure it
    // doesn't go below the padding and border amount.
    node.setLayoutMeasuredDimension(
      boundAxis(node, mainAxis, direction, maxLineMainDim, mainAxisOwnerSize, ownerWidth),
      dimension(mainAxis),
    );
  } else if (
    sizingModeMainDim === SizingMode.FitContent &&
    node.style.overflow() === Overflow.Scroll
  ) {
    node.setLayoutMeasuredDimension(
      maxOrDefined(
        minOrDefined(
          availableInnerMainDim + paddingAndBorderAxisMain,
          boundAxisWithinMinAndMax(
            node,
            direction,
            mainAxis,
            maxLineMainDim,
            mainAxisOwnerSize,
            ownerWidth,
          ),
        ),
        paddingAndBorderAxisMain,
      ),
      dimension(mainAxis),
    );
  }

  if (
    sizingModeCrossDim === SizingMode.MaxContent ||
    (node.style.overflow() !== Overflow.Scroll && sizingModeCrossDim === SizingMode.FitContent)
  ) {
    // Clamp the size to the min/max size, if specified, and make sure it
    // doesn't go below the padding and border amount.
    node.setLayoutMeasuredDimension(
      boundAxis(
        node,
        crossAxis,
        direction,
        totalLineCrossDim + paddingAndBorderAxisCross,
        crossAxisOwnerSize,
        ownerWidth,
      ),
      dimension(crossAxis),
    );
  } else if (
    sizingModeCrossDim === SizingMode.FitContent &&
    node.style.overflow() === Overflow.Scroll
  ) {
    node.setLayoutMeasuredDimension(
      maxOrDefined(
        minOrDefined(
          availableInnerCrossDim + paddingAndBorderAxisCross,
          boundAxisWithinMinAndMax(
            node,
            direction,
            crossAxis,
            totalLineCrossDim + paddingAndBorderAxisCross,
            crossAxisOwnerSize,
            ownerWidth,
          ),
        ),
        paddingAndBorderAxisCross,
      ),
      dimension(crossAxis),
    );
  }

  // As we only wrapped in normal direction yet, we need to reverse the
  // positions on wrap-reverse.
  if (performLayout && node.style.flexWrap() === Wrap.WrapReverse) {
    for (const child of node.getLayoutChildren()) {
      if (child.style.positionType() !== PositionType.Absolute) {
        child.setLayoutPosition(
          node.layout.measuredDimension(dimension(crossAxis)) -
            child.layout.position(flexStartEdge(crossAxis)) -
            child.layout.measuredDimension(dimension(crossAxis)),
          flexStartEdge(crossAxis),
        );
      }
    }
  }

  if (performLayout) {
    // STEP 10: SETTING TRAILING POSITIONS FOR CHILDREN
    const needsMainTrailingPos = needsTrailingPosition(mainAxis);
    const needsCrossTrailingPos = needsTrailingPosition(crossAxis);

    if (needsMainTrailingPos || needsCrossTrailingPos) {
      for (const child of node.getLayoutChildren()) {
        // Absolute children will be handled by their containing block since we
        // cannot guarantee that their positions are set when their parents are
        // done with layout.
        if (
          child.style.display() === Display.None ||
          child.style.positionType() === PositionType.Absolute
        ) {
          continue;
        }
        if (needsMainTrailingPos) {
          setChildTrailingPosition(node, child, mainAxis);
        }

        if (needsCrossTrailingPos) {
          setChildTrailingPosition(node, child, crossAxis);
        }
      }
    }

    // STEP 11: SIZING AND POSITIONING ABSOLUTE CHILDREN
    // Let the containing block layout its absolute descendants.
    if (
      node.style.positionType() !== PositionType.Static ||
      node.alwaysFormsContainingBlock ||
      depth === 1
    ) {
      layoutAbsoluteDescendants(
        node,
        node,
        isMainAxisRow ? sizingModeMainDim : sizingModeCrossDim,
        direction,
        layoutMarkerData,
        depth,
        generationCount,
        0,
        0,
        availableInnerWidth,
        availableInnerHeight,
      );
    }
  }
}

//
// This is a wrapper around the calculateLayoutImpl function. It determines
// whether the layout request is redundant and can be skipped.
//
// Parameters:
//  Input parameters are the same as calculateLayoutImpl (see above)
//  Return parameter is true if layout was performed, false if skipped
//
export function calculateLayoutInternal(
  node: Node,
  availableWidth: number,
  availableHeight: number,
  ownerDirection: Direction,
  widthSizingMode: SizingMode,
  heightSizingMode: SizingMode,
  ownerWidth: number,
  ownerHeight: number,
  performLayout: boolean,
  reason: LayoutPassReason,
  layoutMarkerData: LayoutData,
  depth: number,
  generationCount: number,
): boolean {
  // An indefinite available size can only be measured as max-content. Yoga's
  // callers normally preserve this invariant, but combinations of nested
  // intrinsic sizing, aspect ratios, and flex constraints can lose the mode
  // while propagating an indefinite size. Normalize it here so the public API
  // remains total for otherwise valid style combinations.
  if (isUndefined(availableWidth)) {
    widthSizingMode = SizingMode.MaxContent;
  }
  if (isUndefined(availableHeight)) {
    heightSizingMode = SizingMode.MaxContent;
  }

  const layout = node.layout;

  depth++;

  const needToVisitNode =
    (node.isDirty() && layout.generationCount !== generationCount) ||
    layout.configVersion !== node.config.getVersion() ||
    layout.lastOwnerDirection !== ownerDirection;

  if (needToVisitNode) {
    // Invalidate the cached results.
    layout.nextCachedMeasurementsIndex = 0;
    layout.cachedLayout.availableWidth = -1;
    layout.cachedLayout.availableHeight = -1;
    layout.cachedLayout.widthSizingMode = SizingMode.MaxContent;
    layout.cachedLayout.heightSizingMode = SizingMode.MaxContent;
    layout.cachedLayout.computedWidth = -1;
    layout.cachedLayout.computedHeight = -1;
  }

  let cachedResults: CachedMeasurement | null = null;

  // Determine whether the results are already cached. We maintain a separate
  // cache for layouts and measurements. A layout operation modifies the
  // positions and dimensions for nodes in the subtree. The algorithm assumes
  // that each node gets laid out a maximum of one time per tree layout, but
  // multiple measurements may be required to resolve all of the flex
  // dimensions. We handle nodes with measure functions specially here because
  // they are the most expensive to measure, so it's worth avoiding redundant
  // measurements if at all possible.
  if (node.hasMeasureFunc()) {
    const marginAxisRow = node.style.computeMarginForAxis(FlexDirection.Row, ownerWidth);
    const marginAxisColumn = node.style.computeMarginForAxis(FlexDirection.Column, ownerWidth);

    // First, try to use the layout cache.
    if (
      canUseCachedMeasurement(
        widthSizingMode,
        availableWidth,
        heightSizingMode,
        availableHeight,
        layout.cachedLayout.widthSizingMode,
        layout.cachedLayout.availableWidth,
        layout.cachedLayout.heightSizingMode,
        layout.cachedLayout.availableHeight,
        layout.cachedLayout.computedWidth,
        layout.cachedLayout.computedHeight,
        marginAxisRow,
        marginAxisColumn,
        node.config,
      )
    ) {
      cachedResults = layout.cachedLayout;
    } else {
      // Try to use the measurement cache.
      for (let i = 0; i < layout.nextCachedMeasurementsIndex; i++) {
        if (
          canUseCachedMeasurement(
            widthSizingMode,
            availableWidth,
            heightSizingMode,
            availableHeight,
            layout.cachedMeasurements[i]!.widthSizingMode,
            layout.cachedMeasurements[i]!.availableWidth,
            layout.cachedMeasurements[i]!.heightSizingMode,
            layout.cachedMeasurements[i]!.availableHeight,
            layout.cachedMeasurements[i]!.computedWidth,
            layout.cachedMeasurements[i]!.computedHeight,
            marginAxisRow,
            marginAxisColumn,
            node.config,
          )
        ) {
          cachedResults = layout.cachedMeasurements[i]!;
          break;
        }
      }
    }
  } else if (performLayout) {
    if (
      inexactEquals(layout.cachedLayout.availableWidth, availableWidth) &&
      inexactEquals(layout.cachedLayout.availableHeight, availableHeight) &&
      layout.cachedLayout.widthSizingMode === widthSizingMode &&
      layout.cachedLayout.heightSizingMode === heightSizingMode
    ) {
      cachedResults = layout.cachedLayout;
    }
  } else {
    for (let i = 0; i < layout.nextCachedMeasurementsIndex; i++) {
      if (
        inexactEquals(layout.cachedMeasurements[i]!.availableWidth, availableWidth) &&
        inexactEquals(layout.cachedMeasurements[i]!.availableHeight, availableHeight) &&
        layout.cachedMeasurements[i]!.widthSizingMode === widthSizingMode &&
        layout.cachedMeasurements[i]!.heightSizingMode === heightSizingMode
      ) {
        cachedResults = layout.cachedMeasurements[i]!;
        break;
      }
    }
  }

  if (!needToVisitNode && cachedResults !== null) {
    layout.setMeasuredDimension(Dimension.Width, cachedResults.computedWidth);
    layout.setMeasuredDimension(Dimension.Height, cachedResults.computedHeight);

    if (performLayout) {
      layoutMarkerData.cachedLayouts += 1;
    } else {
      layoutMarkerData.cachedMeasures += 1;
    }
  } else {
    calculateLayoutImpl(
      node,
      availableWidth,
      availableHeight,
      ownerDirection,
      widthSizingMode,
      heightSizingMode,
      ownerWidth,
      ownerHeight,
      performLayout,
      reason,
      layoutMarkerData,
      depth,
      generationCount,
    );

    layout.lastOwnerDirection = ownerDirection;
    layout.configVersion = node.config.getVersion();

    if (cachedResults === null) {
      layoutMarkerData.maxMeasureCache = Math.max(
        layoutMarkerData.maxMeasureCache,
        layout.nextCachedMeasurementsIndex + 1,
      );

      if (layout.nextCachedMeasurementsIndex === LayoutResults.MaxCachedMeasurements) {
        layout.nextCachedMeasurementsIndex = 0;
      }

      let newCacheEntry;
      if (performLayout) {
        // Use the single layout cache entry.
        newCacheEntry = layout.cachedLayout;
      } else {
        // Allocate a new measurement cache entry.
        newCacheEntry = layout.cachedMeasurements[layout.nextCachedMeasurementsIndex] ??=
          new CachedMeasurement();
        layout.nextCachedMeasurementsIndex++;
      }

      newCacheEntry.availableWidth = availableWidth;
      newCacheEntry.availableHeight = availableHeight;
      newCacheEntry.widthSizingMode = widthSizingMode;
      newCacheEntry.heightSizingMode = heightSizingMode;
      newCacheEntry.computedWidth = layout.measuredDimension(Dimension.Width);
      newCacheEntry.computedHeight = layout.measuredDimension(Dimension.Height);
    }
  }

  if (performLayout) {
    node.setLayoutDimension(node.layout.measuredDimension(Dimension.Width), Dimension.Width);
    node.setLayoutDimension(node.layout.measuredDimension(Dimension.Height), Dimension.Height);

    node.hasNewLayout_ = true;
    node.setDirty(false);
  }

  layout.generationCount = generationCount;

  return needToVisitNode || cachedResults === null;
}

export function calculateLayout(
  node: Node,
  ownerWidth: number,
  ownerHeight: number,
  ownerDirection: Direction,
): void {
  const markerData = newLayoutData();

  // Increment the generation count. This will force the recursive routine to
  // visit all dirty nodes at least once. Subsequent visits will be skipped if
  // the input parameters don't change.
  const currentGenerationCount = ++gCurrentGenerationCount;
  node.processDimensions();
  const direction = node.resolveDirection(ownerDirection);
  let width = NaN;
  let widthSizingMode: SizingMode = SizingMode.MaxContent;
  const style = node.style;
  if (node.hasDefiniteLength(Dimension.Width, ownerWidth)) {
    width =
      node.getResolvedDimension(direction, dimension(FlexDirection.Row), ownerWidth, ownerWidth) +
      node.style.computeMarginForAxis(FlexDirection.Row, ownerWidth);
    widthSizingMode = SizingMode.StretchFit;
  } else if (
    isDefined(style.resolvedMaxDimension(direction, Dimension.Width, ownerWidth, ownerWidth))
  ) {
    width = style.resolvedMaxDimension(direction, Dimension.Width, ownerWidth, ownerWidth);
    widthSizingMode = SizingMode.FitContent;
  } else {
    width = ownerWidth;
    widthSizingMode = isUndefined(width) ? SizingMode.MaxContent : SizingMode.StretchFit;
  }

  let height = NaN;
  let heightSizingMode: SizingMode = SizingMode.MaxContent;
  if (node.hasDefiniteLength(Dimension.Height, ownerHeight)) {
    height =
      node.getResolvedDimension(
        direction,
        dimension(FlexDirection.Column),
        ownerHeight,
        ownerWidth,
      ) + node.style.computeMarginForAxis(FlexDirection.Column, ownerWidth);
    heightSizingMode = SizingMode.StretchFit;
  } else if (
    isDefined(style.resolvedMaxDimension(direction, Dimension.Height, ownerHeight, ownerWidth))
  ) {
    height = style.resolvedMaxDimension(direction, Dimension.Height, ownerHeight, ownerWidth);
    heightSizingMode = SizingMode.FitContent;
  } else {
    height = ownerHeight;
    heightSizingMode = isUndefined(height) ? SizingMode.MaxContent : SizingMode.StretchFit;
  }
  const generationCount = node.config.isExperimentalFeatureEnabled(
    ExperimentalFeature.FixFlexBasisFitContent,
  )
    ? currentGenerationCount
    : gCurrentGenerationCount;
  if (
    calculateLayoutInternal(
      node,
      width,
      height,
      ownerDirection,
      widthSizingMode,
      heightSizingMode,
      ownerWidth,
      ownerHeight,
      true,
      LayoutPassReason.Initial,
      markerData,
      0, // tree root
      generationCount,
    )
  ) {
    node.setPositionFromStyle(node.layout.direction(), ownerWidth, ownerHeight);
    roundLayoutResultsToPixelGrid(node, 0, 0);
  }
}
