// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

// Port of yoga/style/Style.h (grid properties omitted — the JS binding does
// not expose them and no algorithm consumes them).

import {
  PhysicalEdge,
  flexStartEdge,
  flexEndEdge,
  inlineStartEdge,
  inlineEndEdge,
  isRow,
} from "#/yoga/core/helpers.ts";
import { isDefined, maxOrDefined } from "#/yoga/core/numeric.ts";
import { StyleLength, StyleSizeLength } from "#/yoga/core/types.ts";
import {
  Align,
  BoxSizing,
  Dimension,
  Direction,
  Display,
  Edge,
  FlexDirection,
  Gutter,
  Justify,
  Overflow,
  PositionType,
  Unit,
  Wrap,
} from "#/yoga/generated/YGEnums.ts";

const EDGE_COUNT = 9;
const GUTTER_COUNT = 3;

function undefinedLengths(count: number): StyleLength[] {
  return Array.from<StyleLength>({ length: count }).fill(StyleLength.undefined());
}

// Physical-edge resolution results for one edge collection: the resolved
// StyleLength per [direction * 4 + physicalEdge], plus parallel primitive
// unit/value views for allocation-free numeric resolution.
interface ResolvedEdges {
  lengths: StyleLength[];
  units: Uint8Array;
  values: number[];
}

export class Style {
  static readonly DefaultFlexGrow = 0.0;
  static readonly DefaultFlexShrink = 0.0;
  static readonly WebDefaultFlexShrink = 1.0;

  private direction_: Direction = Direction.Inherit;
  private flexDirection_: FlexDirection = FlexDirection.Column;
  private justifyContent_: Justify = Justify.FlexStart;
  private justifyItems_: Justify = Justify.Stretch;
  private justifySelf_: Justify = Justify.Auto;
  private alignContent_: Align = Align.FlexStart;
  private alignItems_: Align = Align.Stretch;
  private alignSelf_: Align = Align.Auto;
  private positionType_: PositionType = PositionType.Relative;
  private flexWrap_: Wrap = Wrap.NoWrap;
  private overflow_: Overflow = Overflow.Visible;
  private display_: Display = Display.Flex;
  private boxSizing_: BoxSizing = BoxSizing.BorderBox;

  private flex_ = NaN;
  private flexGrow_ = NaN;
  private flexShrink_ = NaN;
  private flexBasis_: StyleSizeLength = StyleSizeLength.ofAuto();
  // Edge arrays are allocated lazily on first set — most nodes never define
  // most of these, and a null array reads as all-undefined.
  private margin_: StyleLength[] | null = null;
  private position_: StyleLength[] | null = null;
  private padding_: StyleLength[] | null = null;
  private border_: StyleLength[] | null = null;
  private gap_: StyleLength[] | null = null;

  // Memoized physical-edge resolution (a pure function of the 9 logical-edge
  // slots and the direction). Indexed [direction * 4 + physicalEdge];
  // invalidated whenever the corresponding edge array is written. The
  // parallel unit/value arrays let hot paths resolve without object hops.
  private marginResolved_: ResolvedEdges | null = null;
  private positionResolved_: ResolvedEdges | null = null;
  private paddingResolved_: ResolvedEdges | null = null;
  private borderResolved_: ResolvedEdges | null = null;
  // Width/height, min-width/min-height, max-width/max-height.
  private dimensions_: StyleSizeLength[] = [
    StyleSizeLength.ofAuto(),
    StyleSizeLength.ofAuto(),
    StyleSizeLength.undefined(),
    StyleSizeLength.undefined(),
    StyleSizeLength.undefined(),
    StyleSizeLength.undefined(),
  ];
  private aspectRatio_ = NaN;

  direction(): Direction {
    return this.direction_;
  }
  setDirection(value: Direction): void {
    this.direction_ = value;
  }

  flexDirection(): FlexDirection {
    return this.flexDirection_;
  }
  setFlexDirection(value: FlexDirection): void {
    this.flexDirection_ = value;
  }

