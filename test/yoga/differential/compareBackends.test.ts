// SPDX-License-Identifier: MIT

import { test } from "vite-plus/test";

import { compareBackends, layoutScenario } from "./compareBackends.ts";

test("nested row layout matches the pinned Yoga implementation", () => {
  compareBackends(
    layoutScenario((Yoga) => {
      const root = Yoga.Node.create();
      root.setWidth(320);
      root.setHeight(120);
      root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
      root.setJustifyContent(Yoga.JUSTIFY_SPACE_BETWEEN);
      root.setAlignItems(Yoga.ALIGN_CENTER);

      for (const width of [30, 50, 70]) {
        const child = Yoga.Node.create();
        child.setWidth(width);
        child.setHeight(20);
        root.insertChild(child, root.getChildCount());
      }
      return root;
    }),
  );
});

test("wrapping, gaps, and percentages match the pinned Yoga implementation", () => {
  compareBackends(
    layoutScenario((Yoga) => {
      const root = Yoga.Node.create();
      root.setWidth(180);
      root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
      root.setFlexWrap(Yoga.WRAP_WRAP);
      root.setGap(Yoga.GUTTER_ALL, 7);

      for (let index = 0; index < 5; index++) {
        const child = Yoga.Node.create();
        child.setWidthPercent(31);
        child.setHeight(15 + index);
        root.insertChild(child, index);
      }
      return root;
    }),
  );
});

test("absolute positioning matches the pinned Yoga implementation", () => {
  compareBackends(
    layoutScenario((Yoga) => {
      const root = Yoga.Node.create();
      root.setWidth(200);
      root.setHeight(100);

      const child = Yoga.Node.create();
      child.setPositionType(Yoga.POSITION_TYPE_ABSOLUTE);
      child.setPosition(Yoga.EDGE_LEFT, 12);
      child.setPosition(Yoga.EDGE_RIGHT, 18);
      child.setPosition(Yoga.EDGE_TOP, 9);
      child.setHeight(24);
      root.insertChild(child, 0);
      return root;
    }),
  );
});

test("measured content matches the pinned Yoga implementation", () => {
  compareBackends(
    layoutScenario((Yoga) => {
      const root = Yoga.Node.create();
      root.setWidth(90);
      root.setPadding(Yoga.EDGE_ALL, 5);

      const child = Yoga.Node.create();
      child.setMeasureFunc(() => ({ width: 140, height: 17 }));
      root.insertChild(child, 0);
      return root;
    }),
  );
});
