// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import type { Node } from "../../src/yoga/index.ts";
import { defineBackendTest } from "./backends/defineBackendTest.ts";
import { getMeasureCounter } from "./tools/MeasureCounter.ts";

const measureTen = () => ({ width: 10, height: 10 });

function wrappingMeasure(width: number, widthMode: number): { width: number; height: number } {
  return widthMode === 0 || width >= 68 ? { width: 68, height: 16 } : { width: 50, height: 32 };
}

defineBackendTest("measure_absolute_child_with_no_constraints", ({ Yoga }) => {
  const root = Yoga.Node.create();
  const child = Yoga.Node.create();
  root.insertChild(child, 0);
  const measured = getMeasureCounter(measureTen);
  const absolute = Yoga.Node.create();
  absolute.setPositionType(Yoga.POSITION_TYPE_ABSOLUTE);
  absolute.setMeasureFunc(measured.inc);
  child.insertChild(absolute, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(measured.get()).toBe(1);
});

for (const testCase of [
  {
    name: "dont_measure_when_min_equals_max",
    setWidth(node: Node) {
      node.setMinWidth(10);
      node.setMaxWidth(10);
    },
    setHeight(node: Node) {
      node.setMinHeight(10);
      node.setMaxHeight(10);
    },
  },
  {
    name: "dont_measure_when_min_equals_max_percentages",
    setWidth(node: Node) {
      node.setMinWidthPercent(10);
      node.setMaxWidthPercent(10);
    },
    setHeight(node: Node) {
      node.setMinHeightPercent(10);
      node.setMaxHeightPercent(10);
    },
  },
  {
    name: "dont_measure_when_min_equals_max_mixed_width_percent",
    setWidth(node: Node) {
      node.setMinWidthPercent(10);
      node.setMaxWidthPercent(10);
    },
    setHeight(node: Node) {
      node.setMinHeight(10);
      node.setMaxHeight(10);
    },
  },
  {
    name: "dont_measure_when_min_equals_max_mixed_height_percent",
    setWidth(node: Node) {
      node.setMinWidth(10);
      node.setMaxWidth(10);
    },
    setHeight(node: Node) {
      node.setMinHeightPercent(10);
      node.setMaxHeightPercent(10);
    },
  },
]) {
  defineBackendTest(testCase.name, ({ Yoga }) => {
    const root = Yoga.Node.create();
    root.setAlignItems(Yoga.ALIGN_FLEX_START);
    root.setWidth(100);
    root.setHeight(100);
    const measured = getMeasureCounter(measureTen);
    const child = Yoga.Node.create();
    child.setMeasureFunc(measured.inc);
    testCase.setWidth(child);
    testCase.setHeight(child);
    root.insertChild(child, 0);
    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
    expect(measured.get()).toBe(0);
    expect(child.getComputedLayout()).toMatchObject({
      left: 0,
      top: 0,
      width: 10,
      height: 10,
    });
  });
}

defineBackendTest("measure_nodes_with_margin_auto_and_stretch", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setWidth(500);
  root.setHeight(500);
  const child = Yoga.Node.create();
  child.setMeasureFunc(measureTen);
  child.setMarginAuto(Yoga.EDGE_LEFT);
  root.insertChild(child, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(child.getComputedLayout()).toMatchObject({
    left: 490,
    top: 0,
    width: 10,
    height: 10,
  });
});

for (const [name, width, expected] of [
  ["measure_enough_size_should_be_in_single_line", 100, [68, 16]],
  ["measure_not_enough_size_should_wrap", 55, [50, 32]],
] as const) {
  defineBackendTest(name, ({ Yoga }) => {
    const root = Yoga.Node.create();
    root.setWidth(width);
    const child = Yoga.Node.create();
    child.setAlignSelf(Yoga.ALIGN_FLEX_START);
    child.setMeasureFunc(wrappingMeasure);
    root.insertChild(child, 0);
    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
    expect(child.getComputedWidth()).toBe(expected[0]);
    expect(child.getComputedHeight()).toBe(expected[1]);
  });
}

defineBackendTest("measure_zero_space_should_grow", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setHeight(200);
  root.setFlexGrow(0);
  const child = Yoga.Node.create();
  child.setPadding(Yoga.EDGE_ALL, 100);
  child.setMeasureFunc(measureTen);
  root.insertChild(child, 0);
  root.calculateLayout(282, undefined, Yoga.DIRECTION_LTR);
  expect(child.getComputedWidth()).toBe(282);
  expect(child.getComputedTop()).toBe(0);
});

