// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

defineBackendTest("start_overrides", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(100);
  root.setHeight(100);
  const child = Yoga.Node.create();
  child.setFlexGrow(1);
  child.setMargin(Yoga.EDGE_START, 10);
  child.setMargin(Yoga.EDGE_LEFT, 20);
  child.setMargin(Yoga.EDGE_RIGHT, 20);
  root.insertChild(child, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child.getComputedLeft()).toBe(10);
  expect(child.getComputedRight()).toBe(20);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_RTL);
  expect(child.getComputedLeft()).toBe(20);
  expect(child.getComputedRight()).toBe(10);
});

defineBackendTest("end_overrides", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(100);
  root.setHeight(100);
  const child = Yoga.Node.create();
  child.setFlexGrow(1);
  child.setMargin(Yoga.EDGE_END, 10);
  child.setMargin(Yoga.EDGE_LEFT, 20);
  child.setMargin(Yoga.EDGE_RIGHT, 20);
  root.insertChild(child, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child.getComputedLeft()).toBe(20);
  expect(child.getComputedRight()).toBe(10);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_RTL);
  expect(child.getComputedLeft()).toBe(10);
  expect(child.getComputedRight()).toBe(20);
});

defineBackendTest("horizontal_overridden", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(100);
  root.setHeight(100);
  const child = Yoga.Node.create();
  child.setFlexGrow(1);
  child.setMargin(Yoga.EDGE_HORIZONTAL, 10);
  child.setMargin(Yoga.EDGE_LEFT, 20);
  root.insertChild(child, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child.getComputedLeft()).toBe(20);
  expect(child.getComputedRight()).toBe(10);
});

defineBackendTest("vertical_overridden", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);
  const child = Yoga.Node.create();
  child.setFlexGrow(1);
  child.setMargin(Yoga.EDGE_VERTICAL, 10);
  child.setMargin(Yoga.EDGE_TOP, 20);
  root.insertChild(child, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child.getComputedTop()).toBe(20);
  expect(child.getComputedBottom()).toBe(10);
});

defineBackendTest("horizontal_overrides_all", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);
  const child = Yoga.Node.create();
  child.setFlexGrow(1);
  child.setMargin(Yoga.EDGE_HORIZONTAL, 10);
  child.setMargin(Yoga.EDGE_ALL, 20);
  root.insertChild(child, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child.getComputedLayout()).toMatchObject({
    left: 10,
    top: 20,
    right: 10,
    bottom: 20,
  });
});

defineBackendTest("vertical_overrides_all", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);
  const child = Yoga.Node.create();
  child.setFlexGrow(1);
  child.setMargin(Yoga.EDGE_VERTICAL, 10);
  child.setMargin(Yoga.EDGE_ALL, 20);
  root.insertChild(child, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child.getComputedLayout()).toMatchObject({
    left: 20,
    top: 10,
    right: 20,
    bottom: 10,
  });
});

defineBackendTest("all_overridden", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);
  const child = Yoga.Node.create();
  child.setFlexGrow(1);
  for (const edge of [Yoga.EDGE_LEFT, Yoga.EDGE_TOP, Yoga.EDGE_RIGHT, Yoga.EDGE_BOTTOM]) {
    child.setMargin(edge, 10);
  }
  child.setMargin(Yoga.EDGE_ALL, 20);
  root.insertChild(child, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child.getComputedLayout()).toMatchObject({
    left: 10,
    top: 10,
    right: 10,
    bottom: 10,
  });
});
