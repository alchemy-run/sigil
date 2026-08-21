// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";
import { getMeasureCounter, getMeasureCounterMin } from "./tools/MeasureCounter.ts";

defineBackendTest("remeasure_with_same_exact_width_larger_than_needed_height", ({ Yoga }) => {
  const root = Yoga.Node.create();

  const measureCounter = getMeasureCounterMin();

  const root_child0 = Yoga.Node.create();
  root_child0.setMeasureFunc(measureCounter.inc);
  root.insertChild(root_child0, 0);

  root.calculateLayout(100, 100, Yoga.DIRECTION_LTR);
  root.calculateLayout(100, 50, Yoga.DIRECTION_LTR);

  expect(measureCounter.get()).toBe(1);
});

defineBackendTest("remeasure_with_same_atmost_width_larger_than_needed_height", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);

  const measureCounter = getMeasureCounterMin();

  const root_child0 = Yoga.Node.create();
  root_child0.setMeasureFunc(measureCounter.inc);
  root.insertChild(root_child0, 0);

  root.calculateLayout(100, 100, Yoga.DIRECTION_LTR);
  root.calculateLayout(100, 50, Yoga.DIRECTION_LTR);

  expect(measureCounter.get()).toBe(1);
});

defineBackendTest("remeasure_with_computed_width_larger_than_needed_height", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);

  const measureCounter = getMeasureCounterMin();

  const root_child0 = Yoga.Node.create();
  root_child0.setMeasureFunc(measureCounter.inc);
  root.insertChild(root_child0, 0);

  root.calculateLayout(100, 100, Yoga.DIRECTION_LTR);
  root.setAlignItems(Yoga.ALIGN_STRETCH);
  root.calculateLayout(10, 50, Yoga.DIRECTION_LTR);

  expect(measureCounter.get()).toBe(1);
});

defineBackendTest("remeasure_with_atmost_computed_width_undefined_height", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);

  const measureCounter = getMeasureCounterMin();

  const root_child0 = Yoga.Node.create();
  root_child0.setMeasureFunc(measureCounter.inc);
  root.insertChild(root_child0, 0);

  root.calculateLayout(100, undefined, Yoga.DIRECTION_LTR);
  root.calculateLayout(10, undefined, Yoga.DIRECTION_LTR);

  expect(measureCounter.get()).toBe(1);
});

defineBackendTest(
  "remeasure_with_already_measured_value_smaller_but_still_float_equal",
  ({ Yoga }) => {
    const root = Yoga.Node.create();
    root.setWidth(288);
    root.setHeight(288);
    root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);

    const root_child0 = Yoga.Node.create();
    root_child0.setPadding(Yoga.EDGE_ALL, 2.88);
    root_child0.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
    root.insertChild(root_child0, 0);

    const measureCounter = getMeasureCounter(() => ({ width: 84, height: 49 }));

    const root_child0_child0 = Yoga.Node.create();
    root_child0_child0.setMeasureFunc(measureCounter.inc);
    root_child0.insertChild(root_child0_child0, 0);

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

    expect(measureCounter.get()).toBe(1);
  },
);