defineBackendTest("measure_flex_direction_row_and_padding", ({ Yoga }) => {
  const config = Yoga.Config.create();
  const root = Yoga.Node.create(config);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setPadding(Yoga.EDGE_ALL, 25);
  root.setWidth(50);
  root.setHeight(50);
  const measured = Yoga.Node.create(config);
  measured.setMeasureFunc(wrappingMeasure);
  root.insertChild(measured, 0);
  const fixed = Yoga.Node.create(config);
  fixed.setWidth(5);
  fixed.setHeight(5);
  root.insertChild(fixed, 1);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(root.getComputedLayout()).toMatchObject({
    left: 0,
    top: 0,
    width: 50,
    height: 50,
  });
  expect(measured.getComputedLayout()).toMatchObject({
    left: 25,
    top: 25,
    width: 50,
    height: 0,
  });
  expect(fixed.getComputedLayout()).toMatchObject({
    left: 75,
    top: 25,
    width: 5,
    height: 5,
  });
});

defineBackendTest("measure_flex_direction_column_and_padding", ({ Yoga }) => {
  const config = Yoga.Config.create();
  const root = Yoga.Node.create(config);
  root.setMargin(Yoga.EDGE_TOP, 20);
  root.setPadding(Yoga.EDGE_ALL, 25);
  root.setWidth(50);
  root.setHeight(50);
  const measured = Yoga.Node.create(config);
  measured.setMeasureFunc(wrappingMeasure);
  root.insertChild(measured, 0);
  const fixed = Yoga.Node.create(config);
  fixed.setWidth(5);
  fixed.setHeight(5);
  root.insertChild(fixed, 1);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(root.getComputedLayout()).toMatchObject({
    left: 0,
    top: 20,
    width: 50,
    height: 50,
  });
  expect(measured.getComputedLayout()).toMatchObject({
    left: 25,
    top: 25,
    width: 0,
    height: 32,
  });
  expect(fixed.getComputedLayout()).toMatchObject({
    left: 25,
    top: 57,
    width: 5,
    height: 5,
  });
});

for (const alignFlexStart of [false, true]) {
  defineBackendTest(
    alignFlexStart
      ? "measure_flex_direction_row_no_padding_align_items_flexstart"
      : "measure_flex_direction_row_no_padding",
    ({ Yoga }) => {
      const config = Yoga.Config.create();
      const root = Yoga.Node.create(config);
      root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
      root.setMargin(Yoga.EDGE_TOP, 20);
      root.setWidth(50);
      root.setHeight(50);
      if (alignFlexStart) {
        root.setAlignItems(Yoga.ALIGN_FLEX_START);
      }
      const measured = Yoga.Node.create(config);
      measured.setMeasureFunc(wrappingMeasure);
      root.insertChild(measured, 0);
      const fixed = Yoga.Node.create(config);
      fixed.setWidth(5);
      fixed.setHeight(5);
      root.insertChild(fixed, 1);
      root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
      expect(measured.getComputedLayout()).toMatchObject({
        left: 0,
        top: 0,
        width: 50,
        height: alignFlexStart ? 32 : 50,
      });
      expect(fixed.getComputedLayout()).toMatchObject({
        left: 50,
        top: 0,
        width: 5,
        height: 5,
      });
    },
  );
}

for (const variant of ["fixed", "shrink"] as const) {
  defineBackendTest(
    variant === "fixed" ? "measure_with_fixed_size" : "measure_with_flex_shrink",
    ({ Yoga }) => {
      const config = Yoga.Config.create();
      const root = Yoga.Node.create(config);
      root.setMargin(Yoga.EDGE_TOP, 20);
      root.setPadding(Yoga.EDGE_ALL, 25);
      root.setWidth(50);
      root.setHeight(50);
      const measured = Yoga.Node.create(config);
      measured.setMeasureFunc(wrappingMeasure);
      if (variant === "fixed") {
        measured.setWidth(10);
        measured.setHeight(10);
      } else {
        measured.setFlexShrink(1);
      }
      root.insertChild(measured, 0);
      const fixed = Yoga.Node.create(config);
      fixed.setWidth(5);
      fixed.setHeight(5);
      root.insertChild(fixed, 1);
      root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
      const measuredSize = variant === "fixed" ? 10 : 0;
      expect(measured.getComputedLayout()).toMatchObject({
        left: 25,
        top: 25,
        width: measuredSize,
        height: measuredSize,
      });
      expect(fixed.getComputedLayout()).toMatchObject({
        left: 25,
        top: variant === "fixed" ? 35 : 25,
        width: 5,
        height: 5,
      });
    },
  );
}

