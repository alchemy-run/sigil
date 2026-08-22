// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import type { FlexDirection } from "#/yoga/generated/YGEnums.ts";
import type { Config, Node, Yoga } from "#/yoga/index.ts";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

function createYGNode(
  Yoga: Yoga,
  config: Config,
  flexDirection: FlexDirection,
  width: number,
  height: number,
  alignBaseline: boolean,
): Node {
  const node = Yoga.Node.create(config);
  node.setFlexDirection(flexDirection);
  if (alignBaseline) {
    node.setAlignItems(Yoga.ALIGN_BASELINE);
  }
  node.setWidth(width);
  node.setHeight(height);
  return node;
}

// Test case for bug in T32999822
defineBackendTest("align_baseline_parent_ht_not_specified", ({ Yoga }) => {
  const config = Yoga.Config.create();

  const root = Yoga.Node.create(config);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setAlignContent(Yoga.ALIGN_STRETCH);
  root.setAlignItems(Yoga.ALIGN_BASELINE);
  root.setWidth(340);
  root.setMaxHeight(170);
  root.setMinHeight(0);

  const root_child0 = Yoga.Node.create(config);
  root_child0.setFlexGrow(0);
  root_child0.setFlexShrink(1);
  root_child0.setMeasureFunc(() => ({ width: 42, height: 50 }));
  root.insertChild(root_child0, 0);

  const root_child1 = Yoga.Node.create(config);
  root_child1.setFlexGrow(0);
  root_child1.setFlexShrink(1);
  root_child1.setMeasureFunc(() => ({ width: 279, height: 126 }));
  root.insertChild(root_child1, 1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root.getComputedLeft()).toBe(0);
  expect(root.getComputedTop()).toBe(0);
  expect(root.getComputedWidth()).toBe(340);
  expect(root.getComputedHeight()).toBe(126);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(42);
  expect(root_child0.getComputedHeight()).toBe(50);
  expect(root_child0.getComputedTop()).toBe(76);

  expect(root_child1.getComputedLeft()).toBe(42);
  expect(root_child1.getComputedTop()).toBe(0);
  expect(root_child1.getComputedWidth()).toBe(279);
  expect(root_child1.getComputedHeight()).toBe(126);
});

defineBackendTest("align_baseline_with_no_baseline_func_and_no_parent_ht", ({ Yoga }) => {
  const config = Yoga.Config.create();

  const root = Yoga.Node.create(config);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setAlignItems(Yoga.ALIGN_BASELINE);
  root.setWidth(150);

  const root_child0 = Yoga.Node.create(config);
  root_child0.setWidth(50);
  root_child0.setHeight(80);
  root.insertChild(root_child0, 0);

  const root_child1 = Yoga.Node.create(config);
  root_child1.setWidth(50);
  root_child1.setHeight(50);
  root.insertChild(root_child1, 1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root.getComputedLeft()).toBe(0);
  expect(root.getComputedTop()).toBe(0);
  expect(root.getComputedWidth()).toBe(150);
  expect(root.getComputedHeight()).toBe(80);

  expect(root_child0.getComputedLeft()).toBe(0);
  expect(root_child0.getComputedTop()).toBe(0);
  expect(root_child0.getComputedWidth()).toBe(50);
  expect(root_child0.getComputedHeight()).toBe(80);

  expect(root_child1.getComputedLeft()).toBe(50);
  expect(root_child1.getComputedTop()).toBe(30);
  expect(root_child1.getComputedWidth()).toBe(50);
  expect(root_child1.getComputedHeight()).toBe(50);
});

defineBackendTest(
  "align_baseline_parent_using_child_in_column_as_reference_with_no_baseline_func",
  ({ Yoga }) => {
    const config = Yoga.Config.create();

    const root = createYGNode(Yoga, config, Yoga.FLEX_DIRECTION_ROW, 1000, 1000, true);

    const root_child0 = createYGNode(Yoga, config, Yoga.FLEX_DIRECTION_COLUMN, 500, 600, false);
    root.insertChild(root_child0, 0);

    const root_child1 = createYGNode(Yoga, config, Yoga.FLEX_DIRECTION_COLUMN, 500, 800, false);
    root.insertChild(root_child1, 1);

    const root_child1_child0 = createYGNode(
      Yoga,
      config,
      Yoga.FLEX_DIRECTION_COLUMN,
      500,
      300,
      false,
    );
    root_child1.insertChild(root_child1_child0, 0);

    const root_child1_child1 = createYGNode(
      Yoga,
      config,
      Yoga.FLEX_DIRECTION_COLUMN,
      500,
      400,
      false,
    );
    root_child1_child1.setIsReferenceBaseline(true);
    root_child1.insertChild(root_child1_child1, 1);

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

    expect(root_child0.getComputedLeft()).toBe(0);
    expect(root_child0.getComputedTop()).toBe(100);

    expect(root_child1.getComputedLeft()).toBe(500);
    expect(root_child1.getComputedTop()).toBe(0);

    expect(root_child1_child0.getComputedLeft()).toBe(0);
    expect(root_child1_child0.getComputedTop()).toBe(0);

    expect(root_child1_child1.getComputedLeft()).toBe(0);
    expect(root_child1_child1.getComputedTop()).toBe(300);
  },
);