  justifyContent(): Justify {
    return this.justifyContent_;
  }
  setJustifyContent(value: Justify): void {
    this.justifyContent_ = value;
  }

  justifyItems(): Justify {
    return this.justifyItems_;
  }
  setJustifyItems(value: Justify): void {
    this.justifyItems_ = value;
  }

  justifySelf(): Justify {
    return this.justifySelf_;
  }
  setJustifySelf(value: Justify): void {
    this.justifySelf_ = value;
  }

  alignContent(): Align {
    return this.alignContent_;
  }
  setAlignContent(value: Align): void {
    this.alignContent_ = value;
  }

  alignItems(): Align {
    return this.alignItems_;
  }
  setAlignItems(value: Align): void {
    this.alignItems_ = value;
  }

  alignSelf(): Align {
    return this.alignSelf_;
  }
  setAlignSelf(value: Align): void {
    this.alignSelf_ = value;
  }

  positionType(): PositionType {
    return this.positionType_;
  }
  setPositionType(value: PositionType): void {
    this.positionType_ = value;
  }

  flexWrap(): Wrap {
    return this.flexWrap_;
  }
  setFlexWrap(value: Wrap): void {
    this.flexWrap_ = value;
  }

  overflow(): Overflow {
    return this.overflow_;
  }
  setOverflow(value: Overflow): void {
    this.overflow_ = value;
  }

  display(): Display {
    return this.display_;
  }
  setDisplay(value: Display): void {
    this.display_ = value;
  }

  flex(): number {
    return this.flex_;
  }
  setFlex(value: number): void {
    this.flex_ = value;
  }

  flexGrow(): number {
    return this.flexGrow_;
  }
  setFlexGrow(value: number): void {
    this.flexGrow_ = value;
  }

  flexShrink(): number {
    return this.flexShrink_;
  }
  setFlexShrink(value: number): void {
    this.flexShrink_ = value;
  }

  flexBasis(): StyleSizeLength {
    return this.flexBasis_;
  }
  setFlexBasis(value: StyleSizeLength): void {
    this.flexBasis_ = value;
  }

  margin(edge: Edge): StyleLength {
    return this.margin_ !== null ? this.margin_[edge]! : StyleLength.undefined();
  }
  setMargin(edge: Edge, value: StyleLength): void {
    (this.margin_ ??= undefinedLengths(EDGE_COUNT))[edge] = value;
    this.marginResolved_ = null;
  }

  position(edge: Edge): StyleLength {
    return this.position_ !== null ? this.position_[edge]! : StyleLength.undefined();
  }
  setPosition(edge: Edge, value: StyleLength): void {
    (this.position_ ??= undefinedLengths(EDGE_COUNT))[edge] = value;
    this.positionResolved_ = null;
  }

  padding(edge: Edge): StyleLength {
    return this.padding_ !== null ? this.padding_[edge]! : StyleLength.undefined();
  }
  setPadding(edge: Edge, value: StyleLength): void {
    (this.padding_ ??= undefinedLengths(EDGE_COUNT))[edge] = value;
    this.paddingResolved_ = null;
  }

  border(edge: Edge): StyleLength {
    return this.border_ !== null ? this.border_[edge]! : StyleLength.undefined();
  }
  setBorder(edge: Edge, value: StyleLength): void {
    (this.border_ ??= undefinedLengths(EDGE_COUNT))[edge] = value;
    this.borderResolved_ = null;
  }

  gap(gutter: Gutter): StyleLength {
    return this.gap_ !== null ? this.gap_[gutter]! : StyleLength.undefined();
  }
  setGap(gutter: Gutter, value: StyleLength): void {
    (this.gap_ ??= undefinedLengths(GUTTER_COUNT))[gutter] = value;
  }

  dimension(axis: Dimension): StyleSizeLength {
    return this.dimensions_[axis]!;
  }
  setDimension(axis: Dimension, value: StyleSizeLength): void {
    this.dimensions_[axis] = value;
  }

