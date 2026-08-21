// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

defineBackendTest("zero_out_layout", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(200);
  root.setHeight(200);
  const child = Yoga.Node.create();
  child.setWidth(100);
  child.setHeight(100);
  child.setMargin(Yoga.EDGE_TOP, 10);
  child.setPadding(Yoga.EDGE_TOP, 10);
  root.insertChild(child, 0);
  root.calculateLayout(100, 100, Yoga.DIRECTION_LTR);
  expect(child.getComputedMargin(Yoga.EDGE_TOP)).toBe(10);
  expect(child.getComputedPadding(Yoga.EDGE_TOP)).toBe(10);
  child.setDisplay(Yoga.DISPLAY_NONE);
  root.calculateLayout(100, 100, Yoga.DIRECTION_LTR);
  expect(child.getComputedMargin(Yoga.EDGE_TOP)).toBe(0);
  expect(child.getComputedPadding(Yoga.EDGE_TOP)).toBe(0);
});
