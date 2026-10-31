// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

// Regression tests for flex shrink after the first pass freezes items:
// https://github.com/react/yoga/issues/2038 and #1651.

import { expect } from "vite-plus/test";

import type { Config, Node, Yoga } from "#/yoga/index.ts";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

const kWithoutErrata = [false, true];

function newConfig(Yoga: Yoga, withoutErrata: boolean): Config {
  const config = Yoga.Config.create();
  if (withoutErrata) {
    config.setErrata(Yoga.ERRATA_NONE);
  }
  return config;
}

// root (350 x 350) > row > [box, sibling (600 x 23)]. The box is the only
// shrinkable item, and its basis comes from its aspectRatio and the stretched
// height: 23 * 22/24 = 21.083334.
function newAspectRatioRow(
  Yoga: Yoga,
  config: Config,
  shrink: number,
): { root: Node; box: Node; sibling: Node } {
  const root = Yoga.Node.create(config);
  root.setWidth(350);
  root.setHeight(350);

  const row = Yoga.Node.create(config);
  row.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.insertChild(row, 0);

  const box = Yoga.Node.create(config);
  box.setAspectRatio(22 / 24);
  box.setFlexShrink(shrink);
  row.insertChild(box, 0);

  const sibling = Yoga.Node.create(config);
  sibling.setWidth(600);
  sibling.setHeight(23);
  row.insertChild(sibling, 1);

  return { root, box, sibling };
}

// https://github.com/react/yoga/issues/2038
// All items freeze at their minWidth. Removing them from the float total left a
// residual instead of 0.
defineBackendTest("all_items_frozen_at_min_width", ({ Yoga }) => {
  for (const withoutErrata of kWithoutErrata) {
    const config = newConfig(Yoga, withoutErrata);
    const root = Yoga.Node.create(config);
    root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
    root.setWidth(350);
    root.setHeight(50);

    const widths = [100.1, 200.3, 300.7];
    const minWidths = [90, 190, 290];
    for (let i = 0; i < 3; i++) {
      const child = Yoga.Node.create(config);
      child.setWidth(widths[i]);
      child.setMinWidth(minWidths[i]);
      child.setFlexShrink(1);
      root.insertChild(child, i);
    }

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

    for (let i = 0; i < 3; i++) {
      expect(
        root.getChild(i).getComputedWidth(),
        `withoutErrata ${withoutErrata}, child[${i}]`,
      ).toBe(minWidths[i]);
    }
  }
});

// https://github.com/react/yoga/issues/2038
// The box freezes at 0, and freezing it left a 2^-19 residual. Shrink factors
// from #2039.
defineBackendTest("aspect_ratio_sole_shrinkable_item", ({ Yoga }) => {
  const shrinkFactors = [1, 2, 3, 6, 9, 11, 12, 19, 22, 999];

  for (const withoutErrata of kWithoutErrata) {
    for (const shrink of shrinkFactors) {
      const config = newConfig(Yoga, withoutErrata);
      const { root, box, sibling } = newAspectRatioRow(Yoga, config, shrink);

      root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

      const message = `withoutErrata ${withoutErrata}, flexShrink ${shrink}`;
      expect(box.getComputedWidth(), message).toBe(0);
      expect(box.getComputedHeight(), message).toBe(0);
      expect(sibling.getComputedLeft(), message).toBe(0);
    }
  }
});

// https://github.com/react/yoga/issues/2038
// With flexShrink 0 the box keeps its aspectRatio basis (21.08 x 23, rounded to
// 21 x 23). From #2039.
defineBackendTest("unshrinkable_item_keeps_aspect_ratio_basis", ({ Yoga }) => {
  for (const withoutErrata of kWithoutErrata) {
    const config = newConfig(Yoga, withoutErrata);
    const { root, box, sibling } = newAspectRatioRow(Yoga, config, 0);

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

    const message = `withoutErrata ${withoutErrata}`;
    expect(box.getComputedWidth(), message).toBe(21);
    expect(box.getComputedHeight(), message).toBe(23);
    expect(sibling.getComputedLeft(), message).toBe(21);
  }
});