  minDimension(axis: Dimension): StyleSizeLength {
    return this.dimensions_[2 + axis]!;
  }
  setMinDimension(axis: Dimension, value: StyleSizeLength): void {
    this.dimensions_[2 + axis] = value;
  }

  maxDimension(axis: Dimension): StyleSizeLength {
    return this.dimensions_[4 + axis]!;
  }
  setMaxDimension(axis: Dimension, value: StyleSizeLength): void {
    this.dimensions_[4 + axis] = value;
  }

  resolvedMinDimension(
    direction: Direction,
    axis: Dimension,
    referenceLength: number,
    ownerWidth: number,
  ): number {
    const minDimension = this.dimensions_[2 + axis]!;
    if (minDimension.isUndefined()) {
      return NaN;
    }
    const value = minDimension.resolve(referenceLength);
    if (this.boxSizing_ === BoxSizing.BorderBox || !isDefined(value)) {
      return value;
    }

    const dimensionPaddingAndBorder = this.computePaddingAndBorderForDimension(
      direction,
      axis,
      ownerWidth,
    );

    return value + (isDefined(dimensionPaddingAndBorder) ? dimensionPaddingAndBorder : 0);
  }

  resolvedMaxDimension(
    direction: Direction,
    axis: Dimension,
    referenceLength: number,
    ownerWidth: number,
  ): number {
    const maxDimension = this.dimensions_[4 + axis]!;
    if (maxDimension.isUndefined()) {
      return NaN;
    }
    const value = maxDimension.resolve(referenceLength);
    if (this.boxSizing_ === BoxSizing.BorderBox || !isDefined(value)) {
      return value;
    }

    const dimensionPaddingAndBorder = this.computePaddingAndBorderForDimension(
      direction,
      axis,
      ownerWidth,
    );

    return value + (isDefined(dimensionPaddingAndBorder) ? dimensionPaddingAndBorder : 0);
  }

  aspectRatio(): number {
    return this.aspectRatio_;
  }
  setAspectRatio(value: number): void {
    // degenerate aspect ratios act as auto.
    // see https://drafts.csswg.org/css-sizing-4/#valdef-aspect-ratio-ratio
    this.aspectRatio_ = value === 0 || value === Infinity || value === -Infinity ? NaN : value;
  }

  boxSizing(): BoxSizing {
    return this.boxSizing_;
  }
  setBoxSizing(value: BoxSizing): void {
    this.boxSizing_ = value;
  }

  horizontalInsetsDefined(): boolean {
    const position = this.position_;
    return (
      position !== null &&
      (position[Edge.Left]!.isDefined() ||
        position[Edge.Right]!.isDefined() ||
        position[Edge.All]!.isDefined() ||
        position[Edge.Horizontal]!.isDefined() ||
        position[Edge.Start]!.isDefined() ||
        position[Edge.End]!.isDefined())
    );
  }

  verticalInsetsDefined(): boolean {
    const position = this.position_;
    return (
      position !== null &&
      (position[Edge.Top]!.isDefined() ||
        position[Edge.Bottom]!.isDefined() ||
        position[Edge.All]!.isDefined() ||
        position[Edge.Vertical]!.isDefined())
    );
  }

  hasPositionOrMargin(): boolean {
    return this.position_ !== null || this.margin_ !== null;
  }

  hasPaddingOrBorder(): boolean {
    return this.padding_ !== null || this.border_ !== null;
  }

  isFlexStartPositionDefined(axis: FlexDirection, direction: Direction): boolean {
    if (this.position_ === null) return false;
    return this.computePosition(flexStartEdge(axis), direction).isDefined();
  }

  isFlexStartPositionAuto(axis: FlexDirection, direction: Direction): boolean {
    if (this.position_ === null) return false;
    return this.computePosition(flexStartEdge(axis), direction).isAuto();
  }

  isInlineStartPositionDefined(axis: FlexDirection, direction: Direction): boolean {
    if (this.position_ === null) return false;
    return this.computePosition(inlineStartEdge(axis, direction), direction).isDefined();
  }