defineBackendTest("measure_no_padding", ({ Yoga }) => {
  const config = Yoga.Config.create();
  const root = Yoga.Node.create(config);
  root.setMargin(Yoga.EDGE_TOP, 20);
  root.setWidth(50);
  root.setHeight(50);
  const measured = Yoga.Node.create(config);
  measured.setMeasureFunc(wrappingMeasure);
  measured.setFlexShrink(1);
  root.insertChild(measured, 0);
  const fixed = Yoga.Node.create(config);
  fixed.setWidth(5);
  fixed.setHeight(5);
  root.insertChild(fixed, 1);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(measured.getComputedLayout()).toMatchObject({
    left: 0,
    top: 0,
    width: 50,
    height: 32,
  });
  expect(fixed.getComputedLayout()).toMatchObject({
    left: 0,
    top: 32,
    width: 5,
    height: 5,
  });
});

for (const horizontal of [false, true]) {
  defineBackendTest(
    horizontal ? "cant_call_negative_measure_horizontal" : "cant_call_negative_measure",
    ({ Yoga }) => {
      const config = Yoga.Config.create();
      const root = Yoga.Node.create(config);
      root.setFlexDirection(horizontal ? Yoga.FLEX_DIRECTION_ROW : Yoga.FLEX_DIRECTION_COLUMN);
      root.setWidth(horizontal ? 10 : 50);
      root.setHeight(horizontal ? 20 : 10);
      const child = Yoga.Node.create(config);
      child.setMeasureFunc((width, _widthMode, height) => {
        expect(width).toBeGreaterThanOrEqual(0);
        expect(height).toBeGreaterThanOrEqual(0);
        return { width: 0, height: 0 };
      });
      child.setMargin(horizontal ? Yoga.EDGE_START : Yoga.EDGE_TOP, 20);
      root.insertChild(child, 0);
      root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
    },
  );
}

for (const contentBox of [true, false]) {
  defineBackendTest(contentBox ? "measure_content_box" : "measure_border_box", ({ Yoga }) => {
    const root = Yoga.Node.create();
    root.setWidth(100);
    root.setHeight(200);
    root.setBoxSizing(contentBox ? Yoga.BOX_SIZING_CONTENT_BOX : Yoga.BOX_SIZING_BORDER_BOX);
    root.setPadding(Yoga.EDGE_ALL, 5);
    root.setBorder(Yoga.EDGE_ALL, 10);
    const measured = getMeasureCounter((width, _widthMode, height) => ({
      width: 0.5 * width,
      height: 0.5 * height,
    }));
    const child = Yoga.Node.create();
    child.setMeasureFunc(measured.inc);
    root.insertChild(child, 0);
    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
    expect(measured.get()).toBe(1);
    expect(root.getComputedLayout()).toMatchObject({
      left: 0,
      top: 0,
      width: contentBox ? 130 : 100,
      height: contentBox ? 230 : 200,
    });
    expect(child.getComputedLayout()).toMatchObject({
      left: 15,
      top: 15,
      width: contentBox ? 100 : 70,
      height: contentBox ? 100 : 85,
    });
  });
}

