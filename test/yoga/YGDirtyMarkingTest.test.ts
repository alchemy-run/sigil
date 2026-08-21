// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

defineBackendTest("dirty_propagation", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setWidth(50);
  root_child0.setHeight(20);
  root.insertChild(root_child0, 0);

  const root_child1 = Yoga.Node.create();
  root_child1.setWidth(50);
  root_child1.setHeight(20);
  root.insertChild(root_child1, 1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  root_child0.setWidth(20);

  expect(root_child0.isDirty()).toBe(true);
  expect(root_child1.isDirty()).toBe(false);
  expect(root.isDirty()).toBe(true);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root_child0.isDirty()).toBe(false);
  expect(root_child1.isDirty()).toBe(false);
  expect(root.isDirty()).toBe(false);
});

defineBackendTest("dirty_propagation_only_if_prop_changed", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(100);
  root.setHeight(100);

  const root_child0 = Yoga.Node.create();
  root_child0.setWidth(50);
  root_child0.setHeight(20);
  root.insertChild(root_child0, 0);

  const root_child1 = Yoga.Node.create();
  root_child1.setWidth(50);
  root_child1.setHeight(20);
  root.insertChild(root_child1, 1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  root_child0.setWidth(50);

  expect(root_child0.isDirty()).toBe(false);
  expect(root_child1.isDirty()).toBe(false);
  expect(root.isDirty()).toBe(false);
});

defineBackendTest("dirty_mark_all_children_as_dirty_when_display_changes", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setHeight(100);

  const child0 = Yoga.Node.create();
  child0.setFlexGrow(1);
  const child1 = Yoga.Node.create();
  child1.setFlexGrow(1);

  const child1_child0 = Yoga.Node.create();
  const child1_child0_child0 = Yoga.Node.create();
  child1_child0_child0.setWidth(8);
  child1_child0_child0.setHeight(16);

  child1_child0.insertChild(child1_child0_child0, 0);

  child1.insertChild(child1_child0, 0);
  root.insertChild(child0, 0);
  root.insertChild(child1, 0);

  child0.setDisplay(Yoga.DISPLAY_FLEX);
  child1.setDisplay(Yoga.DISPLAY_NONE);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child1_child0_child0.getComputedWidth()).toBe(0);
  expect(child1_child0_child0.getComputedHeight()).toBe(0);

  child0.setDisplay(Yoga.DISPLAY_NONE);
  child1.setDisplay(Yoga.DISPLAY_FLEX);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child1_child0_child0.getComputedWidth()).toBe(8);
  expect(child1_child0_child0.getComputedHeight()).toBe(16);

  child0.setDisplay(Yoga.DISPLAY_FLEX);
  child1.setDisplay(Yoga.DISPLAY_NONE);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child1_child0_child0.getComputedWidth()).toBe(0);
  expect(child1_child0_child0.getComputedHeight()).toBe(0);

  child0.setDisplay(Yoga.DISPLAY_NONE);
  child1.setDisplay(Yoga.DISPLAY_FLEX);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child1_child0_child0.getComputedWidth()).toBe(8);
  expect(child1_child0_child0.getComputedHeight()).toBe(16);
});

defineBackendTest("dirty_node_only_if_children_are_actually_removed", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.setWidth(50);
  root.setHeight(50);

  const child0 = Yoga.Node.create();
  child0.setWidth(50);
  child0.setHeight(25);
  root.insertChild(child0, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  const child1 = Yoga.Node.create();
  root.removeChild(child1);
  expect(root.isDirty()).toBe(false);

  root.removeChild(child0);
  expect(root.isDirty()).toBe(true);
});

defineBackendTest("dirty_node_only_if_undefined_values_gets_set_to_undefined", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(50);
  root.setHeight(50);
  root.setMinWidth(undefined);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(root.isDirty()).toBe(false);

  root.setMinWidth(undefined);

  expect(root.isDirty()).toBe(false);
});

defineBackendTest("dirty_removed_child_node", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);

  const child = Yoga.Node.create();
  child.setWidth(50);
  child.setHeight(50);
  root.insertChild(child, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(child.isDirty()).toBe(false);

  root.removeChild(child);

  // Child should be marked dirty after removal so layout is recalculated
  // when the child is reused (e.g., in a recycling view system)
  expect(child.isDirty()).toBe(true);
});

defineBackendTest("dirty_removed_child_nodes_when_removing_all", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);

  const child0 = Yoga.Node.create();
  child0.setWidth(50);
  child0.setHeight(25);
  root.insertChild(child0, 0);

  const child1 = Yoga.Node.create();
  child1.setWidth(50);
  child1.setHeight(25);
  root.insertChild(child1, 1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(child0.isDirty()).toBe(false);
  expect(child1.isDirty()).toBe(false);

  root.setChildren([]);

  // All children should be marked dirty after removal
  expect(child0.isDirty()).toBe(true);
  expect(child1.isDirty()).toBe(true);
});

// The JS bindings have no equivalent of YGNodeFree, which detaches the node
// from its parent before freeing it. Removing the child is the closest
// observable equivalent: the parent must become dirty either way.
defineBackendTest("dirty_parent_when_child_freed", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);

  const child = Yoga.Node.create();
  child.setWidth(50);
  child.setHeight(50);
  root.insertChild(child, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(root.isDirty()).toBe(false);

  root.removeChild(child);

  expect(root.isDirty()).toBe(true);
});

// The JS bindings have no equivalent of YGNodeFreeRecursive; removing the
// subtree root from its parent is the closest observable equivalent.
defineBackendTest("dirty_parent_when_subtree_freed_recursive", ({ Yoga }) => {
  const root = Yoga.Node.create();
  const child = Yoga.Node.create();
  const grandchild = Yoga.Node.create();
  root.insertChild(child, 0);
  child.insertChild(grandchild, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(root.isDirty()).toBe(false);

  root.removeChild(child);

  expect(root.isDirty()).toBe(true);
});
