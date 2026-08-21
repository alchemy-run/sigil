// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

defineBackendTest("reset_layout_when_child_removed", ({ Yoga }) => {
  const root = Yoga.Node.create();
  const child = Yoga.Node.create();
  child.setWidth(100);
  child.setHeight(100);
  root.insertChild(child, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child.getComputedLayout()).toMatchObject({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
  });
  root.removeChild(child);
  expect(child.getComputedLeft()).toBe(0);
  expect(child.getComputedTop()).toBe(0);
  expect(child.getComputedWidth()).toBeNaN();
  expect(child.getComputedHeight()).toBeNaN();
});

defineBackendTest("removed_child_can_be_reused_with_valid_layout", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(200);
  root.setHeight(200);
  const child = Yoga.Node.create();
  child.setWidth(100);
  child.setHeight(100);
  root.insertChild(child, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child.getComputedWidth()).toBe(100);
  expect(child.getComputedHeight()).toBe(100);
  root.removeChild(child);
  expect(child.getComputedWidth()).toBeNaN();
  expect(child.getComputedHeight()).toBeNaN();
  expect(child.isDirty()).toBe(true);
  root.insertChild(child, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child.getComputedLayout()).toMatchObject({ width: 100, height: 100 });
  expect(child.isDirty()).toBe(false);
});
