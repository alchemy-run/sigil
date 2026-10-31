// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

// Regression test for https://github.com/react/yoga/issues/2006
// A row of three growable children (flexGrow/flexShrink 1, maxWidth 180) inside
// a 540px container. When the *first* child has a larger minWidth than the
// rest, the first free-space pass used to freeze every item at its max while
// also draining the remaining free space to exactly zero, leaving the second
// pass with nothing to distribute. The children then collapsed to their
// minWidths (60/30/30) instead of growing to fill the row (180/180/180).
//
// The fix is gated on clearing ERRATA_FLEX_FIRST_PASS_USES_RUNNING_TOTALS,
// which new configs set by default, so both behaviors are pinned here.

import { expect } from "vite-plus/test";

import type { Config, Yoga } from "#/yoga/index.ts";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

// A config opted into the spec-correct single distribution.
function makeFixedConfig(Yoga: Yoga): Config {
  const config = Yoga.Config.create();
  const errata = config.getErrata();
  config.setErrata(errata & (Yoga.ERRATA_ALL ^ Yoga.ERRATA_FLEX_FIRST_PASS_USES_RUNNING_TOTALS));
  return config;
}

// Lay out a 540px row containing three children, each with flexGrow/
// flexShrink of 1, maxWidth of 180 and the given minWidths, and return the
// resolved width of each child.
function layoutRow(Yoga: Yoga, config: Config, minWidths: readonly number[]): number[] {
  const root = Yoga.Node.create(config);
  root.setWidth(540);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);

  for (const [i, minWidth] of minWidths.entries()) {
    const child = Yoga.Node.create(config);
    child.setFlexGrow(1);
    child.setFlexShrink(1);
    child.setMaxWidth(180);
    child.setHeight(30);
    child.setMinWidth(minWidth);
    root.insertChild(child, i);
  }

  root.calculateLayout(540, 30, Yoga.DIRECTION_LTR);

  return minWidths.map((_, i) => root.getChild(i).getComputedWidth());
}

// Assert every child grows to maxWidth (the row exactly fills the container).
function expectAllGrowToMax(Yoga: Yoga, minWidths: readonly number[]): void {
  const widths = layoutRow(Yoga, makeFixedConfig(Yoga), minWidths);

  for (const [i, width] of widths.entries()) {
    expect(
      Math.abs(width - 180),
      `child[${i}] should grow to maxWidth, not collapse to its minWidth`,
    ).toBeLessThanOrEqual(1e-3);
  }
}

defineBackendTest("first_child_larger_minwidth_row", ({ Yoga }) => {
  // The originally reported case: the first child has a larger minWidth than
  // the other two, which used to break the whole row.
  expectAllGrowToMax(Yoga, [60, 30, 30]);
});

defineBackendTest("other_positions_still_work", ({ Yoga }) => {
  // Sanity: placing the outlier minWidth on the second or third child already
  // worked and must keep working.
  expectAllGrowToMax(Yoga, [30, 60, 30]);
  expectAllGrowToMax(Yoga, [30, 30, 60]);
});

defineBackendTest("uniform_minwidth_row", ({ Yoga }) => {
  // All children share the same minWidth: no issue either way.
  expectAllGrowToMax(Yoga, [30, 30, 30]);
});

defineBackendTest("errata_preserves_prefix_geometry_by_default", ({ Yoga }) => {
  // A default config keeps the pre-fix collapse, so existing layouts do not
  // shift when this change lands. Removing the errata bit from the defaults is
  // what makes this test fail.
  const config = Yoga.Config.create();
  expect(config.getErrata() & Yoga.ERRATA_FLEX_FIRST_PASS_USES_RUNNING_TOTALS).not.toBe(0);

  const widths = layoutRow(Yoga, config, [60, 30, 30]);
  expect(widths[0]).toBeCloseTo(60, 3);
  expect(widths[1]).toBeCloseTo(30, 3);
  expect(widths[2]).toBeCloseTo(30, 3);
});

defineBackendTest("errata_bit_round_trips", ({ Yoga }) => {
  const config = Yoga.Config.create();
  expect(config.getErrata() & Yoga.ERRATA_FLEX_FIRST_PASS_USES_RUNNING_TOTALS).not.toBe(0);

  config.setErrata(
    config.getErrata() & (Yoga.ERRATA_ALL ^ Yoga.ERRATA_FLEX_FIRST_PASS_USES_RUNNING_TOTALS),
  );
  expect(config.getErrata() & Yoga.ERRATA_FLEX_FIRST_PASS_USES_RUNNING_TOTALS).toBe(0);
});
