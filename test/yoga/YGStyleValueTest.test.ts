// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

defineBackendTest("computed_padding_is_floored", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);
  root.setPadding(Yoga.EDGE_ALL, -1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root.getComputedPadding(Yoga.EDGE_LEFT)).toBe(0);
});

defineBackendTest("computed_border_is_floored", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);
  root.setBorder(Yoga.EDGE_ALL, -1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root.getComputedBorder(Yoga.EDGE_LEFT)).toBe(0);
});

defineBackendTest("computed_margin_is_not_floored", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(100);
  root.setHeight(100);
  root.setMargin(Yoga.EDGE_ALL, -1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root.getComputedMargin(Yoga.EDGE_LEFT)).toBe(-1);
});