  isInlineStartPositionAuto(axis: FlexDirection, direction: Direction): boolean {
    if (this.position_ === null) return false;
    return this.computePosition(inlineStartEdge(axis, direction), direction).isAuto();
  }

  isFlexEndPositionDefined(axis: FlexDirection, direction: Direction): boolean {
    if (this.position_ === null) return false;
    return this.computePosition(flexEndEdge(axis), direction).isDefined();
  }

  isFlexEndPositionAuto(axis: FlexDirection, direction: Direction): boolean {
    if (this.position_ === null) return false;
    return this.computePosition(flexEndEdge(axis), direction).isAuto();
  }

  isInlineEndPositionDefined(axis: FlexDirection, direction: Direction): boolean {
    if (this.position_ === null) return false;
    return this.computePosition(inlineEndEdge(axis, direction), direction).isDefined();
  }

  isInlineEndPositionAuto(axis: FlexDirection, direction: Direction): boolean {
    if (this.position_ === null) return false;
    return this.computePosition(inlineEndEdge(axis, direction), direction).isAuto();
  }

  computeFlexStartPosition(axis: FlexDirection, direction: Direction, axisSize: number): number {
    if (this.position_ === null) return 0;
    return edgeValueOrZero(this.resolvedPosition(), direction * 4 + flexStartEdge(axis), axisSize);
  }

  computeInlineStartPosition(axis: FlexDirection, direction: Direction, axisSize: number): number {
    if (this.position_ === null) return 0;
    return edgeValueOrZero(
      this.resolvedPosition(),
      direction * 4 + inlineStartEdge(axis, direction),
      axisSize,
    );
  }

  computeFlexEndPosition(axis: FlexDirection, direction: Direction, axisSize: number): number {
    if (this.position_ === null) return 0;
    return edgeValueOrZero(this.resolvedPosition(), direction * 4 + flexEndEdge(axis), axisSize);
  }

  computeInlineEndPosition(axis: FlexDirection, direction: Direction, axisSize: number): number {
    if (this.position_ === null) return 0;
    return edgeValueOrZero(
      this.resolvedPosition(),
      direction * 4 + inlineEndEdge(axis, direction),
      axisSize,
    );
  }

  computeFlexStartMargin(axis: FlexDirection, direction: Direction, widthSize: number): number {
    if (this.margin_ === null) return 0;
    return edgeValueOrZero(this.resolvedMargin(), direction * 4 + flexStartEdge(axis), widthSize);
  }

  computeInlineStartMargin(axis: FlexDirection, direction: Direction, widthSize: number): number {
    if (this.margin_ === null) return 0;
    return edgeValueOrZero(
      this.resolvedMargin(),
      direction * 4 + inlineStartEdge(axis, direction),
      widthSize,
    );
  }

  computeFlexEndMargin(axis: FlexDirection, direction: Direction, widthSize: number): number {
    if (this.margin_ === null) return 0;
    return edgeValueOrZero(this.resolvedMargin(), direction * 4 + flexEndEdge(axis), widthSize);
  }

  computeInlineEndMargin(axis: FlexDirection, direction: Direction, widthSize: number): number {
    if (this.margin_ === null) return 0;
    return edgeValueOrZero(
      this.resolvedMargin(),
      direction * 4 + inlineEndEdge(axis, direction),
      widthSize,
    );
  }

  computeFlexStartBorder(axis: FlexDirection, direction: Direction): number {
    if (this.border_ === null) return 0;
    return edgeValueFloored(this.resolvedBorder(), direction * 4 + flexStartEdge(axis), 0);
  }

  computeInlineStartBorder(axis: FlexDirection, direction: Direction): number {
    if (this.border_ === null) return 0;
    return edgeValueFloored(
      this.resolvedBorder(),
      direction * 4 + inlineStartEdge(axis, direction),
      0,
    );
  }

  computeFlexEndBorder(axis: FlexDirection, direction: Direction): number {
    if (this.border_ === null) return 0;
    return edgeValueFloored(this.resolvedBorder(), direction * 4 + flexEndEdge(axis), 0);
  }