// https://github.com/react/yoga/issues/2038
// The residual grows with the size of the total: here it is about 0.0078, far
// above any fixed near-zero threshold, but it is still positive. Pixel rounding
// is off so that each item can be compared with its exact minWidth.
defineBackendTest("large_total_residual_is_not_divided_by", ({ Yoga }) => {
  for (const withoutErrata of kWithoutErrata) {
    const config = newConfig(Yoga, withoutErrata);
    config.setPointScaleFactor(0);
    const root = Yoga.Node.create(config);
    root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
    root.setWidth(1000);
    root.setHeight(50);

    const widths = [10000.1, 30000.7, 34567.8];
    for (const [i, width] of widths.entries()) {
      const child = Yoga.Node.create(config);
      child.setWidth(width);
      child.setMinWidth(width - 50);
      child.setFlexShrink(1);
      root.insertChild(child, i);
    }

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

    for (const [i, width] of widths.entries()) {
      expect(
        root.getChild(i).getComputedWidth(),
        `withoutErrata ${withoutErrata}, child[${i}]`,
      ).toBe(width - 50);
    }
  }
});

// https://github.com/react/yoga/issues/2038
// A tiny item stays unfrozen while the others freeze. Its factor (-1e-5) is
// below the float precision of the total, so the total after removing the
// frozen items was a positive residual instead of the tiny item's factor.
defineBackendTest("tiny_item_remains_after_others_freeze", ({ Yoga }) => {
  for (const withoutErrata of kWithoutErrata) {
    const config = newConfig(Yoga, withoutErrata);
    const root = Yoga.Node.create(config);
    root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
    root.setWidth(350);
    root.setHeight(50);

    const widths = [100.1, 200.3, 300.7, 0.00001];
    const minWidths = [90, 190, 290, 0];
    for (let i = 0; i < 4; i++) {
      const child = Yoga.Node.create(config);
      child.setWidth(widths[i]);
      child.setMinWidth(minWidths[i]);
      child.setFlexShrink(1);
      root.insertChild(child, i);
    }

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

    for (let i = 0; i < 4; i++) {
      expect(
        root.getChild(i).getComputedWidth(),
        `withoutErrata ${withoutErrata}, child[${i}]`,
      ).toBe(minWidths[i]);
    }
  }
});

// https://github.com/react/yoga/issues/1651
// Measured items freeze at their lower bound, which is 0 with the default
// errata and the content height without (automatic minimum size). The residual
// made them millions of points tall.
defineBackendTest("issue_1651_measured_items_freeze_at_lower_bound", ({ Yoga }) => {
  for (const withoutErrata of kWithoutErrata) {
    const config = newConfig(Yoga, withoutErrata);
    config.setUseWebDefaults(true);
    config.setPointScaleFactor(100);
    const root = Yoga.Node.create(config);
    root.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
    root.setHeight(99);

    const heights = [10.01, 10.01, 12.01];
    for (const [i, height] of heights.entries()) {
      const child = Yoga.Node.create(config);
      child.setMeasureFunc(() => ({ width: 1, height }));
      root.insertChild(child, i);
    }
    root.getChild(0).setMargin(Yoga.EDGE_BOTTOM, 100);

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

    let top = 0;
    for (const [i, measuredHeight] of heights.entries()) {
      const child = root.getChild(i);
      const height = withoutErrata ? measuredHeight : 0;
      const message = `withoutErrata ${withoutErrata}, child[${i}]`;
      expect(child.getComputedHeight(), message).toBeCloseTo(height, 5);
      expect(child.getComputedTop(), message).toBeCloseTo(top, 5);
      top += height + (i === 0 ? 100 : 0);
    }
  }
});
