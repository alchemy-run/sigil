// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { Direction, FlexDirection, Wrap } from "#/yoga/generated/YGEnums.ts";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

defineBackendTest("spacing_overflow_no_wrap_and_no_flex_children", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(200);
  root.setHeight(100);
  const first = Yoga.Node.create();
  first.setWidth(80);
  first.setHeight(40);
  first.setMargin(Yoga.EDGE_TOP, 10);
  first.setMargin(Yoga.EDGE_BOTTOM, 10);
  root.insertChild(first, 0);
  const second = Yoga.Node.create();
  second.setWidth(80);
  second.setHeight(40);
  second.setMargin(Yoga.EDGE_BOTTOM, 5);
  root.insertChild(second, 1);
  root.calculateLayout(200, 100, Direction.LTR);
  expect(root.getComputedHadOverflow()).toBe(true);
});

defineBackendTest("hadOverflow_gets_reset_if_not_logger_valid", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(200);
  root.setHeight(100);
  root.setFlexDirection(FlexDirection.Column);
  root.setFlexWrap(Wrap.NoWrap);

  const child0 = Yoga.Node.create();
  child0.setWidth(80);
  child0.setHeight(40);
  child0.setMargin(Yoga.EDGE_TOP, 10);
  child0.setMargin(Yoga.EDGE_BOTTOM, 10);
  root.insertChild(child0, 0);

  const child1 = Yoga.Node.create();
  child1.setWidth(80);
  child1.setHeight(40);
  child1.setMargin(Yoga.EDGE_BOTTOM, 5);
  root.insertChild(child1, 1);

  root.calculateLayout(200, 100, Direction.LTR);
  expect(root.getComputedHadOverflow()).toBe(true);

  child1.setFlexShrink(1);
  root.calculateLayout(200, 100, Direction.LTR);
  expect(root.getComputedHadOverflow()).toBe(false);
});

defineBackendTest("spacing_overflow_in_nested_nodes", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(200);
  root.setHeight(100);
  const first = Yoga.Node.create();
  first.setWidth(80);
  first.setHeight(40);
  first.setMargin(Yoga.EDGE_TOP, 10);
  first.setMargin(Yoga.EDGE_BOTTOM, 10);
  root.insertChild(first, 0);
  const second = Yoga.Node.create();
  second.setWidth(80);
  second.setHeight(40);
  root.insertChild(second, 1);
  const nested = Yoga.Node.create();
  nested.setWidth(80);
  nested.setHeight(40);
  nested.setMargin(Yoga.EDGE_BOTTOM, 5);
  second.insertChild(nested, 0);
  root.calculateLayout(200, 100, Direction.LTR);
  expect(root.getComputedHadOverflow()).toBe(true);
});