  computeInlineEndBorder(axis: FlexDirection, direction: Direction): number {
    if (this.border_ === null) return 0;
    return edgeValueFloored(
      this.resolvedBorder(),
      direction * 4 + inlineEndEdge(axis, direction),
      0,
    );
  }

  computeFlexStartPadding(axis: FlexDirection, direction: Direction, widthSize: number): number {
    if (this.padding_ === null) return 0;
    return edgeValueFloored(this.resolvedPadding(), direction * 4 + flexStartEdge(axis), widthSize);
  }

  computeInlineStartPadding(axis: FlexDirection, direction: Direction, widthSize: number): number {
    if (this.padding_ === null) return 0;
    return edgeValueFloored(
      this.resolvedPadding(),
      direction * 4 + inlineStartEdge(axis, direction),
      widthSize,
    );
  }

  computeFlexEndPadding(axis: FlexDirection, direction: Direction, widthSize: number): number {
    if (this.padding_ === null) return 0;
    return edgeValueFloored(this.resolvedPadding(), direction * 4 + flexEndEdge(axis), widthSize);
  }

  computeInlineEndPadding(axis: FlexDirection, direction: Direction, widthSize: number): number {
    if (this.padding_ === null) return 0;
    return edgeValueFloored(
      this.resolvedPadding(),
      direction * 4 + inlineEndEdge(axis, direction),
      widthSize,
    );
  }

  computeInlineStartPaddingAndBorder(
    axis: FlexDirection,
    direction: Direction,
    widthSize: number,
  ): number {
    return (
      this.computeInlineStartPadding(axis, direction, widthSize) +
      this.computeInlineStartBorder(axis, direction)
    );
  }

  computeFlexStartPaddingAndBorder(
    axis: FlexDirection,
    direction: Direction,
    widthSize: number,
  ): number {
    return (
      this.computeFlexStartPadding(axis, direction, widthSize) +
      this.computeFlexStartBorder(axis, direction)
    );
  }

  computeInlineEndPaddingAndBorder(
    axis: FlexDirection,
    direction: Direction,
    widthSize: number,
  ): number {
    return (
      this.computeInlineEndPadding(axis, direction, widthSize) +
      this.computeInlineEndBorder(axis, direction)
    );
  }

  computeFlexEndPaddingAndBorder(
    axis: FlexDirection,
    direction: Direction,
    widthSize: number,
  ): number {
    return (
      this.computeFlexEndPadding(axis, direction, widthSize) +
      this.computeFlexEndBorder(axis, direction)
    );
  }

  computePaddingAndBorderForDimension(
    direction: Direction,
    dimension: Dimension,
    widthSize: number,
  ): number {
    const flexDirectionForDimension =
      dimension === Dimension.Width ? FlexDirection.Row : FlexDirection.Column;

    return (
      this.computeFlexStartPaddingAndBorder(flexDirectionForDimension, direction, widthSize) +
      this.computeFlexEndPaddingAndBorder(flexDirectionForDimension, direction, widthSize)
    );
  }

  computeBorderForAxis(axis: FlexDirection): number {
    const resolved = this.resolvedBorder();
    if (resolved === null) {
      return 0;
    }
    const startEdge = isRow(axis) ? PhysicalEdge.Left : PhysicalEdge.Top;
    return (
      edgeValueFloored(resolved, Direction.LTR * 4 + startEdge, 0) +
      edgeValueFloored(resolved, Direction.LTR * 4 + startEdge + 2, 0)
    );
  }

  computeMarginForAxis(axis: FlexDirection, widthSize: number): number {
    // The total margin for a given axis does not depend on the direction
    // so hardcoding LTR here to avoid piping direction to this function
    const resolved = this.resolvedMargin();
    if (resolved === null) {
      return 0;
    }
    const startEdge = isRow(axis) ? PhysicalEdge.Left : PhysicalEdge.Top;
    return (
      edgeValueOrZero(resolved, Direction.LTR * 4 + startEdge, widthSize) +
      edgeValueOrZero(resolved, Direction.LTR * 4 + startEdge + 2, widthSize)
    );
  }

