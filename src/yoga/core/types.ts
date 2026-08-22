// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

// Port of yoga/style/StyleLength.h and yoga/style/StyleSizeLength.h.

import { isUndefined, optionalEquals, inexactEquals } from "#/yoga/core/numeric.ts";
import { Unit } from "#/yoga/generated/YGEnums.ts";

function isInvalidValue(value: number): boolean {
  return isUndefined(value) || !Number.isFinite(value);
}

/**
 * A CSS <length-percentage> or keyword. `value` is NaN for keyword units.
 * Instances are immutable and may be shared.
 */
export class StyleLength {
  readonly value: number;
  readonly unit: Unit;

  protected constructor(value: number, unit: Unit) {
    this.value = value;
    this.unit = unit;
  }

  static points(value: number): StyleLength {
    return isInvalidValue(value) ? StyleLength.undefined() : new StyleLength(value, Unit.Point);
  }

  static percent(value: number): StyleLength {
    return isInvalidValue(value) ? StyleLength.undefined() : new StyleLength(value, Unit.Percent);
  }

  static ofAuto(): StyleLength {
    return AUTO;
  }

  static undefined(): StyleLength {
    return UNDEFINED;
  }

  isAuto(): boolean {
    return this.unit === Unit.Auto;
  }

  isUndefined(): boolean {
    return this.unit === Unit.Undefined;
  }

  isDefined(): boolean {
    return !this.isUndefined();
  }

  isPoints(): boolean {
    return this.unit === Unit.Point;
  }

  isPercent(): boolean {
    return this.unit === Unit.Percent;
  }

  resolve(referenceLength: number): number {
    switch (this.unit) {
      case Unit.Point:
        return this.value;
      case Unit.Percent:
        return this.value * referenceLength * 0.01;
      default:
        return NaN;
    }
  }

  equals(other: StyleLength): boolean {
    return optionalEquals(this.value, other.value) && this.unit === other.unit;
  }

  inexactEquals(other: StyleLength): boolean {
    return this.unit === other.unit && inexactEquals(this.value, other.value);
  }
}

const AUTO = new (class extends StyleLength {
  constructor() {
    super(NaN, Unit.Auto);
  }
})();

const UNDEFINED = new (class extends StyleLength {
  constructor() {
    super(NaN, Unit.Undefined);
  }
})();

/**
 * A CSS value for sizes (width, min-width, flex-basis, ...) which additionally
 * allows the auto/max-content/fit-content/stretch keywords.
 */
export class StyleSizeLength {
  readonly value: number;
  readonly unit: Unit;

  protected constructor(value: number, unit: Unit) {
    this.value = value;
    this.unit = unit;
  }

  static points(value: number): StyleSizeLength {
    return isInvalidValue(value)
      ? StyleSizeLength.undefined()
      : new StyleSizeLength(value, Unit.Point);
  }

  static percent(value: number): StyleSizeLength {
    return isInvalidValue(value)
      ? StyleSizeLength.undefined()
      : new StyleSizeLength(value, Unit.Percent);
  }

  static ofAuto(): StyleSizeLength {
    return SIZE_AUTO;
  }

  static ofMaxContent(): StyleSizeLength {
    return SIZE_MAX_CONTENT;
  }

  static ofFitContent(): StyleSizeLength {
    return SIZE_FIT_CONTENT;
  }

  static ofStretch(): StyleSizeLength {
    return SIZE_STRETCH;
  }

  static undefined(): StyleSizeLength {
    return SIZE_UNDEFINED;
  }

  isAuto(): boolean {
    return this.unit === Unit.Auto;
  }

  isMaxContent(): boolean {
    return this.unit === Unit.MaxContent;
  }

  isFitContent(): boolean {
    return this.unit === Unit.FitContent;
  }

  isStretch(): boolean {
    return this.unit === Unit.Stretch;
  }

  isUndefined(): boolean {
    return this.unit === Unit.Undefined;
  }

  isDefined(): boolean {
    return !this.isUndefined();
  }

  isPoints(): boolean {
    return this.unit === Unit.Point;
  }

  isPercent(): boolean {
    return this.unit === Unit.Percent;
  }

  resolve(referenceLength: number): number {
    switch (this.unit) {
      case Unit.Point:
        return this.value;
      case Unit.Percent:
        return this.value * referenceLength * 0.01;
      default:
        return NaN;
    }
  }

  equals(other: StyleSizeLength): boolean {
    return optionalEquals(this.value, other.value) && this.unit === other.unit;
  }

  inexactEquals(other: StyleSizeLength): boolean {
    return this.unit === other.unit && inexactEquals(this.value, other.value);
  }
}

const SIZE_AUTO = new (class extends StyleSizeLength {
  constructor() {
    super(NaN, Unit.Auto);
  }
})();

const SIZE_MAX_CONTENT = new (class extends StyleSizeLength {
  constructor() {
    super(NaN, Unit.MaxContent);
  }
})();

const SIZE_FIT_CONTENT = new (class extends StyleSizeLength {
  constructor() {
    super(NaN, Unit.FitContent);
  }
})();

const SIZE_STRETCH = new (class extends StyleSizeLength {
  constructor() {
    super(NaN, Unit.Stretch);
  }
})();

const SIZE_UNDEFINED = new (class extends StyleSizeLength {
  constructor() {
    super(NaN, Unit.Undefined);
  }
})();

export interface Size {
  width: number;
  height: number;
}
