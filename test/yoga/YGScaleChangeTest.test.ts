// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

defineBackendTest("scale_change_invalidates_layout", ({ Yoga }) => {
  const config = Yoga.Config.create();
  config.setPointScaleFactor(1);
  const root = Yoga.Node.create(config);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(50);
  root.setHeight(50);
  const first = Yoga.Node.create(config);
  first.setFlexGrow(1);
  root.insertChild(first, 0);
  const second = Yoga.Node.create(config);
  second.setFlexGrow(1);
  root.insertChild(second, 1);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(first.getComputedLeft()).toBe(0);
  expect(second.getComputedLeft()).toBe(25);
  config.setPointScaleFactor(1.5);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(first.getComputedLeft()).toBe(0);
  // Left should change due to pixel alignment of new scale factor
  expect(second.getComputedLeft()).toBeCloseTo(25.333334, 5);
});

defineBackendTest("errata_config_change_relayout", ({ Yoga }) => {
  const config = Yoga.Config.create();
  config.setErrata(Yoga.ERRATA_STRETCH_FLEX_BASIS);
  const root = Yoga.Node.create(config);
  root.setWidth(500);
  root.setHeight(500);
  const child = Yoga.Node.create(config);
  child.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.insertChild(child, 0);
  const grandchild = Yoga.Node.create(config);
  grandchild.setFlexGrow(1);
  grandchild.setFlexShrink(1);
  child.insertChild(grandchild, 0);
  const greatGrandchild = Yoga.Node.create(config);
  greatGrandchild.setFlexGrow(1);
  greatGrandchild.setFlexShrink(1);
  grandchild.insertChild(greatGrandchild, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root.getComputedLeft()).toBe(0);
  expect(root.getComputedTop()).toBe(0);
  expect(root.getComputedWidth()).toBe(500);
  expect(root.getComputedHeight()).toBe(500);

  expect(child.getComputedLeft()).toBe(0);
  expect(child.getComputedTop()).toBe(0);
  expect(child.getComputedWidth()).toBe(500);
  expect(child.getComputedHeight()).toBe(500);

  expect(grandchild.getComputedLeft()).toBe(0);
  expect(grandchild.getComputedTop()).toBe(0);
  expect(grandchild.getComputedWidth()).toBe(0);
  expect(grandchild.getComputedHeight()).toBe(500);

  expect(greatGrandchild.getComputedLeft()).toBe(0);
  expect(greatGrandchild.getComputedTop()).toBe(0);
  expect(greatGrandchild.getComputedWidth()).toBe(0);
  expect(greatGrandchild.getComputedHeight()).toBe(500);

  config.setErrata(Yoga.ERRATA_NONE);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root.getComputedLeft()).toBe(0);
  expect(root.getComputedTop()).toBe(0);
  expect(root.getComputedWidth()).toBe(500);
  expect(root.getComputedHeight()).toBe(500);

  expect(child.getComputedLeft()).toBe(0);
  expect(child.getComputedTop()).toBe(0);
  expect(child.getComputedWidth()).toBe(500);
  // This should be modified by the lack of the errata
  expect(child.getComputedHeight()).toBe(0);

  expect(grandchild.getComputedLeft()).toBe(0);
  expect(grandchild.getComputedTop()).toBe(0);
  expect(grandchild.getComputedWidth()).toBe(0);
  // This should be modified by the lack of the errata
  expect(grandchild.getComputedHeight()).toBe(0);

  expect(greatGrandchild.getComputedLeft()).toBe(0);
  expect(greatGrandchild.getComputedTop()).toBe(0);
  expect(greatGrandchild.getComputedWidth()).toBe(0);
  // This should be modified by the lack of the errata
  expect(greatGrandchild.getComputedHeight()).toBe(0);
});

// The C++ suite also has setting_compatible_config_maintains_layout_cache,
// which reassigns nodes to a new, functionally identical config via
// YGNodeSetConfig. The JS binding does not expose YGNodeSetConfig (a node's
// config can only be provided at creation time), so that test cannot be
// ported.
