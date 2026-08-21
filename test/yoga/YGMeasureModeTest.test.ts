// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { MeasureMode } from "../../src/yoga/generated/YGEnums.ts";
import type { MeasureFunction } from "../../src/yoga/index.ts";
import { defineBackendTest } from "./backends/defineBackendTest.ts";

type MeasureConstraint = {
  width: number;
  widthMode: MeasureMode;
  height: number;
  heightMode: MeasureMode;
};

function createConstraintMeasure(constraintList: Array<MeasureConstraint>): MeasureFunction {
  return (width, widthMode, height, heightMode) => {
    constraintList.push({ width, widthMode, height, heightMode });

    return {
      width: widthMode === MeasureMode.Undefined ? 10 : width,
      // Matches the C++ test's measure function, which returns `width` here.
      height: heightMode === MeasureMode.Undefined ? 10 : width,
    };
  };
}

defineBackendTest("exactly_measure_stretched_child_column", ({ Yoga }) => {
  const constraintList: Array<MeasureConstraint> = [];

  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setMeasureFunc(createConstraintMeasure(constraintList));
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(constraintList.length).toBe(1);

  expect(constraintList[0].width).toBe(100);
  expect(constraintList[0].widthMode).toBe(Yoga.MEASURE_MODE_EXACTLY);
});

defineBackendTest("exactly_measure_stretched_child_row", ({ Yoga }) => {
  const constraintList: Array<MeasureConstraint> = [];

  const root = Yoga.Node.create();
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setMeasureFunc(createConstraintMeasure(constraintList));
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(constraintList.length).toBe(1);

  expect(constraintList[0].height).toBe(100);
  expect(constraintList[0].heightMode).toBe(Yoga.MEASURE_MODE_EXACTLY);
});

defineBackendTest("at_most_main_axis_column", ({ Yoga }) => {
  const constraintList: Array<MeasureConstraint> = [];

  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setMeasureFunc(createConstraintMeasure(constraintList));
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(constraintList.length).toBe(1);

  expect(constraintList[0].height).toBe(100);
  expect(constraintList[0].heightMode).toBe(Yoga.MEASURE_MODE_AT_MOST);
});

defineBackendTest("at_most_cross_axis_column", ({ Yoga }) => {
  const constraintList: Array<MeasureConstraint> = [];

  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setMeasureFunc(createConstraintMeasure(constraintList));
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(constraintList.length).toBe(1);

  expect(constraintList[0].width).toBe(100);
  expect(constraintList[0].widthMode).toBe(Yoga.MEASURE_MODE_AT_MOST);
});

defineBackendTest("at_most_main_axis_row", ({ Yoga }) => {
  const constraintList: Array<MeasureConstraint> = [];

  const root = Yoga.Node.create();
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setMeasureFunc(createConstraintMeasure(constraintList));
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(constraintList.length).toBe(1);

  expect(constraintList[0].width).toBe(100);
  expect(constraintList[0].widthMode).toBe(Yoga.MEASURE_MODE_AT_MOST);
});

defineBackendTest("at_most_cross_axis_row", ({ Yoga }) => {
  const constraintList: Array<MeasureConstraint> = [];

  const root = Yoga.Node.create();
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setMeasureFunc(createConstraintMeasure(constraintList));
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(constraintList.length).toBe(1);

  expect(constraintList[0].height).toBe(100);
  expect(constraintList[0].heightMode).toBe(Yoga.MEASURE_MODE_AT_MOST);
});

defineBackendTest("flex_child", ({ Yoga }) => {
  const constraintList: Array<MeasureConstraint> = [];

  const root = Yoga.Node.create();
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setFlexGrow(1);
  root_child0.setMeasureFunc(createConstraintMeasure(constraintList));
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(constraintList.length).toBe(2);

  expect(constraintList[0].height).toBe(100);
  expect(constraintList[0].heightMode).toBe(Yoga.MEASURE_MODE_AT_MOST);

  expect(constraintList[1].height).toBe(100);
  expect(constraintList[1].heightMode).toBe(Yoga.MEASURE_MODE_EXACTLY);
});

defineBackendTest("flex_child_with_flex_basis", ({ Yoga }) => {
  const constraintList: Array<MeasureConstraint> = [];

  const root = Yoga.Node.create();
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setFlexGrow(1);
  root_child0.setFlexBasis(0);
  root_child0.setMeasureFunc(createConstraintMeasure(constraintList));
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(constraintList.length).toBe(1);

  expect(constraintList[0].height).toBe(100);
  expect(constraintList[0].heightMode).toBe(Yoga.MEASURE_MODE_EXACTLY);
});

defineBackendTest("overflow_scroll_column", ({ Yoga }) => {
  const constraintList: Array<MeasureConstraint> = [];

  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setOverflow(Yoga.OVERFLOW_SCROLL);
  root.setHeight(100);
  root.setWidth(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setMeasureFunc(createConstraintMeasure(constraintList));
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(constraintList.length).toBe(1);

  expect(constraintList[0].width).toBe(100);
  expect(constraintList[0].widthMode).toBe(Yoga.MEASURE_MODE_AT_MOST);

  expect(constraintList[0].height).toBeNaN();
  expect(constraintList[0].heightMode).toBe(Yoga.MEASURE_MODE_UNDEFINED);
});

defineBackendTest("overflow_scroll_row", ({ Yoga }) => {
  const constraintList: Array<MeasureConstraint> = [];

  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setOverflow(Yoga.OVERFLOW_SCROLL);
  root.setHeight(100);
  root.setWidth(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setMeasureFunc(createConstraintMeasure(constraintList));
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(constraintList.length).toBe(1);

  expect(constraintList[0].width).toBeNaN();
  expect(constraintList[0].widthMode).toBe(Yoga.MEASURE_MODE_UNDEFINED);

  expect(constraintList[0].height).toBe(100);
  expect(constraintList[0].heightMode).toBe(Yoga.MEASURE_MODE_AT_MOST);
});
