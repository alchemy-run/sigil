// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

defineBackendTest("rounding_feature_with_custom_measure_func_floor", ({ Yoga }) => {
  const config = Yoga.Config.create();
  const root = Yoga.Node.create(config);
  const child = Yoga.Node.create(config);
  child.setMeasureFunc(() => ({ width: 10.2, height: 10.2 }));
  root.insertChild(child, 0);
  for (const [scale, expected, direction] of [
    [0, 10.2, Yoga.DIRECTION_RTL],
    [1, 11, Yoga.DIRECTION_LTR],
    [2, 10.5, Yoga.DIRECTION_RTL],
    [4, 10.25, Yoga.DIRECTION_LTR],
    [1 / 3, 12, Yoga.DIRECTION_RTL],
  ] as const) {
    config.setPointScaleFactor(scale);
    root.calculateLayout(undefined, undefined, direction);
    if (expected === 10.2) {
      // 10.2 is not exactly representable as a float (10.199999809265137),
      // matching ASSERT_FLOAT_EQ's tolerance.
      expect(child.getComputedWidth()).toBeCloseTo(expected, 5);
      expect(child.getComputedHeight()).toBeCloseTo(expected, 5);
    } else {
      expect(child.getComputedWidth()).toBe(expected);
      expect(child.getComputedHeight()).toBe(expected);
    }
  }
});

defineBackendTest("rounding_feature_with_custom_measure_func_ceil", ({ Yoga }) => {
  const config = Yoga.Config.create();
  config.setPointScaleFactor(1);
  const root = Yoga.Node.create(config);
  const child = Yoga.Node.create(config);
  child.setMeasureFunc(() => ({ width: 10.5, height: 10.5 }));
  root.insertChild(child, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child.getComputedWidth()).toBe(11);
  expect(child.getComputedHeight()).toBe(11);
});

defineBackendTest(
  "rounding_feature_with_custom_measure_and_fractial_matching_scale",
  ({ Yoga }) => {
    const config = Yoga.Config.create();
    config.setPointScaleFactor(2);
    const root = Yoga.Node.create(config);
    root.setPositionType(Yoga.POSITION_TYPE_ABSOLUTE);
    const child = Yoga.Node.create(config);
    child.setPosition(Yoga.EDGE_LEFT, 73.625);
    child.setMeasureFunc(() => ({ width: 0.5, height: 0.5 }));
    root.insertChild(child, 0);
    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
    expect(child.getComputedLayout()).toMatchObject({
      left: 73.5,
      width: 0.5,
      height: 0.5,
    });
  },
);
