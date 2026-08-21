// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

defineBackendTest("dont_cache_computed_flex_basis_between_layouts", ({ Yoga }) => {
  const config = Yoga.Config.create();
  config.setExperimentalFeatureEnabled(Yoga.EXPERIMENTAL_FEATURE_WEB_FLEX_BASIS, true);
  const root = Yoga.Node.create(config);
  root.setHeightPercent(100);
  root.setWidthPercent(100);
  const child = Yoga.Node.create(config);
  child.setFlexBasisPercent(100);
  root.insertChild(child, 0);
  root.calculateLayout(100, undefined, Yoga.DIRECTION_LTR);
  root.calculateLayout(100, 100, Yoga.DIRECTION_LTR);
  expect(child.getComputedHeight()).toBe(100);
});

defineBackendTest("recalculate_resolvedDimonsion_onchange", ({ Yoga }) => {
  const root = Yoga.Node.create();
  const child = Yoga.Node.create();
  child.setMinHeight(10);
  child.setMaxHeight(10);
  root.insertChild(child, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child.getComputedHeight()).toBe(10);
  child.setMinHeight(undefined);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child.getComputedHeight()).toBe(0);
});

defineBackendTest("relayout_containing_block_size_changes", ({ Yoga }) => {
  const config = Yoga.Config.create();

  const root = Yoga.Node.create(config);
  root.setPositionType(Yoga.POSITION_TYPE_ABSOLUTE);

  const root_child0 = Yoga.Node.create(config);
  root_child0.setPositionType(Yoga.POSITION_TYPE_RELATIVE);
  root_child0.setMargin(Yoga.EDGE_LEFT, 4);
  root_child0.setMargin(Yoga.EDGE_TOP, 5);
  root_child0.setMargin(Yoga.EDGE_RIGHT, 9);
  root_child0.setMargin(Yoga.EDGE_BOTTOM, 1);
  root_child0.setPadding(Yoga.EDGE_LEFT, 2);
  root_child0.setPadding(Yoga.EDGE_TOP, 9);
  root_child0.setPadding(Yoga.EDGE_RIGHT, 11);
  root_child0.setPadding(Yoga.EDGE_BOTTOM, 13);
  root_child0.setBorder(Yoga.EDGE_LEFT, 5);
  root_child0.setBorder(Yoga.EDGE_TOP, 6);
  root_child0.setBorder(Yoga.EDGE_RIGHT, 7);
  root_child0.setBorder(Yoga.EDGE_BOTTOM, 8);
  root_child0.setWidth(500);
  root_child0.setHeight(500);
  root.insertChild(root_child0, 0);

  const root_child0_child0 = Yoga.Node.create(config);
  root_child0_child0.setPositionType(Yoga.POSITION_TYPE_STATIC);
  root_child0_child0.setMargin(Yoga.EDGE_LEFT, 8);
  root_child0_child0.setMargin(Yoga.EDGE_TOP, 6);
  root_child0_child0.setMargin(Yoga.EDGE_RIGHT, 3);
  root_child0_child0.setMargin(Yoga.EDGE_BOTTOM, 9);
  root_child0_child0.setPadding(Yoga.EDGE_LEFT, 1);
  root_child0_child0.setPadding(Yoga.EDGE_TOP, 7);
  root_child0_child0.setPadding(Yoga.EDGE_RIGHT, 9);
  root_child0_child0.setPadding(Yoga.EDGE_BOTTOM, 4);
  root_child0_child0.setBorder(Yoga.EDGE_LEFT, 8);
  root_child0_child0.setBorder(Yoga.EDGE_TOP, 10);
  root_child0_child0.setBorder(Yoga.EDGE_RIGHT, 2);
  root_child0_child0.setBorder(Yoga.EDGE_BOTTOM, 1);
  root_child0_child0.setWidth(200);
  root_child0_child0.setHeight(200);
  root_child0.insertChild(root_child0_child0, 0);

  const root_child0_child0_child0 = Yoga.Node.create(config);
  root_child0_child0_child0.setPositionType(Yoga.POSITION_TYPE_ABSOLUTE);
  root_child0_child0_child0.setPosition(Yoga.EDGE_LEFT, 2);
  root_child0_child0_child0.setPosition(Yoga.EDGE_RIGHT, 12);
  root_child0_child0_child0.setMargin(Yoga.EDGE_LEFT, 9);
  root_child0_child0_child0.setMargin(Yoga.EDGE_TOP, 12);
  root_child0_child0_child0.setMargin(Yoga.EDGE_RIGHT, 4);
  root_child0_child0_child0.setMargin(Yoga.EDGE_BOTTOM, 7);
  root_child0_child0_child0.setPadding(Yoga.EDGE_LEFT, 5);
  root_child0_child0_child0.setPadding(Yoga.EDGE_TOP, 3);
  root_child0_child0_child0.setPadding(Yoga.EDGE_RIGHT, 8);
  root_child0_child0_child0.setPadding(Yoga.EDGE_BOTTOM, 10);
  root_child0_child0_child0.setBorder(Yoga.EDGE_LEFT, 2);
  root_child0_child0_child0.setBorder(Yoga.EDGE_TOP, 1);
  root_child0_child0_child0.setBorder(Yoga.EDGE_RIGHT, 5);
  root_child0_child0_child0.setBorder(Yoga.EDGE_BOTTOM, 9);
  root_child0_child0_child0.setWidthPercent(41);
  root_child0_child0_child0.setHeightPercent(63);
  root_child0_child0.insertChild(root_child0_child0_child0, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root.getComputedLeft()).toBe(0);
  expect(root.getComputedTop()).toBe(0);
  expect(root.getComputedWidth()).toBe(513);
  expect(root.getComputedHeight()).toBe(506);

  expect(root_child0.getComputedLeft()).toBe(4);
  expect(root_child0.getComputedTop()).toBe(5);
  expect(root_child0.getComputedWidth()).toBe(500);
  expect(root_child0.getComputedHeight()).toBe(500);

  expect(root_child0_child0.getComputedLeft()).toBe(15);
  expect(root_child0_child0.getComputedTop()).toBe(21);
  expect(root_child0_child0.getComputedWidth()).toBe(200);
  expect(root_child0_child0.getComputedHeight()).toBe(200);

  expect(root_child0_child0_child0.getComputedLeft()).toBe(1);
  expect(root_child0_child0_child0.getComputedTop()).toBe(29);
  expect(root_child0_child0_child0.getComputedWidth()).toBe(200);
  expect(root_child0_child0_child0.getComputedHeight()).toBe(306);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_RTL);

  expect(root.getComputedLeft()).toBe(0);
  expect(root.getComputedTop()).toBe(0);
  expect(root.getComputedWidth()).toBe(513);
  expect(root.getComputedHeight()).toBe(506);

  expect(root_child0.getComputedLeft()).toBe(4);
  expect(root_child0.getComputedTop()).toBe(5);
  expect(root_child0.getComputedWidth()).toBe(500);
  expect(root_child0.getComputedHeight()).toBe(500);

  expect(root_child0_child0.getComputedLeft()).toBe(279);
  expect(root_child0_child0.getComputedTop()).toBe(21);
  expect(root_child0_child0.getComputedWidth()).toBe(200);
  expect(root_child0_child0.getComputedHeight()).toBe(200);

  expect(root_child0_child0_child0.getComputedLeft()).toBe(-2);
  expect(root_child0_child0_child0.getComputedTop()).toBe(29);
  expect(root_child0_child0_child0.getComputedWidth()).toBe(200);
  expect(root_child0_child0_child0.getComputedHeight()).toBe(306);

  // Relayout starts here
  root_child0.setWidth(456);
  root_child0.setHeight(432);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root.getComputedLeft()).toBe(0);
  expect(root.getComputedTop()).toBe(0);
  expect(root.getComputedWidth()).toBe(469);
  expect(root.getComputedHeight()).toBe(438);

  expect(root_child0.getComputedLeft()).toBe(4);
  expect(root_child0.getComputedTop()).toBe(5);
  expect(root_child0.getComputedWidth()).toBe(456);
  expect(root_child0.getComputedHeight()).toBe(432);

  expect(root_child0_child0.getComputedLeft()).toBe(15);
  expect(root_child0_child0.getComputedTop()).toBe(21);
  expect(root_child0_child0.getComputedWidth()).toBe(200);
  expect(root_child0_child0.getComputedHeight()).toBe(200);

  expect(root_child0_child0_child0.getComputedLeft()).toBe(1);
  expect(root_child0_child0_child0.getComputedTop()).toBe(29);
  expect(root_child0_child0_child0.getComputedWidth()).toBe(182);
  expect(root_child0_child0_child0.getComputedHeight()).toBe(263);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_RTL);

  expect(root.getComputedLeft()).toBe(0);
  expect(root.getComputedTop()).toBe(0);
  expect(root.getComputedWidth()).toBe(469);
  expect(root.getComputedHeight()).toBe(438);

  expect(root_child0.getComputedLeft()).toBe(4);
  expect(root_child0.getComputedTop()).toBe(5);
  expect(root_child0.getComputedWidth()).toBe(456);
  expect(root_child0.getComputedHeight()).toBe(432);

  expect(root_child0_child0.getComputedLeft()).toBe(235);
  expect(root_child0_child0.getComputedTop()).toBe(21);
  expect(root_child0_child0.getComputedWidth()).toBe(200);
  expect(root_child0_child0.getComputedHeight()).toBe(200);

  expect(root_child0_child0_child0.getComputedLeft()).toBe(16);
  expect(root_child0_child0_child0.getComputedTop()).toBe(29);
  expect(root_child0_child0_child0.getComputedWidth()).toBe(182);
  expect(root_child0_child0_child0.getComputedHeight()).toBe(263);
});

