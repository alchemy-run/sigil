// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

// Port of yoga/node/LayoutResults.h and yoga/node/CachedMeasurement.h.

import type { FlexLine } from "#/yoga/core/flexLine.ts";
import { PhysicalEdge, SizingMode } from "#/yoga/core/helpers.ts";
import { isUndefined } from "#/yoga/core/numeric.ts";
import { Dimension, Direction } from "#/yoga/generated/YGEnums.ts";

export class CachedMeasurement {
  availableWidth = -1;
  availableHeight = -1;
  widthSizingMode: SizingMode = SizingMode.MaxContent;
  heightSizingMode: SizingMode = SizingMode.MaxContent;

  computedWidth = -1;
  computedHeight = -1;

  equals(measurement: CachedMeasurement): boolean {
    let isEqual =
      this.widthSizingMode === measurement.widthSizingMode &&
      this.heightSizingMode === measurement.heightSizingMode;

    if (!isUndefined(this.availableWidth) || !isUndefined(measurement.availableWidth)) {
      isEqual = isEqual && this.availableWidth === measurement.availableWidth;
    }
    if (!isUndefined(this.availableHeight) || !isUndefined(measurement.availableHeight)) {
      isEqual = isEqual && this.availableHeight === measurement.availableHeight;
    }
    if (!isUndefined(this.computedWidth) || !isUndefined(measurement.computedWidth)) {
      isEqual = isEqual && this.computedWidth === measurement.computedWidth;
    }
    if (!isUndefined(this.computedHeight) || !isUndefined(measurement.computedHeight)) {
      isEqual = isEqual && this.computedHeight === measurement.computedHeight;
    }

    return isEqual;
  }
}

export class LayoutResults {
  // This value was chosen based on empirical data:
  // 98% of analyzed layouts require less than 8 entries.
  static readonly MaxCachedMeasurements = 8;

  computedFlexBasisGeneration = 0;
  computedFlexBasis = NaN;

  // Per-flex-item floor along the main axis derived from CSS Flexbox §4.5
  // automatic minimum sizing. NaN means "no auto-min applies."
  computedAutoMinMainSize = NaN;

  // Instead of recomputing the entire layout every single time, we cache some
  // information to break early when nothing changed
  generationCount = 0;
  configVersion = 0;
  lastOwnerDirection: Direction = Direction.Inherit;

  nextCachedMeasurementsIndex = 0;
  // Entries are allocated lazily on first write; reads are gated by
  // nextCachedMeasurementsIndex so unwritten slots are never observed.
  cachedMeasurements: CachedMeasurement[] = [];

  // Pixel-grid bookkeeping: true when this node or any descendant had a
  // position/dimension write (or text-rounding change) since the last
  // rounding pass. Together with the last-seen absolute offsets this lets
  // roundLayoutResultsToPixelGrid skip subtrees whose inputs are unchanged —
  // the pass is deterministic, so skipping is output-identical.
  roundingDirty = true;
  roundedAbsLeft = NaN;
  roundedAbsTop = NaN;
  roundedScale = NaN;

  cachedLayout: CachedMeasurement = new CachedMeasurement();

  // Lazily-created scratch state reused by flex layout passes. Keeping this
  // per node makes recursive and cross-tree layouts independent while
  // removing per-line arrays and objects from repeat layouts.
  flexLine: FlexLine | null = null;
  flexLineStarts: number[] | null = null;

  private direction_: Direction = Direction.Inherit;
  private hadOverflow_ = false;

  // All float layout state lives in one packed numeric array. Writes are
  // kept as native JavaScript numbers to avoid repeated float32 coercion.
  // Layout: [0-1] dimensions, [2-3] measuredDimensions, [4-5] rawDimensions,
  // [6-9] position, [10-13] margin, [14-17] border, [18-21] padding.
  private values_: number[] = initialLayoutValues();

  direction(): Direction {
    return this.direction_;
  }

  setDirection(direction: Direction): void {
    this.direction_ = direction;
  }

  hadOverflow(): boolean {
    return this.hadOverflow_;
  }

  setHadOverflow(hadOverflow: boolean): void {
    this.hadOverflow_ = hadOverflow;
  }

  dimension(axis: Dimension): number {
    return this.values_[axis]!;
  }

  setDimension(axis: Dimension, dimension: number): void {
    this.values_[axis] = dimension;
  }

  measuredDimension(axis: Dimension): number {
    return this.values_[2 + axis]!;
  }

  rawDimension(axis: Dimension): number {
    return this.values_[4 + axis]!;
  }

  setMeasuredDimension(axis: Dimension, dimension: number): void {
    this.values_[2 + axis] = dimension;
  }

  setRawDimension(axis: Dimension, dimension: number): void {
    this.values_[4 + axis] = dimension;
  }

  position(physicalEdge: PhysicalEdge): number {
    return this.values_[6 + physicalEdge]!;
  }

  setPosition(physicalEdge: PhysicalEdge, dimension: number): void {
    this.values_[6 + physicalEdge] = dimension;
  }

  margin(physicalEdge: PhysicalEdge): number {
    return this.values_[10 + physicalEdge]!;
  }

  setMargin(physicalEdge: PhysicalEdge, dimension: number): void {
    this.values_[10 + physicalEdge] = dimension;
  }

  border(physicalEdge: PhysicalEdge): number {
    return this.values_[14 + physicalEdge]!;
  }

  setBorder(physicalEdge: PhysicalEdge, dimension: number): void {
    this.values_[14 + physicalEdge] = dimension;
  }

  padding(physicalEdge: PhysicalEdge): number {
    return this.values_[18 + physicalEdge]!;
  }

  setPadding(physicalEdge: PhysicalEdge, dimension: number): void {
    this.values_[18 + physicalEdge] = dimension;
  }
}

function initialLayoutValues(): number[] {
  return [NaN, NaN, NaN, NaN, NaN, NaN, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}
