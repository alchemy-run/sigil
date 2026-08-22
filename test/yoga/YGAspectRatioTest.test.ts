// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { MeasureMode } from "#/yoga/generated/YGEnums.ts";
import type { MeasureFunction } from "#/yoga/index.ts";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

const _measure: MeasureFunction = (width, widthMode, height, heightMode) => ({
  width: widthMode === MeasureMode.Exactly ? width : 50,
  height: heightMode === MeasureMode.Exactly ? height : 50,
});

defineBackendTest("aspect_ratio_cross_defined", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setWidth(50);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(50);
  expect(root_child0.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_main_defined", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setHeight(50);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(50);
  expect(root_child0.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_both_dimensions_defined_row", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setWidth(100);
  root_child0.setHeight(50);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(100);
  expect(root_child0.getComputedHeight()).toBe(100);
});

defineBackendTest("aspect_ratio_both_dimensions_defined_column", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setWidth(100);
  root_child0.setHeight(50);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(50);
  expect(root_child0.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_align_stretch", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(100);
  expect(root_child0.getComputedHeight()).toBe(100);
});

defineBackendTest("aspect_ratio_flex_grow", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setHeight(50);
  root_child0.setFlexGrow(1);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(100);
  expect(root_child0.getComputedHeight()).toBe(100);
});

defineBackendTest("aspect_ratio_flex_shrink", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setHeight(150);
  root_child0.setFlexShrink(1);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(100);
  expect(root_child0.getComputedHeight()).toBe(100);
});

defineBackendTest("aspect_ratio_flex_shrink_2", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setHeightPercent(100);
  root_child0.setFlexShrink(1);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  const root_child1 = Yoga.Node.create();
  root_child1.setHeightPercent(100);
  root_child1.setFlexShrink(1);
  root_child1.setAspectRatio(1);
  root.insertChild(root_child1, 1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(50);
  expect(root_child0.getComputedHeight()).toBe(50);

  expect(root_child1.getComputedLeft()).toBe(0);
  expect(root_child1.getComputedTop()).toBe(50);
  expect(root_child1.getComputedWidth()).toBe(50);
  expect(root_child1.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_basis", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setFlexBasis(50);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(50);
  expect(root_child0.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_absolute_layout_width_defined", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setPositionType(Yoga.POSITION_TYPE_ABSOLUTE);
  root_child0.setPosition(Yoga.EDGE_LEFT, 0);
  root_child0.setPosition(Yoga.EDGE_TOP, 0);
  root_child0.setWidth(50);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(50);
  expect(root_child0.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_absolute_layout_height_defined", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setPositionType(Yoga.POSITION_TYPE_ABSOLUTE);
  root_child0.setPosition(Yoga.EDGE_LEFT, 0);
  root_child0.setPosition(Yoga.EDGE_TOP, 0);
  root_child0.setHeight(50);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(50);
  expect(root_child0.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_with_max_cross_defined", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setHeight(50);
  root_child0.setMaxWidth(40);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(40);
  expect(root_child0.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_with_max_main_defined", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setWidth(50);
  root_child0.setMaxHeight(40);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(40);
  expect(root_child0.getComputedHeight()).toBe(40);
});

defineBackendTest("aspect_ratio_with_min_cross_defined", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setHeight(30);
  root_child0.setMinWidth(40);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(40);
  expect(root_child0.getComputedHeight()).toBe(30);
});

defineBackendTest("aspect_ratio_with_min_main_defined", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setWidth(30);
  root_child0.setMinHeight(40);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(40);
  expect(root_child0.getComputedHeight()).toBe(40);
});

defineBackendTest("aspect_ratio_double_cross", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setHeight(50);
  root_child0.setAspectRatio(2);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(100);
  expect(root_child0.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_half_cross", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setHeight(100);
  root_child0.setAspectRatio(0.5);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(50);
  expect(root_child0.getComputedHeight()).toBe(100);
});

defineBackendTest("aspect_ratio_double_main", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setWidth(50);
  root_child0.setAspectRatio(0.5);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(50);
  expect(root_child0.getComputedHeight()).toBe(100);
});

defineBackendTest("aspect_ratio_half_main", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setWidth(100);
  root_child0.setAspectRatio(2);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(100);
  expect(root_child0.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_with_measure_func", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setMeasureFunc(_measure);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(50);
  expect(root_child0.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_width_height_flex_grow_row", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(200);

  const root_child0 = Yoga.Node.create();
  root_child0.setWidth(50);
  root_child0.setHeight(50);
  root_child0.setFlexGrow(1);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(100);
  expect(root_child0.getComputedHeight()).toBe(100);
});

defineBackendTest("aspect_ratio_width_height_flex_grow_column", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(200);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setWidth(50);
  root_child0.setHeight(50);
  root_child0.setFlexGrow(1);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(100);
  expect(root_child0.getComputedHeight()).toBe(100);
});

defineBackendTest("aspect_ratio_height_as_flex_basis", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(200);
  root.setHeight(200);

  const root_child0 = Yoga.Node.create();
  root_child0.setHeight(50);
  root_child0.setFlexGrow(1);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  const root_child1 = Yoga.Node.create();
  root_child1.setHeight(100);
  root_child1.setFlexGrow(1);
  root_child1.setAspectRatio(1);
  root.insertChild(root_child1, 1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(75);
  expect(root_child0.getComputedHeight()).toBe(75);

  expect(root_child1.getComputedLeft()).toBe(75);
  expect(root_child1.getComputedTop()).toBe(0);
  expect(root_child1.getComputedWidth()).toBe(125);
  expect(root_child1.getComputedHeight()).toBe(125);
});

defineBackendTest("aspect_ratio_width_as_flex_basis", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(200);
  root.setHeight(200);

  const root_child0 = Yoga.Node.create();
  root_child0.setWidth(50);
  root_child0.setFlexGrow(1);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  const root_child1 = Yoga.Node.create();
  root_child1.setWidth(100);
  root_child1.setFlexGrow(1);
  root_child1.setAspectRatio(1);
  root.insertChild(root_child1, 1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(75);
  expect(root_child0.getComputedHeight()).toBe(75);

  expect(root_child1.getComputedLeft()).toBe(0);
  expect(root_child1.getComputedTop()).toBe(75);
  expect(root_child1.getComputedWidth()).toBe(125);
  expect(root_child1.getComputedHeight()).toBe(125);
});

defineBackendTest("aspect_ratio_overrides_flex_grow_row", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setWidth(50);
  root_child0.setFlexGrow(1);
  root_child0.setAspectRatio(0.5);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(100);
  expect(root_child0.getComputedHeight()).toBe(200);
});

defineBackendTest("aspect_ratio_overrides_flex_grow_column", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setHeight(50);
  root_child0.setFlexGrow(1);
  root_child0.setAspectRatio(2);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(200);
  expect(root_child0.getComputedHeight()).toBe(100);
});