  computeGapForAxis(axis: FlexDirection, ownerSize: number): number {
    if (this.gap_ === null) {
      return 0;
    }
    const gap = isRow(axis) ? this.computeColumnGap() : this.computeRowGap();
    return maxOrDefined(gap.resolve(ownerSize), 0);
  }

  computeGapForDimension(dimension: Dimension, ownerSize: number): number {
    if (this.gap_ === null) {
      return 0;
    }
    const gap = dimension === Dimension.Width ? this.computeColumnGap() : this.computeRowGap();
    return maxOrDefined(gap.resolve(ownerSize), 0);
  }

  flexStartMarginIsAuto(axis: FlexDirection, direction: Direction): boolean {
    if (this.margin_ === null) return false;
    return this.computeMargin(flexStartEdge(axis), direction).isAuto();
  }

  flexEndMarginIsAuto(axis: FlexDirection, direction: Direction): boolean {
    if (this.margin_ === null) return false;
    return this.computeMargin(flexEndEdge(axis), direction).isAuto();
  }

  inlineStartMarginIsAuto(axis: FlexDirection, direction: Direction): boolean {
    if (this.margin_ === null) return false;
    return this.computeMargin(inlineStartEdge(axis, direction), direction).isAuto();
  }

  inlineEndMarginIsAuto(axis: FlexDirection, direction: Direction): boolean {
    if (this.margin_ === null) return false;
    return this.computeMargin(inlineEndEdge(axis, direction), direction).isAuto();
  }

  equals(other: Style): boolean {
    // A null (never-set) edge array compares equal to one holding only
    // undefined values.
    const lengthsEqual = (a: StyleLength[] | null, b: StyleLength[] | null, count: number) => {
      if (a === b) {
        return true;
      }
      for (let i = 0; i < count; i++) {
        const left = a !== null ? a[i]! : StyleLength.undefined();
        const right = b !== null ? b[i]! : StyleLength.undefined();
        if (!left.equals(right)) {
          return false;
        }
      }
      return true;
    };
    const numbersEqual = (a: number, b: number) => a === b || (Number.isNaN(a) && Number.isNaN(b));

    return (
      this.direction_ === other.direction_ &&
      this.flexDirection_ === other.flexDirection_ &&
      this.justifyContent_ === other.justifyContent_ &&
      this.justifyItems_ === other.justifyItems_ &&
      this.justifySelf_ === other.justifySelf_ &&
      this.alignContent_ === other.alignContent_ &&
      this.alignItems_ === other.alignItems_ &&
      this.alignSelf_ === other.alignSelf_ &&
      this.positionType_ === other.positionType_ &&
      this.flexWrap_ === other.flexWrap_ &&
      this.overflow_ === other.overflow_ &&
      this.display_ === other.display_ &&
      this.boxSizing_ === other.boxSizing_ &&
      numbersEqual(this.flex_, other.flex_) &&
      numbersEqual(this.flexGrow_, other.flexGrow_) &&
      numbersEqual(this.flexShrink_, other.flexShrink_) &&
      this.flexBasis_.equals(other.flexBasis_) &&
      lengthsEqual(this.margin_, other.margin_, EDGE_COUNT) &&
      lengthsEqual(this.position_, other.position_, EDGE_COUNT) &&
      lengthsEqual(this.padding_, other.padding_, EDGE_COUNT) &&
      lengthsEqual(this.border_, other.border_, EDGE_COUNT) &&
      lengthsEqual(this.gap_, other.gap_, GUTTER_COUNT) &&
      this.dimensions_.every((value, i) => value.equals(other.dimensions_[i]!)) &&
      numbersEqual(this.aspectRatio_, other.aspectRatio_)
    );
  }

