// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

defineBackendTest("gap_negative_value", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setGap(Yoga.GUTTER_ALL, -20);
  root.setHeight(200);
  const children = Array.from({ length: 4 }, (_, index) => {
    const child = Yoga.Node.create();
    child.setWidth(20);
    root.insertChild(child, index);
    return child;
  });

  for (const direction of [Yoga.DIRECTION_LTR, Yoga.DIRECTION_RTL]) {
    root.calculateLayout(undefined, undefined, direction);
    expect(root.getComputedLayout()).toMatchObject({
      left: 0,
      top: 0,
      width: 80,
      height: 200,
    });
    for (const [index, child] of children.entries()) {
      expect(child.getComputedLayout()).toMatchObject({
        left: (direction === Yoga.DIRECTION_LTR ? index : 3 - index) * 20,
        top: 0,
        width: 20,
        height: 200,
      });
    }
  }
});
