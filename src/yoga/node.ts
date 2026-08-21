// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

// Public Yoga API on the engine node itself. This keeps the WASM-compatible
// surface without allocating a separate binding wrapper for every node.

import { Config } from "./config.ts";
import { calculateLayout } from "./core/calculateLayout.ts";
import { getDefaultConfig } from "./core/config.ts";
import { PhysicalEdge } from "./core/helpers.ts";
import { LayoutResults } from "./core/layoutResults.ts";
import { Node as CoreNode } from "./core/node.ts";
import { StyleLength, StyleSizeLength } from "./core/types.ts";
import {
  Align,
  BoxSizing,
  Direction,
  Dimension,
  Display,
  Edge,
  FlexDirection,
  Gutter,
  Justify,
  MeasureMode,
  Overflow,
  PositionType,
  Unit,
  Wrap,
} from "./generated/YGEnums.ts";

type Layout = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  hadOverflow: boolean;
};

type Size = {
  width: number;
  height: number;
};

type Value = {
  unit: Unit;
  value: number;
};

export type DirtiedFunction = (node: Node) => void;

export type MeasureFunction = (
  width: number,
  widthMode: MeasureMode,
  height: number,
  heightMode: MeasureMode,
) => Size;

function styleValue(length: StyleLength | StyleSizeLength): Value {
  return { value: length.value, unit: length.unit };
}