  copyFrom(other: Style): void {
    this.direction_ = other.direction_;
    this.flexDirection_ = other.flexDirection_;
    this.justifyContent_ = other.justifyContent_;
    this.justifyItems_ = other.justifyItems_;
    this.justifySelf_ = other.justifySelf_;
    this.alignContent_ = other.alignContent_;
    this.alignItems_ = other.alignItems_;
    this.alignSelf_ = other.alignSelf_;
    this.positionType_ = other.positionType_;
    this.flexWrap_ = other.flexWrap_;
    this.overflow_ = other.overflow_;
    this.display_ = other.display_;
    this.boxSizing_ = other.boxSizing_;
    this.flex_ = other.flex_;
    this.flexGrow_ = other.flexGrow_;
    this.flexShrink_ = other.flexShrink_;
    this.flexBasis_ = other.flexBasis_;
    this.margin_ = other.margin_ !== null ? other.margin_.slice() : null;
    this.position_ = other.position_ !== null ? other.position_.slice() : null;
    this.padding_ = other.padding_ !== null ? other.padding_.slice() : null;
    this.border_ = other.border_ !== null ? other.border_.slice() : null;
    this.gap_ = other.gap_ !== null ? other.gap_.slice() : null;
    this.marginResolved_ = null;
    this.positionResolved_ = null;
    this.paddingResolved_ = null;
    this.borderResolved_ = null;
    this.dimensions_ = other.dimensions_.slice();
    this.aspectRatio_ = other.aspectRatio_;
  }

  private computeColumnGap(): StyleLength {
    const gap = this.gap_;
    if (gap === null) {
      return StyleLength.undefined();
    }
    return gap[Gutter.Column]!.isDefined() ? gap[Gutter.Column]! : gap[Gutter.All]!;
  }

  private computeRowGap(): StyleLength {
    const gap = this.gap_;
    if (gap === null) {
      return StyleLength.undefined();
    }
    return gap[Gutter.Row]!.isDefined() ? gap[Gutter.Row]! : gap[Gutter.All]!;
  }

  private computeLeftEdge(edges: StyleLength[], layoutDirection: Direction): StyleLength {
    if (layoutDirection === Direction.LTR && edges[Edge.Start]!.isDefined()) {
      return edges[Edge.Start]!;
    } else if (layoutDirection === Direction.RTL && edges[Edge.End]!.isDefined()) {
      return edges[Edge.End]!;
    } else if (edges[Edge.Left]!.isDefined()) {
      return edges[Edge.Left]!;
    } else if (edges[Edge.Horizontal]!.isDefined()) {
      return edges[Edge.Horizontal]!;
    } else {
      return edges[Edge.All]!;
    }
  }

  private computeTopEdge(edges: StyleLength[]): StyleLength {
    if (edges[Edge.Top]!.isDefined()) {
      return edges[Edge.Top]!;
    } else if (edges[Edge.Vertical]!.isDefined()) {
      return edges[Edge.Vertical]!;
    } else {
      return edges[Edge.All]!;
    }
  }

  private computeRightEdge(edges: StyleLength[], layoutDirection: Direction): StyleLength {
    if (layoutDirection === Direction.LTR && edges[Edge.End]!.isDefined()) {
      return edges[Edge.End]!;
    } else if (layoutDirection === Direction.RTL && edges[Edge.Start]!.isDefined()) {
      return edges[Edge.Start]!;
    } else if (edges[Edge.Right]!.isDefined()) {
      return edges[Edge.Right]!;
    } else if (edges[Edge.Horizontal]!.isDefined()) {
      return edges[Edge.Horizontal]!;
    } else {
      return edges[Edge.All]!;
    }
  }

  private computeBottomEdge(edges: StyleLength[]): StyleLength {
    if (edges[Edge.Bottom]!.isDefined()) {
      return edges[Edge.Bottom]!;
    } else if (edges[Edge.Vertical]!.isDefined()) {
      return edges[Edge.Vertical]!;
    } else {
      return edges[Edge.All]!;
    }
  }

