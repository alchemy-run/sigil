// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

// Port of yoga/algorithm/Cache.cpp.

import type { Config } from "./config.ts";
import { SizingMode } from "./helpers.ts";
import { inexactEquals, isDefined } from "./numeric.ts";
import { roundValueToPixelGrid } from "./pixelGrid.ts";

function sizeIsExactAndMatchesOldMeasuredSize(
  sizeMode: SizingMode,
  size: number,
  lastComputedSize: number,
): boolean {
  return sizeMode === SizingMode.StretchFit && inexactEquals(size, lastComputedSize);
}

function oldSizeIsMaxContentAndStillFits(
  sizeMode: SizingMode,
  size: number,
  lastSizeMode: SizingMode,
  lastComputedSize: number,
): boolean {
  return (
    sizeMode === SizingMode.FitContent &&
    lastSizeMode === SizingMode.MaxContent &&
    (size >= lastComputedSize || inexactEquals(size, lastComputedSize))
  );
}

function newSizeIsStricterAndStillValid(
  sizeMode: SizingMode,
  size: number,
  lastSizeMode: SizingMode,
  lastSize: number,
  lastComputedSize: number,
): boolean {
  return (
    lastSizeMode === SizingMode.FitContent &&
    sizeMode === SizingMode.FitContent &&
    isDefined(lastSize) &&
    isDefined(size) &&
    isDefined(lastComputedSize) &&
    lastSize > size &&
    (lastComputedSize <= size || inexactEquals(size, lastComputedSize))
  );
}

export function canUseCachedMeasurement(
  widthMode: SizingMode,
  availableWidth: number,
  heightMode: SizingMode,
  availableHeight: number,
  lastWidthMode: SizingMode,
  lastAvailableWidth: number,
  lastHeightMode: SizingMode,
  lastAvailableHeight: number,
  lastComputedWidth: number,
  lastComputedHeight: number,
  marginRow: number,
  marginColumn: number,
  config: Config,
): boolean {
  if (
    (isDefined(lastComputedHeight) && lastComputedHeight < 0) ||
    (isDefined(lastComputedWidth) && lastComputedWidth < 0)
  ) {
    return false;
  }

  const pointScaleFactor = config.getPointScaleFactor();

  const useRoundedComparison = pointScaleFactor !== 0;
  const effectiveWidth = useRoundedComparison
    ? roundValueToPixelGrid(availableWidth, pointScaleFactor, false, false)
    : availableWidth;
  const effectiveHeight = useRoundedComparison
    ? roundValueToPixelGrid(availableHeight, pointScaleFactor, false, false)
    : availableHeight;
  const effectiveLastWidth = useRoundedComparison
    ? roundValueToPixelGrid(lastAvailableWidth, pointScaleFactor, false, false)
    : lastAvailableWidth;
  const effectiveLastHeight = useRoundedComparison
    ? roundValueToPixelGrid(lastAvailableHeight, pointScaleFactor, false, false)
    : lastAvailableHeight;

  const hasSameWidthSpec =
    lastWidthMode === widthMode && inexactEquals(effectiveLastWidth, effectiveWidth);
  const hasSameHeightSpec =
    lastHeightMode === heightMode && inexactEquals(effectiveLastHeight, effectiveHeight);

  const widthIsCompatible =
    hasSameWidthSpec ||
    sizeIsExactAndMatchesOldMeasuredSize(
      widthMode,
      availableWidth - marginRow,
      lastComputedWidth,
    ) ||
    oldSizeIsMaxContentAndStillFits(
      widthMode,
      availableWidth - marginRow,
      lastWidthMode,
      lastComputedWidth,
    ) ||
    newSizeIsStricterAndStillValid(
      widthMode,
      availableWidth - marginRow,
      lastWidthMode,
      lastAvailableWidth,
      lastComputedWidth,
    );

  const heightIsCompatible =
    hasSameHeightSpec ||
    sizeIsExactAndMatchesOldMeasuredSize(
      heightMode,
      availableHeight - marginColumn,
      lastComputedHeight,
    ) ||
    oldSizeIsMaxContentAndStillFits(
      heightMode,
      availableHeight - marginColumn,
      lastHeightMode,
      lastComputedHeight,
    ) ||
    newSizeIsStricterAndStillValid(
      heightMode,
      availableHeight - marginColumn,
      lastHeightMode,
      lastAvailableHeight,
      lastComputedHeight,
    );

  return widthIsCompatible && heightIsCompatible;
}
