// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

// The C++ suite also has rounding_value (calls YGRoundValueToPixelGrid
// directly) and raw_layout_dimensions (uses YGNodeLayoutGetRawWidth/
// YGNodeLayoutGetRawHeight). Neither API is exposed by the JS binding, so
// those tests cannot be ported.

// Regression test for https://github.com/facebook/yoga/issues/824
defineBackendTest("consistent_rounding_during_repeated_layouts", ({ Yoga }) => {
  const config = Yoga.Config.create();
  config.setPointScaleFactor(2);

  const root = Yoga.Node.create(config);
  root.setMargin(Yoga.EDGE_TOP, -1.49);
  root.setWidth(500);
  root.setHeight(500);

  const node0 = Yoga.Node.create(config);
  root.insertChild(node0, 0);

  const node1 = Yoga.Node.create(config);
  node1.setMeasureFunc(() => ({ width: 10, height: 10 }));
  node0.insertChild(node1, 0);

  for (let i = 0; i < 5; i++) {
    // Dirty the tree so YGRoundToPixelGrid runs again
    root.setMargin(Yoga.EDGE_LEFT, i + 1);

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
    expect(node1.getComputedHeight()).toBe(10);
  }
});

defineBackendTest("per_node_point_scale_factor", ({ Yoga }) => {
  const config1 = Yoga.Config.create();
  config1.setPointScaleFactor(2);

  const config2 = Yoga.Config.create();
  config2.setPointScaleFactor(1);

  const config3 = Yoga.Config.create();
  config3.setPointScaleFactor(0.5);

  const root = Yoga.Node.create(config1);
  root.setWidth(11.5);
  root.setHeight(11.5);

  const node0 = Yoga.Node.create(config2);
  node0.setWidth(9.5);
  node0.setHeight(9.5);
  root.insertChild(node0, 0);

  const node1 = Yoga.Node.create(config3);
  node1.setWidth(7);
  node1.setHeight(7);
  node0.insertChild(node1, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root.getComputedWidth()).toBe(11.5);
  expect(root.getComputedHeight()).toBe(11.5);

  expect(node0.getComputedWidth()).toBe(10);
  expect(node0.getComputedHeight()).toBe(10);

  expect(node1.getComputedWidth()).toBe(8);
  expect(node1.getComputedHeight()).toBe(8);
});

defineBackendTest("rounds_dimensions_at_offsets_beyond_safe_integer_range", ({ Yoga }) => {
  const config = Yoga.Config.create();
  config.setPointScaleFactor(1);

  const root = Yoga.Node.create(config);
  root.setWidth(100);
  root.setHeight(100);

  const child = Yoga.Node.create(config);
  child.setPositionType(Yoga.POSITION_TYPE_ABSOLUTE);
  child.setPosition(Yoga.EDGE_LEFT, 32_618_153_475_481_304);
  child.setWidth(66);
  child.setHeight(10);
  root.insertChild(child, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  // Adding the width to this absolute offset loses low bits in binary64.
  // Yoga derives the rounded width from the rounded absolute edges.
  expect(child.getComputedWidth()).toBe(64);
});
