// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

// Port of yoga/node/Node.h and yoga/node/Node.cpp, including the
// LayoutableChildren traversal from yoga/node/LayoutableChildren.h.
//
// The persistence/cloning machinery (owners distinct from parents, clone
// callbacks) is not exposed through the JS binding, so children are always
// uniquely owned and cloneChildrenIfNeeded is a no-op.

import { Config, configUpdateInvalidatesLayout, getDefaultConfig } from "#/yoga/core/config.ts";
import {
  PhysicalEdge,
  dimension,
  inlineStartEdge,
  inlineEndEdge,
  isRow,
  resolveCrossDirection,
  resolveDirection,
} from "#/yoga/core/helpers.ts";
import { LayoutResults } from "#/yoga/core/layoutResults.ts";
import { isDefined, isUndefined, maxOrDefined } from "#/yoga/core/numeric.ts";
import { Style } from "#/yoga/core/style.ts";
import type { Size, StyleSizeLength } from "#/yoga/core/types.ts";
import { StyleSizeLength as SizeLength } from "#/yoga/core/types.ts";
import {
  Align,
  BoxSizing,
  Dimension,
  Direction,
  Display,
  FlexDirection,
  MeasureMode,
  NodeType,
  PositionType,
} from "#/yoga/generated/YGEnums.ts";

export type MeasureFunc = (
  width: number,
  widthMode: MeasureMode,
  height: number,
  heightMode: MeasureMode,
) => Size;

export type BaselineFunc = (width: number, height: number) => number;

export type DirtiedFunc = () => void;

export class Node {
  hasNewLayout_ = true;
  isReferenceBaseline_ = false;
  private isDirty_ = true;
  alwaysFormsContainingBlock = false;
  nodeType: NodeType = NodeType.Default;
  private measureFunc_: MeasureFunc | null = null;
  private measureResult_: Size | null = null;
  private baselineFunc_: BaselineFunc | null = null;
  private dirtiedFunc_: DirtiedFunc | null = null;
  style: Style = new Style();
  layout: LayoutResults = new LayoutResults();
  lineIndex = 0;
  private contentsChildrenCount_ = 0;
  owner: Node | null = null;
  children: Node[] = [];
  config: Config;
  private processedDimensionWidth_: StyleSizeLength = SizeLength.undefined();
  private processedDimensionHeight_: StyleSizeLength = SizeLength.undefined();
  private dimensionsDirty_ = true;

  constructor(config: Config = getDefaultConfig()) {
    this.config = config;
    if (config.useWebDefaults()) {
      this.style.setFlexDirection(FlexDirection.Row);
      this.style.setAlignContent(Align.Stretch);
    }
  }

  hasMeasureFunc(): boolean {
    return this.measureFunc_ !== null;
  }

  measure(
    availableWidth: number,
    widthMode: MeasureMode,
    availableHeight: number,
    heightMode: MeasureMode,
  ): Size {
    const size = this.measureFunc_!(availableWidth, widthMode, availableHeight, heightMode);

    const width = size.width === undefined || size.width === null ? NaN : size.width;
    const height = size.height === undefined || size.height === null ? NaN : size.height;

    const result = (this.measureResult_ ??= { width: 0, height: 0 });

    if (isUndefined(height) || height < 0 || isUndefined(width) || width < 0) {
      result.width = maxOrDefined(0, width);
      result.height = maxOrDefined(0, height);
    } else {
      result.width = width;
      result.height = height;
    }

    return result;
  }

  hasBaselineFunc(): boolean {
    return this.baselineFunc_ !== null;
  }

  baseline(width: number, height: number): number {
    return this.baselineFunc_!(width, height);
  }

  getDirtiedFunc(): DirtiedFunc | null {
    return this.dirtiedFunc_;
  }

  dimensionWithMargin(axis: FlexDirection, widthSize: number): number {
    return (
      this.layout.measuredDimension(dimension(axis)) +
      this.style.computeMarginForAxis(axis, widthSize)
    );
  }