defineBackendTest("has_new_layout_flag_set_static", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setPositionType(Yoga.POSITION_TYPE_STATIC);
  root_child0.setWidth(10);
  root_child0.setHeight(10);
  root.insertChild(root_child0, 0);

  const root_child0_child1 = Yoga.Node.create();
  root_child0_child1.setPositionType(Yoga.POSITION_TYPE_ABSOLUTE);
  root_child0_child1.setWidth(5);
  root_child0_child1.setHeight(5);
  root_child0.insertChild(root_child0_child1, 0);

  const root_child0_child0 = Yoga.Node.create();
  root_child0_child0.setPositionType(Yoga.POSITION_TYPE_STATIC);
  root_child0_child0.setWidth(5);
  root_child0_child0.setHeight(5);
  root_child0.insertChild(root_child0_child0, 1);

  const root_child0_child0_child0 = Yoga.Node.create();
  root_child0_child0_child0.setPositionType(Yoga.POSITION_TYPE_ABSOLUTE);
  root_child0_child0_child0.setWidthPercent(1);
  root_child0_child0_child0.setHeight(1);
  root_child0_child0.insertChild(root_child0_child0_child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  root.markLayoutSeen();
  root_child0.markLayoutSeen();
  root_child0_child0.markLayoutSeen();
  root_child0_child0_child0.markLayoutSeen();

  root.setWidth(110);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root.hasNewLayout()).toBe(true);
  expect(root_child0.hasNewLayout()).toBe(true);
  expect(root_child0_child0.hasNewLayout()).toBe(true);
  expect(root_child0_child0_child0.hasNewLayout()).toBe(true);
});