// Mirrors wrapAssembly's polymorphic setter dispatch, including its handling
// of numeric strings, Value-like objects, and error messages.
function dispatchSetter(
  self: Node,
  fnName: string,
  pointFn: (...args: never[]) => void,
  args: unknown[],
): void {
  const value = args.pop();
  let unit: Unit | undefined;
  let asNumber: number | undefined;

  if (value === "auto") {
    unit = Unit.Auto;
    asNumber = undefined;
  } else if (value === "max-content") {
    unit = Unit.MaxContent;
    asNumber = undefined;
  } else if (value === "fit-content") {
    unit = Unit.FitContent;
    asNumber = undefined;
  } else if (value === "stretch") {
    unit = Unit.Stretch;
    asNumber = undefined;
  } else if (typeof value === "object" && value !== null) {
    unit = (value as Value).unit;
    asNumber = (value as Value).valueOf() as unknown as number;
  } else {
    unit = typeof value === "string" && value.endsWith("%") ? Unit.Percent : Unit.Point;
    asNumber = parseFloat(value as string);
    if (value !== undefined && !Number.isNaN(value) && Number.isNaN(asNumber)) {
      throw new Error(`Invalid value ${JSON.stringify(value) ?? "undefined"} for ${fnName}`);
    }
  }

  if (unit === Unit.Point) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (pointFn as any).call(self, ...args, asNumber);
  }

  const suffix = {
    [Unit.Percent]: "Percent",
    [Unit.Auto]: "Auto",
    [Unit.MaxContent]: "MaxContent",
    [Unit.FitContent]: "FitContent",
    [Unit.Stretch]: "Stretch",
  }[unit as number];

  if (suffix === undefined) {
    throw new Error(
      `Failed to execute "${fnName}": Unsupported unit '${JSON.stringify(value) ?? "undefined"}'`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const method = (self as any)[`${fnName}${suffix}`];
  if (!method) {
    throw new Error(
      `Failed to execute "${fnName}": Unsupported unit '${JSON.stringify(value) ?? "undefined"}'`,
    );
  }

  if (asNumber !== undefined) {
    return method.call(self, ...args, asNumber);
  } else {
    return method.call(self, ...args);
  }
}

export class Node extends CoreNode {
  private constructor(config?: Config) {
    super(config ? config.core : getDefaultConfig());
  }

  static create(config?: Config): Node {
    return new Node(config);
  }

  static createDefault(): Node {
    return new Node();
  }

  static createWithConfig(config: Config): Node {
    return new Node(config);
  }

  // WASM nodes require explicit destruction. JavaScript nodes are reclaimed
  // by the garbage collector, but binding-compatible consumers still call
  // these lifecycle methods.
  free(): void {
    // No-op: the garbage collector owns this node's lifetime.
  }

  freeRecursive(): void {
    // No-op: JavaScript garbage collection handles object graphs and cycles.
  }

  // --- Tree hierarchy ---
  override insertChild(child: Node, index: number): void {
    if (child.owner !== null) {
      throw new Error("Child already has a owner, it must be removed first.");
    }
    if (this.hasMeasureFunc()) {
      throw new Error("Cannot add child: Nodes with measure functions cannot have children.");
    }

    super.insertChild(child, index);
    child.owner = this;
    this.markDirtyAndPropagate();
  }

  override removeChild(child: Node): boolean {
    let removed = false;
    if (super.getChildCount() > 0) {
      if (super.removeChild(child)) {
        removed = true;
        child.layout = new LayoutResults(); // layout is no longer valid
        child.owner = null;
        // Mark dirty to invalidate cache, but suppress the dirtied callback
        // since the node is being detached from the tree.
        const dirtiedFunc = child.getDirtiedFunc();
        child.setCoreDirtiedFunc(null);
        child.setDirty(true);
        child.setCoreDirtiedFunc(dirtiedFunc);
        this.markDirtyAndPropagate();
      }
    }

    return removed;
  }

  override getChildCount(): number {
    return super.getChildCount();
  }

  override getChild(index: number): Node {
    return super.getChild(index) as Node;
  }

  getParent(): Node | null {
    return this.owner as Node | null;
  }

  override setChildren(children: Node[]): void {
    while (super.getChildCount() !== 0) {
      this.removeChild(this.getChild(super.getChildCount() - 1));
    }
    children.forEach((child, index) => this.insertChild(child, index));
  }

  // --- Lifecycle ---
  override reset(): void {
    super.reset();
  }

  // --- Style setters ---
  copyStyle(other: Node): void {
    if (!this.style.equals(other.style)) {
      this.style.copyFrom(other.style);
      this.invalidateProcessedDimensions();
      this.markDirtyAndPropagate();
    }
  }

  private updateStyleLength(
    get: () => StyleLength,
    set: (value: StyleLength) => void,
    value: StyleLength,
  ): void {
    if (!get().equals(value)) {
      set(value);
      this.markDirtyAndPropagate();
    }
  }

  private updateStyleSize(
    get: () => StyleSizeLength,
    set: (value: StyleSizeLength) => void,
    value: StyleSizeLength,
  ): void {
    if (!get().equals(value)) {
      set(value);
      this.markDirtyAndPropagate();
    }
  }

  private updateStyleEnum<T extends number>(get: () => T, set: (value: T) => void, value: T): void {
    if (get() !== value) {
      set(value);
      this.markDirtyAndPropagate();
    }
  }

  private setDimensionValue(dim: Dimension, value: StyleSizeLength): void {
    if (!this.style.dimension(dim).equals(value)) {
      this.style.setDimension(dim, value);
      this.invalidateProcessedDimensions();
      this.markDirtyAndPropagate();
    }
  }

  private setMinDimensionValue(dim: Dimension, value: StyleSizeLength): void {
    if (!this.style.minDimension(dim).equals(value)) {
      this.style.setMinDimension(dim, value);
      this.invalidateProcessedDimensions();
      this.markDirtyAndPropagate();
    }
  }

  private setMaxDimensionValue(dim: Dimension, value: StyleSizeLength): void {
    if (!this.style.maxDimension(dim).equals(value)) {
      this.style.setMaxDimension(dim, value);
      this.invalidateProcessedDimensions();
      this.markDirtyAndPropagate();
    }
  }

  setPositionType(positionType: PositionType): void {
    this.updateStyleEnum(
      () => this.style.positionType(),
      (v) => this.style.setPositionType(v),
      positionType,
    );
  }

  setPosition(edge: Edge, position: number | `${number}%` | undefined): void {
    if (typeof position === "number" || position === undefined) {
      this.updateStyleLength(
        () => this.style.position(edge),
        (v) => this.style.setPosition(edge, v),
        StyleLength.points(position === undefined ? NaN : position),
      );
      return;
    }
    dispatchSetter(
      this,
      "setPosition",
      (e: Edge, value?: number) =>
        this.updateStyleLength(
          () => this.style.position(e),
          (v) => this.style.setPosition(e, v),
          StyleLength.points(value === undefined ? NaN : value),
        ),
      [edge, position],
    );
  }

  setPositionPercent(edge: Edge, position: number | undefined): void {
    this.updateStyleLength(
      () => this.style.position(edge),
      (v) => this.style.setPosition(edge, v),
      StyleLength.percent(position === undefined ? NaN : position),
    );
  }

  setPositionAuto(edge: Edge): void {
    this.updateStyleLength(
      () => this.style.position(edge),
      (v) => this.style.setPosition(edge, v),
      StyleLength.ofAuto(),
    );
  }

  setAlignContent(alignContent: Align): void {
    this.updateStyleEnum(
      () => this.style.alignContent(),
      (v) => this.style.setAlignContent(v),
      alignContent,
    );
  }

  setAlignItems(alignItems: Align): void {
    this.updateStyleEnum(
      () => this.style.alignItems(),
      (v) => this.style.setAlignItems(v),
      alignItems,
    );
  }

  setAlignSelf(alignSelf: Align): void {
    this.updateStyleEnum(
      () => this.style.alignSelf(),
      (v) => this.style.setAlignSelf(v),
      alignSelf,
    );
  }

  setFlexDirection(flexDirection: FlexDirection): void {
    if (this.style.flexDirection() !== flexDirection) {
      this.style.setFlexDirection(flexDirection);
      this.markDirtyAndPropagate();
    }
  }

  setFlexWrap(flexWrap: Wrap): void {
    this.updateStyleEnum(
      () => this.style.flexWrap(),
      (v) => this.style.setFlexWrap(v),
      flexWrap,
    );
  }

  setJustifyContent(justifyContent: Justify): void {
    this.updateStyleEnum(
      () => this.style.justifyContent(),
      (v) => this.style.setJustifyContent(v),
      justifyContent,
    );
  }

  setDirection(direction: Direction): void {
    this.updateStyleEnum(
      () => this.style.direction(),
      (v) => this.style.setDirection(v),
      direction,
    );
  }

  setMargin(edge: Edge, margin: number | "auto" | `${number}%` | undefined): void {
    if (typeof margin === "number" || margin === undefined) {
      this.updateStyleLength(
        () => this.style.margin(edge),
        (v) => this.style.setMargin(edge, v),
        StyleLength.points(margin === undefined ? NaN : margin),
      );
      return;
    }
    dispatchSetter(
      this,
      "setMargin",
      (e: Edge, value?: number) =>
        this.updateStyleLength(
          () => this.style.margin(e),
          (v) => this.style.setMargin(e, v),
          StyleLength.points(value === undefined ? NaN : value),
        ),
      [edge, margin],
    );
  }

  setMarginPercent(edge: Edge, margin: number | undefined): void {
    this.updateStyleLength(
      () => this.style.margin(edge),
      (v) => this.style.setMargin(edge, v),
      StyleLength.percent(margin === undefined ? NaN : margin),
    );
  }

  setMarginAuto(edge: Edge): void {
    this.updateStyleLength(
      () => this.style.margin(edge),
      (v) => this.style.setMargin(edge, v),
      StyleLength.ofAuto(),
    );
  }

  setOverflow(overflow: Overflow): void {
    this.updateStyleEnum(
      () => this.style.overflow(),
      (v) => this.style.setOverflow(v),
      overflow,
    );
  }

  setDisplay(display: Display): void {
    const current = this.style.display();
    if (current !== display) {
      this.style.setDisplay(display);
      this.owner?.syncContentsChildrenCount();
      this.markDirtyAndPropagate();
    }
  }

  setFlex(flex: number | undefined): void {
    const value = flex === undefined ? NaN : flex;
    const current = this.style.flex();
    if (current !== value && !(Number.isNaN(current) && Number.isNaN(value))) {
      this.style.setFlex(value);
      this.markDirtyAndPropagate();
    }
  }

  setFlexBasis(
    flexBasis:
      | number
      | "auto"
      | "fit-content"
      | "max-content"
      | "stretch"
      | `${number}%`
      | undefined,
  ): void {
    if (typeof flexBasis === "number" || flexBasis === undefined) {
      this.updateStyleSize(
        () => this.style.flexBasis(),
        (v) => this.style.setFlexBasis(v),
        StyleSizeLength.points(flexBasis === undefined ? NaN : flexBasis),
      );
      return;
    }
    dispatchSetter(
      this,
      "setFlexBasis",
      (value?: number) =>
        this.updateStyleSize(
          () => this.style.flexBasis(),
          (v) => this.style.setFlexBasis(v),
          StyleSizeLength.points(value === undefined ? NaN : value),
        ),
      [flexBasis],
    );
  }

  setFlexBasisPercent(flexBasis: number | undefined): void {
    this.updateStyleSize(
      () => this.style.flexBasis(),
      (v) => this.style.setFlexBasis(v),
      StyleSizeLength.percent(flexBasis === undefined ? NaN : flexBasis),
    );
  }

  setFlexBasisAuto(): void {
    this.updateStyleSize(
      () => this.style.flexBasis(),
      (v) => this.style.setFlexBasis(v),
      StyleSizeLength.ofAuto(),
    );
  }

  setFlexBasisMaxContent(): void {
    this.updateStyleSize(
      () => this.style.flexBasis(),
      (v) => this.style.setFlexBasis(v),
      StyleSizeLength.ofMaxContent(),
    );
  }

  setFlexBasisFitContent(): void {
    this.updateStyleSize(
      () => this.style.flexBasis(),
      (v) => this.style.setFlexBasis(v),
      StyleSizeLength.ofFitContent(),
    );
  }

  setFlexBasisStretch(): void {
    this.updateStyleSize(
      () => this.style.flexBasis(),
      (v) => this.style.setFlexBasis(v),
      StyleSizeLength.ofStretch(),
    );
  }

  setFlexGrow(flexGrow: number | undefined): void {
    const value = flexGrow === undefined ? NaN : flexGrow;
    const current = this.style.flexGrow();
    if (current !== value && !(Number.isNaN(current) && Number.isNaN(value))) {
      this.style.setFlexGrow(value);
      this.markDirtyAndPropagate();
    }
  }

  setFlexShrink(flexShrink: number | undefined): void {
    const value = flexShrink === undefined ? NaN : flexShrink;
    const current = this.style.flexShrink();
    if (current !== value && !(Number.isNaN(current) && Number.isNaN(value))) {
      this.style.setFlexShrink(value);
      this.markDirtyAndPropagate();
    }
  }

  setWidth(
    width: number | "auto" | "fit-content" | "max-content" | "stretch" | `${number}%` | undefined,
  ): void {
    if (typeof width === "number" || width === undefined) {
      this.setDimensionValue(
        Dimension.Width,
        StyleSizeLength.points(width === undefined ? NaN : width),
      );
      return;
    }
    dispatchSetter(
      this,
      "setWidth",
      (value?: number) =>
        this.setDimensionValue(
          Dimension.Width,
          StyleSizeLength.points(value === undefined ? NaN : value),
        ),
      [width],
    );
  }

  setWidthPercent(width: number | undefined): void {
    this.setDimensionValue(
      Dimension.Width,
      StyleSizeLength.percent(width === undefined ? NaN : width),
    );
  }

  setWidthAuto(): void {
    this.setDimensionValue(Dimension.Width, StyleSizeLength.ofAuto());
  }

  setWidthMaxContent(): void {
    this.setDimensionValue(Dimension.Width, StyleSizeLength.ofMaxContent());
  }

  setWidthFitContent(): void {
    this.setDimensionValue(Dimension.Width, StyleSizeLength.ofFitContent());
  }

  setWidthStretch(): void {
    this.setDimensionValue(Dimension.Width, StyleSizeLength.ofStretch());
  }

  setHeight(
    height: number | "auto" | "fit-content" | "max-content" | "stretch" | `${number}%` | undefined,
  ): void {
    if (typeof height === "number" || height === undefined) {
      this.setDimensionValue(
        Dimension.Height,
        StyleSizeLength.points(height === undefined ? NaN : height),
      );
      return;
    }
    dispatchSetter(
      this,
      "setHeight",
      (value?: number) =>
        this.setDimensionValue(
          Dimension.Height,
          StyleSizeLength.points(value === undefined ? NaN : value),
        ),
      [height],
    );
  }

  setHeightPercent(height: number | undefined): void {
    this.setDimensionValue(
      Dimension.Height,
      StyleSizeLength.percent(height === undefined ? NaN : height),
    );
  }

  setHeightAuto(): void {
    this.setDimensionValue(Dimension.Height, StyleSizeLength.ofAuto());
  }

  setHeightMaxContent(): void {
    this.setDimensionValue(Dimension.Height, StyleSizeLength.ofMaxContent());
  }

  setHeightFitContent(): void {
    this.setDimensionValue(Dimension.Height, StyleSizeLength.ofFitContent());
  }

  setHeightStretch(): void {
    this.setDimensionValue(Dimension.Height, StyleSizeLength.ofStretch());
  }

  setMinWidth(
    minWidth: number | "fit-content" | "max-content" | "stretch" | `${number}%` | undefined,
  ): void {
    if (typeof minWidth === "number" || minWidth === undefined) {
      this.setMinDimensionValue(
        Dimension.Width,
        StyleSizeLength.points(minWidth === undefined ? NaN : minWidth),
      );
      return;
    }
    dispatchSetter(
      this,
      "setMinWidth",
      (value?: number) =>
        this.setMinDimensionValue(
          Dimension.Width,
          StyleSizeLength.points(value === undefined ? NaN : value),
        ),
      [minWidth],
    );
  }

  setMinWidthPercent(minWidth: number | undefined): void {
    this.setMinDimensionValue(
      Dimension.Width,
      StyleSizeLength.percent(minWidth === undefined ? NaN : minWidth),
    );
  }

  setMinWidthMaxContent(): void {
    this.setMinDimensionValue(Dimension.Width, StyleSizeLength.ofMaxContent());
  }

  setMinWidthFitContent(): void {
    this.setMinDimensionValue(Dimension.Width, StyleSizeLength.ofFitContent());
  }

  setMinWidthStretch(): void {
    this.setMinDimensionValue(Dimension.Width, StyleSizeLength.ofStretch());
  }

  setMinHeight(
    minHeight: number | "fit-content" | "max-content" | "stretch" | `${number}%` | undefined,
  ): void {
    if (typeof minHeight === "number" || minHeight === undefined) {
      this.setMinDimensionValue(
        Dimension.Height,
        StyleSizeLength.points(minHeight === undefined ? NaN : minHeight),
      );
      return;
    }
    dispatchSetter(
      this,
      "setMinHeight",
      (value?: number) =>
        this.setMinDimensionValue(
          Dimension.Height,
          StyleSizeLength.points(value === undefined ? NaN : value),
        ),
      [minHeight],
    );
  }

  setMinHeightPercent(minHeight: number | undefined): void {
    this.setMinDimensionValue(
      Dimension.Height,
      StyleSizeLength.percent(minHeight === undefined ? NaN : minHeight),
    );
  }

  setMinHeightMaxContent(): void {
    this.setMinDimensionValue(Dimension.Height, StyleSizeLength.ofMaxContent());
  }

  setMinHeightFitContent(): void {
    this.setMinDimensionValue(Dimension.Height, StyleSizeLength.ofFitContent());
  }

  setMinHeightStretch(): void {
    this.setMinDimensionValue(Dimension.Height, StyleSizeLength.ofStretch());
  }

  setMaxWidth(
    maxWidth: number | "fit-content" | "max-content" | "stretch" | `${number}%` | undefined,
  ): void {
    if (typeof maxWidth === "number" || maxWidth === undefined) {
      this.setMaxDimensionValue(
        Dimension.Width,
        StyleSizeLength.points(maxWidth === undefined ? NaN : maxWidth),
      );
      return;
    }
    dispatchSetter(
      this,
      "setMaxWidth",
      (value?: number) =>
        this.setMaxDimensionValue(
          Dimension.Width,
          StyleSizeLength.points(value === undefined ? NaN : value),
        ),
      [maxWidth],
    );
  }

  setMaxWidthPercent(maxWidth: number | undefined): void {
    this.setMaxDimensionValue(
      Dimension.Width,
      StyleSizeLength.percent(maxWidth === undefined ? NaN : maxWidth),
    );
  }

  setMaxWidthMaxContent(): void {
    this.setMaxDimensionValue(Dimension.Width, StyleSizeLength.ofMaxContent());
  }

  setMaxWidthFitContent(): void {
    this.setMaxDimensionValue(Dimension.Width, StyleSizeLength.ofFitContent());
  }

  setMaxWidthStretch(): void {
    this.setMaxDimensionValue(Dimension.Width, StyleSizeLength.ofStretch());
  }

  setMaxHeight(
    maxHeight: number | "fit-content" | "max-content" | "stretch" | `${number}%` | undefined,
  ): void {
    if (typeof maxHeight === "number" || maxHeight === undefined) {
      this.setMaxDimensionValue(
        Dimension.Height,
        StyleSizeLength.points(maxHeight === undefined ? NaN : maxHeight),
      );
      return;
    }
    dispatchSetter(
      this,
      "setMaxHeight",
      (value?: number) =>
        this.setMaxDimensionValue(
          Dimension.Height,
          StyleSizeLength.points(value === undefined ? NaN : value),
        ),
      [maxHeight],
    );
  }

  setMaxHeightPercent(maxHeight: number | undefined): void {
    this.setMaxDimensionValue(
      Dimension.Height,
      StyleSizeLength.percent(maxHeight === undefined ? NaN : maxHeight),
    );
  }

  setMaxHeightMaxContent(): void {
    this.setMaxDimensionValue(Dimension.Height, StyleSizeLength.ofMaxContent());
  }

  setMaxHeightFitContent(): void {
    this.setMaxDimensionValue(Dimension.Height, StyleSizeLength.ofFitContent());
  }

  setMaxHeightStretch(): void {
    this.setMaxDimensionValue(Dimension.Height, StyleSizeLength.ofStretch());
  }

  setAspectRatio(aspectRatio: number | undefined): void {
    const value = aspectRatio === undefined ? NaN : aspectRatio;
    const current = this.style.aspectRatio();
    // setAspectRatio normalizes degenerate ratios; compare post-normalization.
    const normalized = value === 0 || value === Infinity || value === -Infinity ? NaN : value;
    if (current !== normalized && !(Number.isNaN(current) && Number.isNaN(normalized))) {
      this.style.setAspectRatio(value);
      this.markDirtyAndPropagate();
    }
  }

  setBorder(edge: Edge, borderWidth: number | undefined): void {
    this.updateStyleLength(
      () => this.style.border(edge),
      (v) => this.style.setBorder(edge, v),
      StyleLength.points(borderWidth === undefined ? NaN : borderWidth),
    );
  }

  setPadding(edge: Edge, padding: number | `${number}%` | undefined): void {
    if (typeof padding === "number" || padding === undefined) {
      this.updateStyleLength(
        () => this.style.padding(edge),
        (v) => this.style.setPadding(edge, v),
        StyleLength.points(padding === undefined ? NaN : padding),
      );
      return;
    }
    dispatchSetter(
      this,
      "setPadding",
      (e: Edge, value?: number) =>
        this.updateStyleLength(
          () => this.style.padding(e),
          (v) => this.style.setPadding(e, v),
          StyleLength.points(value === undefined ? NaN : value),
        ),
      [edge, padding],
    );
  }

  setPaddingPercent(edge: Edge, padding: number | undefined): void {
    this.updateStyleLength(
      () => this.style.padding(edge),
      (v) => this.style.setPadding(edge, v),
      StyleLength.percent(padding === undefined ? NaN : padding),
    );
  }

  setGap(gutter: Gutter, gapLength: number | `${number}%` | undefined): void {
    if (typeof gapLength === "number" || gapLength === undefined) {
      this.updateStyleLength(
        () => this.style.gap(gutter),
        (v) => this.style.setGap(gutter, v),
        StyleLength.points(gapLength === undefined ? NaN : gapLength),
      );
      return;
    }
    dispatchSetter(
      this,
      "setGap",
      (g: Gutter, value?: number) =>
        this.updateStyleLength(
          () => this.style.gap(g),
          (v) => this.style.setGap(g, v),
          StyleLength.points(value === undefined ? NaN : value),
        ),
      [gutter, gapLength],
    );
  }

  setGapPercent(gutter: Gutter, gapLength: number | undefined): void {
    this.updateStyleLength(
      () => this.style.gap(gutter),
      (v) => this.style.setGap(gutter, v),
      StyleLength.percent(gapLength === undefined ? NaN : gapLength),
    );
  }

  setBoxSizing(boxSizing: BoxSizing): void {
    this.updateStyleEnum(
      () => this.style.boxSizing(),
      (v) => this.style.setBoxSizing(v),
      boxSizing,
    );
  }

  setIsReferenceBaseline(isReferenceBaseline: boolean): void {
    if (this.isReferenceBaseline_ !== isReferenceBaseline) {
      this.isReferenceBaseline_ = isReferenceBaseline;
      this.markDirtyAndPropagate();
    }
  }

  setAlwaysFormsContainingBlock(alwaysFormsContainingBlock: boolean): void {
    this.alwaysFormsContainingBlock = alwaysFormsContainingBlock;
  }

  // --- Style getters ---
  getPositionType(): PositionType {
    return this.style.positionType();
  }

  getPosition(edge: Edge): Value {
    return styleValue(this.style.position(edge));
  }

  getAlignContent(): Align {
    return this.style.alignContent();
  }

  getAlignItems(): Align {
    return this.style.alignItems();
  }

  getAlignSelf(): Align {
    return this.style.alignSelf();
  }

  getFlexDirection(): FlexDirection {
    return this.style.flexDirection();
  }

  getFlexWrap(): Wrap {
    return this.style.flexWrap();
  }

  getJustifyContent(): Justify {
    return this.style.justifyContent();
  }

  getDirection(): Direction {
    return this.style.direction();
  }

  getMargin(edge: Edge): Value {
    return styleValue(this.style.margin(edge));
  }

  getOverflow(): Overflow {
    return this.style.overflow();
  }

  getDisplay(): Display {
    return this.style.display();
  }

  getFlexBasis(): Value {
    return styleValue(this.style.flexBasis());
  }

  getFlexGrow(): number {
    const flexGrow = this.style.flexGrow();
    return Number.isNaN(flexGrow) ? 0 : flexGrow;
  }

  getFlexShrink(): number {
    const flexShrink = this.style.flexShrink();
    return Number.isNaN(flexShrink) ? (this.config.useWebDefaults() ? 1 : 0) : flexShrink;
  }

  getWidth(): Value {
    return styleValue(this.style.dimension(Dimension.Width));
  }

  getHeight(): Value {
    return styleValue(this.style.dimension(Dimension.Height));
  }

  getMinWidth(): Value {
    return styleValue(this.style.minDimension(Dimension.Width));
  }

  getMinHeight(): Value {
    return styleValue(this.style.minDimension(Dimension.Height));
  }

  getMaxWidth(): Value {
    return styleValue(this.style.maxDimension(Dimension.Width));
  }

  getMaxHeight(): Value {
    return styleValue(this.style.maxDimension(Dimension.Height));
  }

  getAspectRatio(): number {
    return this.style.aspectRatio();
  }

  getBorder(edge: Edge): number {
    const border = this.style.border(edge);
    if (border.isUndefined() || border.isAuto()) {
      return NaN;
    }
    return border.value;
  }

  getPadding(edge: Edge): Value {
    return styleValue(this.style.padding(edge));
  }

  getGap(gutter: Gutter): Value {
    return styleValue(this.style.gap(gutter));
  }

  getBoxSizing(): BoxSizing {
    return this.style.boxSizing();
  }

  isReferenceBaseline(): boolean {
    return this.isReferenceBaseline_;
  }

  // --- Measure / Dirtied ---
  override setMeasureFunc(measureFunc: MeasureFunction | null): void {
    if (measureFunc) {
      super.setMeasureFunc(measureFunc);
    } else {
      this.unsetMeasureFunc();
    }
  }

  unsetMeasureFunc(): void {
    super.setMeasureFunc(null);
  }

  setDirtiedFunc(dirtiedFunc: DirtiedFunction | null): void {
    if (dirtiedFunc) {
      this.setCoreDirtiedFunc(() => dirtiedFunc(this));
    } else {
      this.unsetDirtiedFunc();
    }
  }

  unsetDirtiedFunc(): void {
    this.setCoreDirtiedFunc(null);
  }

  // --- Dirty / Layout ---
  markDirty(): void {
    if (!this.hasMeasureFunc()) {
      throw new Error(
        "Only leaf nodes with custom measure functions should manually mark themselves as dirty",
      );
    }
    this.markDirtyAndPropagate();
  }

  override isDirty(): boolean {
    return super.isDirty();
  }

  markLayoutSeen(): void {
    this.hasNewLayout_ = false;
  }

  hasNewLayout(): boolean {
    return this.hasNewLayout_;
  }

  calculateLayout(
    width: number | "auto" | undefined = NaN,
    height: number | "auto" | undefined = NaN,
    direction: Direction = Direction.LTR,
  ): void {
    calculateLayout(
      this,
      typeof width === "number" ? width : NaN,
      typeof height === "number" ? height : NaN,
      direction,
    );
  }

  // --- Layout getters ---
  getComputedLeft(): number {
    return this.layout.position(PhysicalEdge.Left);
  }

  getComputedRight(): number {
    return this.layout.position(PhysicalEdge.Right);
  }

  getComputedTop(): number {
    return this.layout.position(PhysicalEdge.Top);
  }

  getComputedBottom(): number {
    return this.layout.position(PhysicalEdge.Bottom);
  }

  getComputedWidth(): number {
    return this.layout.dimension(Dimension.Width);
  }

  getComputedHeight(): number {
    return this.layout.dimension(Dimension.Height);
  }

  getComputedHadOverflow(): boolean {
    return this.layout.hadOverflow();
  }

  getComputedLayout(): Layout {
    return {
      left: this.getComputedLeft(),
      right: this.getComputedRight(),
      top: this.getComputedTop(),
      bottom: this.getComputedBottom(),
      width: this.getComputedWidth(),
      height: this.getComputedHeight(),
      hadOverflow: this.getComputedHadOverflow(),
    };
  }

  private resolvedLayoutProperty(getter: (edge: PhysicalEdge) => number, edge: Edge): number {
    if (edge > Edge.End) {
      throw new Error("Cannot get layout properties of multi-edge shorthands");
    }

    if (edge === Edge.Start) {
      return this.layout.direction() === Direction.RTL
        ? getter(PhysicalEdge.Right)
        : getter(PhysicalEdge.Left);
    }

    if (edge === Edge.End) {
      return this.layout.direction() === Direction.RTL
        ? getter(PhysicalEdge.Left)
        : getter(PhysicalEdge.Right);
    }

    return getter(edge as unknown as PhysicalEdge);
  }

  getComputedMargin(edge: Edge): number {
    return this.resolvedLayoutProperty((e) => this.layout.margin(e), edge);
  }

  getComputedBorder(edge: Edge): number {
    return this.resolvedLayoutProperty((e) => this.layout.border(e), edge);
  }

  getComputedPadding(edge: Edge): number {
    return this.resolvedLayoutProperty((e) => this.layout.padding(e), edge);
  }
}