  isLayoutDimensionDefined(axis: FlexDirection): boolean {
    const value = this.layout.measuredDimension(dimension(axis));
    return isDefined(value) && value >= 0;
  }

  /**
   * Whether the node has a "definite length" along the given axis.
   * https://www.w3.org/TR/css-sizing-3/#definite
   */
  hasDefiniteLength(dim: Dimension, ownerSize: number): boolean {
    const usedValue = this.getProcessedDimension(dim).resolve(ownerSize);
    return isDefined(usedValue) && usedValue >= 0;
  }

  hasErrata(errata: number): boolean {
    return this.config.hasErrata(errata);
  }

  hasContentsChildren(): boolean {
    return this.contentsChildrenCount_ !== 0;
  }

  getChildCount(): number {
    return this.children.length;
  }

  getChild(index: number): Node {
    return this.children[index]!;
  }

  /**
   * Children for layout purposes: skips display: contents nodes, splicing
   * their children in place. Returns the raw children array when nothing
   * needs splicing — do not mutate the result.
   */
  getLayoutChildren(): readonly Node[] {
    if (this.contentsChildrenCount_ === 0) {
      return this.children;
    }
    const result: Node[] = [];
    appendLayoutChildren(this, result);
    return result;
  }

  getLayoutChildCount(): number {
    if (this.contentsChildrenCount_ === 0) {
      return this.children.length;
    }
    return this.getLayoutChildren().length;
  }

  isDirty(): boolean {
    return this.isDirty_;
  }

  getProcessedDimension(dim: Dimension): StyleSizeLength {
    return dim === Dimension.Width ? this.processedDimensionWidth_ : this.processedDimensionHeight_;
  }

  getResolvedDimension(
    direction: Direction,
    dim: Dimension,
    referenceLength: number,
    ownerWidth: number,
  ): number {
    const value = this.getProcessedDimension(dim).resolve(referenceLength);
    if (this.style.boxSizing() === BoxSizing.BorderBox) {
      return value;
    }

    const dimensionPaddingAndBorder = this.style.computePaddingAndBorderForDimension(
      direction,
      dim,
      ownerWidth,
    );

    return value + (isDefined(dimensionPaddingAndBorder) ? dimensionPaddingAndBorder : 0);
  }

  // Setters

  setMeasureFunc(measureFunc: MeasureFunc | null): void {
    if (measureFunc === null) {
      this.nodeType = NodeType.Default;
    } else {
      if (this.children.length !== 0) {
        throw new Error(
          "Cannot set measure function: Nodes with measure functions cannot have children.",
        );
      }
      this.nodeType = NodeType.Text;
    }

    this.measureFunc_ = measureFunc;
    // nodeType selects text rounding behavior, which is a pixel-grid input.
    this.markLayoutWritten();
  }

  setBaselineFunc(baselineFunc: BaselineFunc | null): void {
    this.baselineFunc_ = baselineFunc;
  }

  setCoreDirtiedFunc(dirtiedFunc: DirtiedFunc | null): void {
    this.dirtiedFunc_ = dirtiedFunc;
  }

  insertChild(child: Node, index: number): void {
    if (child.style.display() === Display.Contents) {
      this.contentsChildrenCount_++;
    }

    if (index === this.children.length) {
      this.children.push(child);
    } else {
      this.children.splice(index, 0, child);
    }
  }

  setConfig(config: Config): void {
    if (config.useWebDefaults() !== this.config.useWebDefaults()) {
      throw new Error("UseWebDefaults may not be changed after constructing a Node");
    }

    if (configUpdateInvalidatesLayout(this.config, config)) {
      this.markDirtyAndPropagate();
      this.layout.configVersion = 0;
    } else {
      // If the config is functionally the same, then align the configVersion
      // so that we can reuse the layout cache
      this.layout.configVersion = config.getVersion();
    }

    this.config = config;
  }