defineBackendTest("min_width_larger_than_width_propagates_to_auto_parent", ({ Yoga }) => {
  const root = Yoga.Node.create();
  const child = Yoga.Node.create();
  child.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  child.setHeight(50);
  root.insertChild(child, 0);
  const grandchild = Yoga.Node.create();
  grandchild.setWidth(50);
  grandchild.setMinWidth(100);
  grandchild.setHeight(50);
  child.insertChild(grandchild, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  for (const node of [root, child, grandchild]) {
    expect(node.getComputedLayout()).toMatchObject({
      left: 0,
      top: 0,
      width: 100,
      height: 50,
    });
  }
});

defineBackendTest("percent_with_text_node", ({ Yoga }) => {
  const config = Yoga.Config.create();
  const root = Yoga.Node.create(config);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setJustifyContent(Yoga.JUSTIFY_SPACE_BETWEEN);
  root.setAlignItems(Yoga.ALIGN_CENTER);
  root.setWidth(100);
  root.setHeight(80);
  const empty = Yoga.Node.create(config);
  root.insertChild(empty, 0);
  const measured = Yoga.Node.create(config);
  measured.setMeasureFunc(() => ({ width: 90, height: 10 }));
  measured.setMaxWidthPercent(50);
  measured.setPaddingPercent(Yoga.EDGE_TOP, 50);
  root.insertChild(measured, 1);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(root.getComputedLayout()).toMatchObject({
    left: 0,
    top: 0,
    width: 100,
    height: 80,
  });
  expect(empty.getComputedLayout()).toMatchObject({
    left: 0,
    top: 40,
    width: 0,
    height: 0,
  });
  expect(measured.getComputedLayout()).toMatchObject({
    left: 50,
    top: 10,
    width: 50,
    height: 60,
  });
});

defineBackendTest("percent_margin_with_measure_func", ({ Yoga }) => {
  const config = Yoga.Config.create();
  const root = Yoga.Node.create(config);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(500);
  root.setHeight(500);
  const children = [0, 100, "10%", "20%"].map((margin, index) => {
    const child = Yoga.Node.create(config);
    child.setWidth(100);
    child.setHeight(100);
    child.setMargin(Yoga.EDGE_TOP, margin as number | `${number}%`);
    child.setMeasureFunc(() => ({ width: 100, height: 100 }));
    root.insertChild(child, index);
    return child;
  });
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  expect(root.getComputedLayout()).toMatchObject({
    left: 0,
    top: 0,
    width: 500,
    height: 500,
  });
  for (const [index, child] of children.entries()) {
    expect(child.getComputedLayout()).toMatchObject({
      left: index * 100,
      top: [0, 100, 50, 100][index],
      width: 100,
      height: 100,
    });
  }
});

for (const includeMargin of [false, true]) {
  defineBackendTest(
    includeMargin
      ? "percent_padding_and_percent_margin_with_measure_func"
      : "percent_padding_with_measure_func",
    ({ Yoga }) => {
      const config = Yoga.Config.create();
      const root = Yoga.Node.create(config);
      root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
      root.setAlignItems(Yoga.ALIGN_FLEX_START);
      root.setAlignContent(Yoga.ALIGN_FLEX_START);
      root.setWidth(500);
      root.setHeight(500);
      const children = [0, 100, "10%", "20%"].map((padding, index) => {
        const child = Yoga.Node.create(config);
        if (index < 2) {
          child.setWidth(100);
          child.setHeight(100);
        }
        child.setPadding(Yoga.EDGE_TOP, padding as number | `${number}%`);
        if (includeMargin && index >= 2) {
          child.setMargin(Yoga.EDGE_TOP, padding as `${number}%`);
        }
        child.setMeasureFunc(() => ({ width: 100, height: 100 }));
        root.insertChild(child, index);
        return child;
      });
      root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
      expect(root.getComputedLayout()).toMatchObject({
        left: 0,
        top: 0,
        width: 500,
        height: 500,
      });
      for (const [index, child] of children.entries()) {
        expect(child.getComputedLayout()).toMatchObject({
          left: index * 100,
          top: includeMargin && index >= 2 ? [0, 0, 50, 100][index] : 0,
          width: 100,
          height: [100, 100, 150, 200][index],
        });
      }
    },
  );
}

defineBackendTest("cannot_add_child_to_node_with_measure_func", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.setMeasureFunc(measureTen);
  expect(() => root.insertChild(Yoga.Node.create(), 0)).toThrow();
});

defineBackendTest("cannot_add_nonnull_measure_func_to_non_leaf_node", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.insertChild(Yoga.Node.create(), 0);
  expect(() => root.setMeasureFunc(measureTen)).toThrow();
});

defineBackendTest("can_nullify_measure_func_on_any_node", ({ Yoga }) => {
  const root = Yoga.Node.create();
  root.insertChild(Yoga.Node.create(), 0);
  expect(() => root.setMeasureFunc(null)).not.toThrow();
});