  // Resolves all four physical edges for all three directions at once, so
  // subsequent lookups are a single indexed read.
  private buildResolvedEdges(edges: StyleLength[]): ResolvedEdges {
    const lengths = Array.from<StyleLength>({ length: 12 });
    const units = new Uint8Array(12);
    const values = Array.from<number>({ length: 12 });
    for (const direction of [Direction.Inherit, Direction.LTR, Direction.RTL]) {
      lengths[direction * 4 + PhysicalEdge.Left] = this.computeLeftEdge(edges, direction);
      lengths[direction * 4 + PhysicalEdge.Top] = this.computeTopEdge(edges);
      lengths[direction * 4 + PhysicalEdge.Right] = this.computeRightEdge(edges, direction);
      lengths[direction * 4 + PhysicalEdge.Bottom] = this.computeBottomEdge(edges);
    }
    for (let i = 0; i < 12; i++) {
      units[i] = lengths[i]!.unit;
      values[i] = lengths[i]!.value;
    }
    return { lengths, units, values };
  }

  private resolvedPosition(): ResolvedEdges | null {
    return this.position_ === null
      ? null
      : (this.positionResolved_ ??= this.buildResolvedEdges(this.position_));
  }

  private resolvedMargin(): ResolvedEdges | null {
    return this.margin_ === null
      ? null
      : (this.marginResolved_ ??= this.buildResolvedEdges(this.margin_));
  }

  private resolvedPadding(): ResolvedEdges | null {
    return this.padding_ === null
      ? null
      : (this.paddingResolved_ ??= this.buildResolvedEdges(this.padding_));
  }

  private resolvedBorder(): ResolvedEdges | null {
    return this.border_ === null
      ? null
      : (this.borderResolved_ ??= this.buildResolvedEdges(this.border_));
  }

  computePosition(edge: PhysicalEdge, direction: Direction): StyleLength {
    const resolved = this.resolvedPosition();
    return resolved === null ? StyleLength.undefined() : resolved.lengths[direction * 4 + edge]!;
  }

  computeMargin(edge: PhysicalEdge, direction: Direction): StyleLength {
    const resolved = this.resolvedMargin();
    return resolved === null ? StyleLength.undefined() : resolved.lengths[direction * 4 + edge]!;
  }

  computePadding(edge: PhysicalEdge, direction: Direction): StyleLength {
    const resolved = this.resolvedPadding();
    return resolved === null ? StyleLength.undefined() : resolved.lengths[direction * 4 + edge]!;
  }

  computeBorder(edge: PhysicalEdge, direction: Direction): StyleLength {
    const resolved = this.resolvedBorder();
    return resolved === null ? StyleLength.undefined() : resolved.lengths[direction * 4 + edge]!;
  }
}

// Resolve a memoized edge to a number with undefined defaulting to 0
// (StyleLength.resolve + unwrapOrDefault(0)).
function edgeValueOrZero(
  resolved: ResolvedEdges | null,
  index: number,
  referenceLength: number,
): number {
  if (resolved === null) {
    return 0;
  }
  const unit = resolved.units[index]!;
  if (unit === Unit.Point) {
    return resolved.values[index]!;
  }
  if (unit === Unit.Percent) {
    const value = resolved.values[index]! * referenceLength * 0.01;
    // An undefined reference length resolves the percentage to undefined,
    // which defaults to 0 here.
    return Number.isNaN(value) ? 0 : value;
  }
  return 0;
}

// Resolve a memoized edge to a number floored at 0 (maxOrDefined(resolve, 0)),
// as used for padding and border.
function edgeValueFloored(
  resolved: ResolvedEdges | null,
  index: number,
  referenceLength: number,
): number {
  if (resolved === null) {
    return 0;
  }
  const unit = resolved.units[index]!;
  if (unit === Unit.Point) {
    const value = resolved.values[index]!;
    return value > 0 ? value : 0;
  }
  if (unit === Unit.Percent) {
    const value = resolved.values[index]! * referenceLength * 0.01;
    return value > 0 ? value : 0;
  }
  return 0;
}
