// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

// Port of yoga/numeric/Comparison.h and yoga/numeric/FloatOptional.h.
//
// C++ FloatOptional wraps a float where NaN means "undefined". In this port an
// optional float is just a `number` with NaN as the undefined sentinel, and
// these helpers reproduce the C++ comparison semantics while calculations
// themselves use JavaScript's native double-precision numbers.

export function isUndefined(value: number): boolean {
  return Number.isNaN(value);
}

export function isDefined(value: number): boolean {
  return !Number.isNaN(value);
}

export function maxOrDefined(a: number, b: number): number {
  if (isDefined(a) && isDefined(b)) {
    return Math.max(a, b);
  }
  return isUndefined(a) ? b : a;
}

export function minOrDefined(a: number, b: number): number {
  if (isDefined(a) && isDefined(b)) {
    return Math.min(a, b);
  }
  return isUndefined(a) ? b : a;
}

// Custom equality using a hardcoded epsilon of 0.0001, or true if both are NaN.
export function inexactEquals(a: number, b: number): boolean {
  if (isDefined(a) && isDefined(b)) {
    return Math.abs(a - b) < 0.0001;
  }
  return isUndefined(a) && isUndefined(b);
}

// FloatOptional::operator== — exact equality, or both undefined.
export function optionalEquals(a: number, b: number): boolean {
  return a === b || (isUndefined(a) && isUndefined(b));
}
