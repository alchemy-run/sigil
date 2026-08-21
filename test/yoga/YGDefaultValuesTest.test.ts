// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

defineBackendTest("assert_default_values", ({ Yoga }) => {
  const root = Yoga.Node.create();

  expect(root.getChildCount()).toBe(0);
  expect(root.getChild(1)).toBeUndefined();
  expect(root.getDirection()).toBe(Yoga.DIRECTION_INHERIT);
  expect(root.getFlexDirection()).toBe(Yoga.FLEX_DIRECTION_COLUMN);
  expect(root.getJustifyContent()).toBe(Yoga.JUSTIFY_FLEX_START);
  expect(root.getAlignContent()).toBe(Yoga.ALIGN_FLEX_START);
  expect(root.getAlignItems()).toBe(Yoga.ALIGN_STRETCH);
  expect(root.getAlignSelf()).toBe(Yoga.ALIGN_AUTO);
  expect(root.getPositionType()).toBe(Yoga.POSITION_TYPE_RELATIVE);
  expect(root.getFlexWrap()).toBe(Yoga.WRAP_NO_WRAP);
  expect(root.getOverflow()).toBe(Yoga.OVERFLOW_VISIBLE);
  expect(root.getFlexGrow()).toBe(0);
  expect(root.getFlexShrink()).toBe(0);
  expect(root.getFlexBasis().unit).toBe(Yoga.UNIT_AUTO);
  expect(root.getFlexBasis().value).toBeNaN();

  const physicalAndLogicalEdges = [
    Yoga.EDGE_LEFT,
    Yoga.EDGE_TOP,
    Yoga.EDGE_RIGHT,
    Yoga.EDGE_BOTTOM,
    Yoga.EDGE_START,
    Yoga.EDGE_END,
  ];
  for (const edge of physicalAndLogicalEdges) {
    expect(root.getPosition(edge).unit).toBe(Yoga.UNIT_UNDEFINED);
    expect(root.getPosition(edge).value).toBeNaN();
    expect(root.getMargin(edge).unit).toBe(Yoga.UNIT_UNDEFINED);
    expect(root.getMargin(edge).value).toBeNaN();
    expect(root.getPadding(edge).unit).toBe(Yoga.UNIT_UNDEFINED);
    expect(root.getPadding(edge).value).toBeNaN();
    expect(root.getBorder(edge)).toBeNaN();
  }

  expect(root.getWidth().unit).toBe(Yoga.UNIT_AUTO);
  expect(root.getWidth().value).toBeNaN();
  expect(root.getHeight().unit).toBe(Yoga.UNIT_AUTO);
  expect(root.getHeight().value).toBeNaN();
  expect(root.getMinWidth().unit).toBe(Yoga.UNIT_UNDEFINED);
  expect(root.getMinWidth().value).toBeNaN();
  expect(root.getMinHeight().unit).toBe(Yoga.UNIT_UNDEFINED);
  expect(root.getMinHeight().value).toBeNaN();
  expect(root.getMaxWidth().unit).toBe(Yoga.UNIT_UNDEFINED);
  expect(root.getMaxWidth().value).toBeNaN();
  expect(root.getMaxHeight().unit).toBe(Yoga.UNIT_UNDEFINED);
  expect(root.getMaxHeight().value).toBeNaN();

  expect(root.getComputedLeft()).toBe(0);
  expect(root.getComputedTop()).toBe(0);
  expect(root.getComputedRight()).toBe(0);
  expect(root.getComputedBottom()).toBe(0);
  for (const edge of [Yoga.EDGE_LEFT, Yoga.EDGE_TOP, Yoga.EDGE_RIGHT, Yoga.EDGE_BOTTOM]) {
    expect(root.getComputedMargin(edge)).toBe(0);
    expect(root.getComputedPadding(edge)).toBe(0);
    expect(root.getComputedBorder(edge)).toBe(0);
  }
  expect(root.getComputedWidth()).toBeNaN();
  expect(root.getComputedHeight()).toBeNaN();
  // The C++ test also asserts YGNodeLayoutGetDirection(root) ==
  // YGDirectionInherit before layout, but the JS binding does not expose a
  // getComputedDirection/layout-direction getter.
  expect(root.getBoxSizing()).toBe(Yoga.BOX_SIZING_BORDER_BOX);
});

for (const reset of [false, true]) {
  defineBackendTest(
    reset ? "assert_webdefault_values_reset" : "assert_webdefault_values",
    ({ Yoga }) => {
      const config = Yoga.Config.create();
      config.setUseWebDefaults(true);
      const root = Yoga.Node.create(config);
      if (reset) {
        root.reset();
      }

      expect(root.getFlexDirection()).toBe(Yoga.FLEX_DIRECTION_ROW);
      expect(root.getAlignContent()).toBe(Yoga.ALIGN_STRETCH);
      expect(root.getFlexShrink()).toBe(1);
    },
  );
}

defineBackendTest("assert_legacy_stretch_behaviour", ({ Yoga }) => {
  const config = Yoga.Config.create();
  config.setErrata(Yoga.ERRATA_STRETCH_FLEX_BASIS);
  const root = Yoga.Node.create(config);
  root.setWidth(500);
  root.setHeight(500);

  const child = Yoga.Node.create(config);
  child.setAlignItems(Yoga.ALIGN_FLEX_START);
  root.insertChild(child, 0);

  const grandchild = Yoga.Node.create(config);
  grandchild.setFlexGrow(1);
  grandchild.setFlexShrink(1);
  child.insertChild(grandchild, 0);

  const greatGrandchild = Yoga.Node.create(config);
  greatGrandchild.setFlexGrow(1);
  greatGrandchild.setFlexShrink(1);
  grandchild.insertChild(greatGrandchild, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  expect(root.getComputedLayout()).toMatchObject({
    left: 0,
    top: 0,
    width: 500,
    height: 500,
  });
  expect(child.getComputedLayout()).toMatchObject({
    left: 0,
    top: 0,
    width: 500,
    height: 500,
  });
  expect(grandchild.getComputedLayout()).toMatchObject({
    left: 0,
    top: 0,
    width: 0,
    height: 500,
  });
  expect(greatGrandchild.getComputedLayout()).toMatchObject({
    left: 0,
    top: 0,
    width: 0,
    height: 500,
  });
});

defineBackendTest("assert_box_sizing_border_box", ({ Yoga }) => {
  expect(Yoga.Node.create().getBoxSizing()).toBe(Yoga.BOX_SIZING_BORDER_BOX);
});