defineBackendTest("aspect_ratio_left_right_absolute", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setPositionType(Yoga.POSITION_TYPE_ABSOLUTE);
  root_child0.setPosition(Yoga.EDGE_LEFT, 10);
  root_child0.setPosition(Yoga.EDGE_TOP, 10);
  root_child0.setPosition(Yoga.EDGE_RIGHT, 10);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(10);
  expect(root_child0.getComputedTop()).toBe(10);
  expect(root_child0.getComputedWidth()).toBe(80);
  expect(root_child0.getComputedHeight()).toBe(80);
});

defineBackendTest("aspect_ratio_top_bottom_absolute", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setPositionType(Yoga.POSITION_TYPE_ABSOLUTE);
  root_child0.setPosition(Yoga.EDGE_LEFT, 10);
  root_child0.setPosition(Yoga.EDGE_TOP, 10);
  root_child0.setPosition(Yoga.EDGE_BOTTOM, 10);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(10);
  expect(root_child0.getComputedTop()).toBe(10);
  expect(root_child0.getComputedWidth()).toBe(80);
  expect(root_child0.getComputedHeight()).toBe(80);
});

defineBackendTest("aspect_ratio_width_overrides_align_stretch_row", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setWidth(50);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(50);
  expect(root_child0.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_height_overrides_align_stretch_column", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setHeight(50);
  root_child0.setAspectRatio(1);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(50);
  expect(root_child0.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_allow_child_overflow_parent_size", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setHeight(50);
  root_child0.setAspectRatio(4);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root.getComputedWidth()).toBe(100);
  expect(root.getComputedHeight()).toBe(50);

  expect(root_child0.getComputedWidth()).toBe(200);
  expect(root_child0.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_defined_main_with_margin", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_CENTER);
  root.setJustifyContent(Yoga.JUSTIFY_CENTER);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setHeight(50);
  root_child0.setAspectRatio(1);
  root_child0.setMargin(Yoga.EDGE_LEFT, 10);
  root_child0.setMargin(Yoga.EDGE_RIGHT, 10);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root.getComputedWidth()).toBe(100);
  expect(root.getComputedHeight()).toBe(100);

  expect(root_child0.getComputedWidth()).toBe(50);
  expect(root_child0.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_defined_cross_with_margin", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_CENTER);
  root.setJustifyContent(Yoga.JUSTIFY_CENTER);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setWidth(50);
  root_child0.setAspectRatio(1);
  root_child0.setMargin(Yoga.EDGE_LEFT, 10);
  root_child0.setMargin(Yoga.EDGE_RIGHT, 10);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root.getComputedWidth()).toBe(100);
  expect(root.getComputedHeight()).toBe(100);

  expect(root_child0.getComputedWidth()).toBe(50);
  expect(root_child0.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_defined_cross_with_main_margin", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_CENTER);
  root.setJustifyContent(Yoga.JUSTIFY_CENTER);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setWidth(50);
  root_child0.setAspectRatio(1);
  root_child0.setMargin(Yoga.EDGE_TOP, 10);
  root_child0.setMargin(Yoga.EDGE_BOTTOM, 10);
  root.insertChild(root_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root.getComputedWidth()).toBe(100);
  expect(root.getComputedHeight()).toBe(100);

  expect(root_child0.getComputedWidth()).toBe(50);
  expect(root_child0.getComputedHeight()).toBe(50);
});

defineBackendTest("aspect_ratio_should_prefer_explicit_height", ({ Yoga }) => {
  const config = Yoga.Config.create();
  config.setUseWebDefaults(true);

  const root = Yoga.Node.create(config);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);

  const root_child0 = Yoga.Node.create(config);
  root_child0.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
  root.insertChild(root_child0, 0);

  const root_child0_child0 = Yoga.Node.create(config);
  root_child0_child0.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
  root_child0_child0.setHeight(100);
  root_child0_child0.setAspectRatio(2);
  root_child0.insertChild(root_child0_child0, 0);

  root.calculateLayout(100, 200, Yoga.DIRECTION_LTR);

  expect(root.getComputedWidth()).toBe(100);
  expect(root.getComputedHeight()).toBe(200);

  expect(root_child0.getComputedWidth()).toBe(100);
  expect(root_child0.getComputedHeight()).toBe(100);

  expect(root_child0_child0.getComputedWidth()).toBe(200);
  expect(root_child0_child0.getComputedHeight()).toBe(100);
});

