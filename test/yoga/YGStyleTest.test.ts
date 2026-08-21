// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

defineBackendTest("copy_style_same", ({ Yoga }) => {
  expect(() => Yoga.Node.create().copyStyle(Yoga.Node.create())).not.toThrow();
});

defineBackendTest("copy_style_modified", ({ Yoga }) => {
  const target = Yoga.Node.create();
  expect(target.getFlexDirection()).toBe(Yoga.FLEX_DIRECTION_COLUMN);
  expect(target.getMaxHeight().unit).toBe(Yoga.UNIT_UNDEFINED);
  const source = Yoga.Node.create();
  source.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  source.setMaxHeight(10);
  target.copyStyle(source);
  expect(target.getFlexDirection()).toBe(Yoga.FLEX_DIRECTION_ROW);
  expect(target.getMaxHeight()).toMatchObject({
    value: 10,
    unit: Yoga.UNIT_POINT,
  });
});

defineBackendTest("copy_style_modified_same", ({ Yoga }) => {
  const target = Yoga.Node.create();
  target.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  target.setMaxHeight(10);
  target.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  const source = Yoga.Node.create();
  source.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  source.setMaxHeight(10);
  expect(() => target.copyStyle(source)).not.toThrow();
});

defineBackendTest("initialise_flexShrink_flexGrow", ({ Yoga }) => {
  const node = Yoga.Node.create();
  node.setFlexShrink(1);
  expect(node.getFlexShrink()).toBe(1);
  node.setFlexShrink(undefined);
  node.setFlexGrow(3);
  expect(node.getFlexShrink()).toBe(0);
  expect(node.getFlexGrow()).toBe(3);
  node.setFlexGrow(undefined);
  node.setFlexShrink(3);
  expect(node.getFlexGrow()).toBe(0);
  expect(node.getFlexShrink()).toBe(3);
});
