// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { MeasureMode } from "#/yoga/generated/YGEnums.ts";
import type { MeasureFunction } from "#/yoga/index.ts";

export type MeasureCounter = {
  inc: MeasureFunction;
  get: () => number;
};

export function getMeasureCounter(
  cb?: MeasureFunction | null,
  staticWidth = 0,
  staticHeight = 0,
): MeasureCounter {
  let counter = 0;

  return {
    inc: function (width, widthMode, height, heightMode) {
      counter += 1;

      return cb
        ? cb(width, widthMode, height, heightMode)
        : { width: staticWidth, height: staticHeight };
    },

    get: function () {
      return counter;
    },
  };
}

export function getMeasureCounterMax(): MeasureCounter {
  return getMeasureCounter((width, widthMode, height, heightMode) => {
    const measuredWidth = widthMode === MeasureMode.Undefined ? 10 : width;
    const measuredHeight = heightMode === MeasureMode.Undefined ? 10 : height;

    return { width: measuredWidth, height: measuredHeight };
  });
}

export function getMeasureCounterMin(): MeasureCounter {
  return getMeasureCounter((width, widthMode, height, heightMode) => {
    const measuredWidth =
      widthMode === MeasureMode.Undefined || (widthMode == MeasureMode.AtMost && width > 10)
        ? 10
        : width;
    const measuredHeight =
      heightMode === MeasureMode.Undefined || (heightMode == MeasureMode.AtMost && height > 10)
        ? 10
        : height;

    return { width: measuredWidth, height: measuredHeight };
  });
}