defineBackendTest("aspect_ratio_should_prefer_explicit_width", ({ Yoga }) => {
  const config = Yoga.Config.create();
  config.setUseWebDefaults(true);

  const root = Yoga.Node.create(config);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);

  const root_child0 = Yoga.Node.create(config);
  root_child0.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.insertChild(root_child0, 0);

  const root_child0_child0 = Yoga.Node.create(config);
  root_child0_child0.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root_child0_child0.setWidth(100);
  root_child0_child0.setAspectRatio(0.5);
  root_child0.insertChild(root_child0_child0, 0);

  root.calculateLayout(200, 100, Yoga.DIRECTION_LTR);

  expect(root.getComputedWidth()).toBe(200);
  expect(root.getComputedHeight()).toBe(100);

  expect(root_child0.getComputedWidth()).toBe(100);
  expect(root_child0.getComputedHeight()).toBe(100);

  expect(root_child0_child0.getComputedWidth()).toBe(100);
  expect(root_child0_child0.getComputedHeight()).toBe(200);
});

defineBackendTest("aspect_ratio_should_prefer_flexed_dimension", ({ Yoga }) => {
  const config = Yoga.Config.create();
  config.setUseWebDefaults(true);

  const root = Yoga.Node.create(config);

  const root_child0 = Yoga.Node.create(config);
  root_child0.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
  root_child0.setAspectRatio(2);
  root_child0.setFlexGrow(1);
  root.insertChild(root_child0, 0);

  const root_child0_child0 = Yoga.Node.create(config);
  root_child0_child0.setAspectRatio(4);
  root_child0_child0.setFlexGrow(1);
  root_child0.insertChild(root_child0_child0, 0);

  root.calculateLayout(100, 100, Yoga.DIRECTION_LTR);

  expect(root.getComputedWidth()).toBe(100);
  expect(root.getComputedHeight()).toBe(100);

  expect(root_child0.getComputedWidth()).toBe(100);
  expect(root_child0.getComputedHeight()).toBe(50);

  expect(root_child0_child0.getComputedWidth()).toBe(200);
  expect(root_child0_child0.getComputedHeight()).toBe(50);
});