  setDirty(isDirty: boolean): void {
    if (isDirty === this.isDirty_) {
      return;
    }
    this.isDirty_ = isDirty;
    if (isDirty && this.dirtiedFunc_ !== null) {
      this.dirtiedFunc_();
    }
  }

  setChildren(children: Node[]): void {
    this.children = children.slice();

    this.contentsChildrenCount_ = 0;
    for (const child of children) {
      if (child.style.display() === Display.Contents) {
        this.contentsChildrenCount_++;
      }
    }
  }

  removeChild(child: Node): boolean {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      if (child.style.display() === Display.Contents) {
        this.contentsChildrenCount_--;
      }

      this.children.splice(index, 1);
      return true;
    }
    return false;
  }

  removeChildAtIndex(index: number): void {
    if (this.children[index]!.style.display() === Display.Contents) {
      this.contentsChildrenCount_--;
    }

    this.children.splice(index, 1);
  }

  clearChildren(): void {
    this.children = [];
  }

  // Called by the public wrapper when a child's display changes between
  // Contents and something else while attached.
  syncContentsChildrenCount(): void {
    this.contentsChildrenCount_ = 0;
    for (const child of this.children) {
      if (child.style.display() === Display.Contents) {
        this.contentsChildrenCount_++;
      }
    }
  }

  setLayoutDirection(direction: Direction): void {
    this.layout.setDirection(direction);
  }

  setLayoutMargin(margin: number, edge: PhysicalEdge): void {
    this.layout.setMargin(edge, margin);
  }

  setLayoutBorder(border: number, edge: PhysicalEdge): void {
    this.layout.setBorder(edge, border);
  }

  setLayoutPadding(padding: number, edge: PhysicalEdge): void {
    this.layout.setPadding(edge, padding);
  }

  setLayoutLastOwnerDirection(direction: Direction): void {
    this.layout.lastOwnerDirection = direction;
  }

  setLayoutComputedFlexBasis(computedFlexBasis: number): void {
    this.layout.computedFlexBasis = computedFlexBasis;
  }

  // Marks this node's rounding state (and its ancestors') dirty. Ancestors
  // are marked together with descendants, so an already-set flag means the
  // whole ancestor chain is set.
  markLayoutWritten(): void {
    if (this.layout.roundingDirty) {
      return;
    }
    this.layout.roundingDirty = true;
    let node = this.owner;
    while (node !== null && !node.layout.roundingDirty) {
      node.layout.roundingDirty = true;
      node = node.owner;
    }
  }

  setLayoutPosition(position: number, edge: PhysicalEdge): void {
    // Only value-changing writes dirty the pixel-grid state — rewriting an
    // identical value leaves every rounding input unchanged. Object.is treats
    // NaN as equal to itself (and only over-marks on -0 vs 0).
    const value = position;
    if (!Object.is(this.layout.position(edge), value)) {
      this.layout.setPosition(edge, value);
      this.markLayoutWritten();
    }
  }

  setLayoutComputedFlexBasisGeneration(computedFlexBasisGeneration: number): void {
    this.layout.computedFlexBasisGeneration = computedFlexBasisGeneration;
  }

  setLayoutMeasuredDimension(measuredDimension: number, dim: Dimension): void {
    this.layout.setMeasuredDimension(dim, measuredDimension);
  }

  setLayoutHadOverflow(hadOverflow: boolean): void {
    this.layout.setHadOverflow(hadOverflow);
  }

  setLayoutDimension(lengthValue: number, dim: Dimension): void {
    const value = lengthValue;
    if (
      !Object.is(this.layout.dimension(dim), value) ||
      !Object.is(this.layout.rawDimension(dim), value)
    ) {
      this.layout.setDimension(dim, value);
      this.layout.setRawDimension(dim, value);
      this.markLayoutWritten();
    }
  }

  // If both left and right are defined, then use left. Otherwise return +left
  // or -right depending on which is defined. Ignore statically positioned
  // nodes as insets do not apply to them.
  relativePosition(axis: FlexDirection, direction: Direction, axisSize: number): number {
    if (this.style.positionType() === PositionType.Static) {
      return 0;
    }
    if (
      this.style.isInlineStartPositionDefined(axis, direction) &&
      !this.style.isInlineStartPositionAuto(axis, direction)
    ) {
      return this.style.computeInlineStartPosition(axis, direction, axisSize);
    }

    return -1 * this.style.computeInlineEndPosition(axis, direction, axisSize);
  }

  setPositionFromStyle(direction: Direction, ownerWidth: number, ownerHeight: number): void {
    if (!this.style.hasPositionOrMargin()) {
      this.setLayoutPosition(0, PhysicalEdge.Left);
      this.setLayoutPosition(0, PhysicalEdge.Top);
      this.setLayoutPosition(0, PhysicalEdge.Right);
      this.setLayoutPosition(0, PhysicalEdge.Bottom);
      return;
    }
    /* Root nodes should be always layouted as LTR, so we don't return negative
     * values. */
    const directionRespectingRoot = this.owner !== null ? direction : Direction.LTR;
    const mainAxis = resolveDirection(this.style.flexDirection(), directionRespectingRoot);
    const crossAxis = resolveCrossDirection(mainAxis, directionRespectingRoot);

    // In the case of position static these are just 0. See:
    // https://www.w3.org/TR/css-position-3/#valdef-position-static
    const relativePositionMain = this.relativePosition(
      mainAxis,
      directionRespectingRoot,
      isRow(mainAxis) ? ownerWidth : ownerHeight,
    );
    const relativePositionCross = this.relativePosition(
      crossAxis,
      directionRespectingRoot,
      isRow(mainAxis) ? ownerHeight : ownerWidth,
    );

    const mainAxisLeadingEdge = inlineStartEdge(mainAxis, direction);
    const mainAxisTrailingEdge = inlineEndEdge(mainAxis, direction);
    const crossAxisLeadingEdge = inlineStartEdge(crossAxis, direction);
    const crossAxisTrailingEdge = inlineEndEdge(crossAxis, direction);

    this.setLayoutPosition(
      this.style.computeInlineStartMargin(mainAxis, direction, ownerWidth) + relativePositionMain,
      mainAxisLeadingEdge,
    );
    this.setLayoutPosition(
      this.style.computeInlineEndMargin(mainAxis, direction, ownerWidth) + relativePositionMain,
      mainAxisTrailingEdge,
    );
    this.setLayoutPosition(
      this.style.computeInlineStartMargin(crossAxis, direction, ownerWidth) + relativePositionCross,
      crossAxisLeadingEdge,
    );
    this.setLayoutPosition(
      this.style.computeInlineEndMargin(crossAxis, direction, ownerWidth) + relativePositionCross,
      crossAxisTrailingEdge,
    );
  }

  processFlexBasis(): StyleSizeLength {
    const flexBasis = this.style.flexBasis();
    if (!flexBasis.isAuto() && !flexBasis.isUndefined()) {
      return flexBasis;
    }
    if (isDefined(this.style.flex()) && this.style.flex() > 0) {
      return this.config.useWebDefaults() ? SizeLength.ofAuto() : SizeLength.points(0);
    }
    return SizeLength.ofAuto();
  }

  resolveFlexBasis(
    direction: Direction,
    flexDirection: FlexDirection,
    referenceLength: number,
    ownerWidth: number,
  ): number {
    const value = this.processFlexBasis().resolve(referenceLength);
    if (this.style.boxSizing() === BoxSizing.BorderBox) {
      return value;
    }

    const dim = dimension(flexDirection);
    const dimensionPaddingAndBorder = this.style.computePaddingAndBorderForDimension(
      direction,
      dim,
      ownerWidth,
    );

    return value + (isDefined(dimensionPaddingAndBorder) ? dimensionPaddingAndBorder : 0);
  }

  processDimensions(): void {
    if (!this.dimensionsDirty_) {
      return;
    }
    for (let dim = Dimension.Width; dim <= Dimension.Height; dim++) {
      const maxDimension = this.style.maxDimension(dim);
      const processed =
        maxDimension.isDefined() && maxDimension.inexactEquals(this.style.minDimension(dim))
          ? maxDimension
          : this.style.dimension(dim);
      if (dim === Dimension.Width) {
        this.processedDimensionWidth_ = processed;
      } else {
        this.processedDimensionHeight_ = processed;
      }
    }
    this.dimensionsDirty_ = false;
  }

  invalidateProcessedDimensions(): void {
    this.dimensionsDirty_ = true;
  }

  resolveDirection(ownerDirection: Direction): Direction {
    if (this.style.direction() === Direction.Inherit) {
      return ownerDirection !== Direction.Inherit ? ownerDirection : Direction.LTR;
    } else {
      return this.style.direction();
    }
  }

  cloneChildrenIfNeeded(): void {
    // No-op: the JS binding does not support shared subtrees, so children are
    // always uniquely owned by their parent.
  }

  cloneContentsChildrenIfNeeded(): void {
    // No-op: see cloneChildrenIfNeeded.
  }

  markDirtyAndPropagate(): void {
    if (!this.isDirty_) {
      this.setDirty(true);
      this.setLayoutComputedFlexBasis(NaN);
      if (this.owner !== null) {
        this.owner.markDirtyAndPropagate();
      }
    }
  }

  resolveFlexGrow(): number {
    // Root nodes flexGrow should always be 0
    if (this.owner === null) {
      return 0;
    }
    if (isDefined(this.style.flexGrow())) {
      return this.style.flexGrow();
    }
    if (isDefined(this.style.flex()) && this.style.flex() > 0) {
      return this.style.flex();
    }
    return Style.DefaultFlexGrow;
  }

  resolveFlexShrink(): number {
    if (this.owner === null) {
      return 0;
    }
    if (isDefined(this.style.flexShrink())) {
      return this.style.flexShrink();
    }
    if (!this.config.useWebDefaults() && isDefined(this.style.flex()) && this.style.flex() < 0) {
      return -this.style.flex();
    }
    return this.config.useWebDefaults() ? Style.WebDefaultFlexShrink : Style.DefaultFlexShrink;
  }

  isNodeFlexible(): boolean {
    return (
      this.style.positionType() !== PositionType.Absolute &&
      (this.resolveFlexGrow() !== 0 || this.resolveFlexShrink() !== 0)
    );
  }

  reset(): void {
    if (this.children.length !== 0) {
      throw new Error("Cannot reset a node which still has children attached");
    }
    if (this.owner !== null) {
      throw new Error("Cannot reset a node still attached to a owner");
    }

    const fresh = new Node(this.config);
    this.hasNewLayout_ = fresh.hasNewLayout_;
    this.isReferenceBaseline_ = fresh.isReferenceBaseline_;
    this.isDirty_ = true;
    this.alwaysFormsContainingBlock = fresh.alwaysFormsContainingBlock;
    this.nodeType = fresh.nodeType;
    this.measureFunc_ = null;
    this.measureResult_ = null;
    this.baselineFunc_ = null;
    this.dirtiedFunc_ = null;
    this.style = fresh.style;
    this.layout = fresh.layout;
    this.lineIndex = 0;
    this.contentsChildrenCount_ = 0;
    this.children = [];
    this.processedDimensionWidth_ = SizeLength.undefined();
    this.processedDimensionHeight_ = SizeLength.undefined();
    this.dimensionsDirty_ = true;
  }
}

function appendLayoutChildren(node: Node, out: Node[]): void {
  for (const child of node.children) {
    if (child.style.display() === Display.Contents) {
      appendLayoutChildren(child, out);
    } else {
      out.push(child);
    }
  }
}
