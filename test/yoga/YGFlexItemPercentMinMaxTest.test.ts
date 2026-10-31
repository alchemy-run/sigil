// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import type { Yoga } from "#/yoga/index.ts";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

// A 10-wide row inside a 40-wide root: a child's `min-width: 50%` /
// `max-width: 50%` resolves against the row (5), not the root (20). See
// https://github.com/react/yoga/issues/872.
const layout = (Yoga: Yoga, clearErrata: boolean, bound: "min" | "max") => {
  const config = Yoga.Config.create();
  if (clearErrata) {
    config.setErrata(config.getErrata() & ~Yoga.ERRATA_FLEX_ITEM_PERCENT_MIN_MAX_AGAINST_OWNER);
  }

  const root = Yoga.Node.create(config);
  root.setWidth(40);
  const row = Yoga.Node.create(config);
  row.setWidth(10);
  row.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  const child = Yoga.Node.create(config);
  if (bound === "min") {
    child.setMinWidth("50%");
  } else {
    child.setMaxWidth("50%");
    child.setWidth(10);
  }
  row.insertChild(child, 0);
  root.insertChild(row, 0);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  return child.getComputedWidth();
};

defineBackendTest("percent_min_width_resolves_against_the_flex_container", ({ Yoga }) => {
  expect(layout(Yoga, true, "min")).toBe(5);
});

defineBackendTest("percent_max_width_resolves_against_the_flex_container", ({ Yoga }) => {
  expect(layout(Yoga, true, "max")).toBe(5);
});

defineBackendTest("errata_resolves_percent_min_width_against_the_owner", ({ Yoga }) => {
  // On by default, preserving the pre-fix geometry.
  expect(
    Yoga.Config.create().getErrata() & Yoga.ERRATA_FLEX_ITEM_PERCENT_MIN_MAX_AGAINST_OWNER,
  ).not.toBe(0);
  expect(layout(Yoga, false, "min")).toBe(20);
});

defineBackendTest("classic_errata_includes_flex_item_percent_min_max", ({ Yoga }) => {
  expect(Yoga.ERRATA_CLASSIC & Yoga.ERRATA_FLEX_ITEM_PERCENT_MIN_MAX_AGAINST_OWNER).not.toBe(0);
});