defineBackendTest(
  "align_baseline_parent_using_child_in_row_as_reference_with_no_baseline_func",
  ({ Yoga }) => {
    const config = Yoga.Config.create();

    const root = createYGNode(Yoga, config, Yoga.FLEX_DIRECTION_ROW, 1000, 1000, true);

    const root_child0 = createYGNode(Yoga, config, Yoga.FLEX_DIRECTION_COLUMN, 500, 600, false);
    root.insertChild(root_child0, 0);

    const root_child1 = createYGNode(Yoga, config, Yoga.FLEX_DIRECTION_ROW, 500, 800, true);
    root.insertChild(root_child1, 1);

    const root_child1_child0 = createYGNode(
      Yoga,
      config,
      Yoga.FLEX_DIRECTION_COLUMN,
      500,
      500,
      false,
    );
    root_child1.insertChild(root_child1_child0, 0);

    const root_child1_child1 = createYGNode(
      Yoga,
      config,
      Yoga.FLEX_DIRECTION_COLUMN,
      500,
      400,
      false,
    );
    root_child1_child1.setIsReferenceBaseline(true);
    root_child1.insertChild(root_child1_child1, 1);

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

    expect(root_child0.getComputedLeft()).toBe(0);
    expect(root_child0.getComputedTop()).toBe(0);

    expect(root_child1.getComputedLeft()).toBe(500);
    expect(root_child1.getComputedTop()).toBe(100);

    expect(root_child1_child0.getComputedLeft()).toBe(0);
    expect(root_child1_child0.getComputedTop()).toBe(0);

    expect(root_child1_child1.getComputedLeft()).toBe(500);
    expect(root_child1_child1.getComputedTop()).toBe(100);
  },
);

defineBackendTest(
  "align_baseline_parent_using_child_in_column_as_reference_with_no_baseline_func_and_height_not_specified",
  ({ Yoga }) => {
    const config = Yoga.Config.create();

    const root = Yoga.Node.create(config);
    root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
    root.setAlignItems(Yoga.ALIGN_BASELINE);
    root.setWidth(1000);

    const root_child0 = createYGNode(Yoga, config, Yoga.FLEX_DIRECTION_COLUMN, 500, 600, false);
    root.insertChild(root_child0, 0);

    const root_child1 = Yoga.Node.create(config);
    root_child1.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
    root_child1.setWidth(500);
    root.insertChild(root_child1, 1);

    const root_child1_child0 = createYGNode(
      Yoga,
      config,
      Yoga.FLEX_DIRECTION_COLUMN,
      500,
      300,
      false,
    );
    root_child1.insertChild(root_child1_child0, 0);

    const root_child1_child1 = createYGNode(
      Yoga,
      config,
      Yoga.FLEX_DIRECTION_COLUMN,
      500,
      400,
      false,
    );
    root_child1_child1.setIsReferenceBaseline(true);
    root_child1.insertChild(root_child1_child1, 1);

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

    expect(root.getComputedHeight()).toBe(700);

    expect(root_child0.getComputedLeft()).toBe(0);
    expect(root_child0.getComputedTop()).toBe(100);

    expect(root_child1.getComputedLeft()).toBe(500);
    expect(root_child1.getComputedTop()).toBe(0);
    expect(root_child1.getComputedHeight()).toBe(700);

    expect(root_child1_child0.getComputedLeft()).toBe(0);
    expect(root_child1_child0.getComputedTop()).toBe(0);

    expect(root_child1_child1.getComputedLeft()).toBe(0);
    expect(root_child1_child1.getComputedTop()).toBe(300);
  },
);

defineBackendTest(
  "align_baseline_parent_using_child_in_row_as_reference_with_no_baseline_func_and_height_not_specified",
  ({ Yoga }) => {
    const config = Yoga.Config.create();

    const root = Yoga.Node.create(config);
    root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
    root.setAlignItems(Yoga.ALIGN_BASELINE);
    root.setWidth(1000);

    const root_child0 = createYGNode(Yoga, config, Yoga.FLEX_DIRECTION_COLUMN, 500, 600, false);
    root.insertChild(root_child0, 0);

    const root_child1 = Yoga.Node.create(config);
    root_child1.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
    root_child1.setWidth(500);
    root.insertChild(root_child1, 1);

    const root_child1_child0 = createYGNode(
      Yoga,
      config,
      Yoga.FLEX_DIRECTION_COLUMN,
      500,
      500,
      false,
    );
    root_child1.insertChild(root_child1_child0, 0);

    const root_child1_child1 = createYGNode(
      Yoga,
      config,
      Yoga.FLEX_DIRECTION_COLUMN,
      500,
      400,
      false,
    );
    root_child1_child1.setIsReferenceBaseline(true);
    root_child1.insertChild(root_child1_child1, 1);

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

    expect(root.getComputedHeight()).toBe(700);

    expect(root_child0.getComputedLeft()).toBe(0);
    expect(root_child0.getComputedTop()).toBe(0);

    expect(root_child1.getComputedLeft()).toBe(500);
    expect(root_child1.getComputedTop()).toBe(200);
    expect(root_child1.getComputedHeight()).toBe(500);

    expect(root_child1_child0.getComputedLeft()).toBe(0);
    expect(root_child1_child0.getComputedTop()).toBe(0);

    expect(root_child1_child1.getComputedLeft()).toBe(500);
    expect(root_child1_child1.getComputedTop()).toBe(0);
  },
);
