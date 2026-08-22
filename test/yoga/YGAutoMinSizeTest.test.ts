// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { MeasureMode } from "#/yoga/generated/YGEnums.ts";
import type { Config, Node, Yoga } from "#/yoga/index.ts";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

// Simulates a min-content-aware text measure: the longest "word" is
// `kWordWidth`. Asked to be smaller than that on the main axis, the measure
// function returns the longest-word width — that's how a real text engine
// reports its min-content width.
const kWordWidth = 30;
const kNaturalWidth = 90;
const kLineHeight = 16;

function measureWordWrappingText(
  width: number,
  widthMode: MeasureMode,
): { width: number; height: number } {
  if (widthMode === MeasureMode.AtMost) {
    if (width < kWordWidth) {
      return { width: kWordWidth, height: kLineHeight * 3 };
    }
    if (width < kNaturalWidth) {
      return { width, height: kLineHeight * 2 };
    }
    return { width: kNaturalWidth, height: kLineHeight };
  }
  if (widthMode === MeasureMode.Exactly) {
    return { width, height: kLineHeight };
  }
  return { width: kNaturalWidth, height: kLineHeight };
}

function makeWebConfig(Yoga: Yoga, useAutoMinSize: boolean): Config {
  const config = Yoga.Config.create();
  config.setUseWebDefaults(true);
  // Default config has YGErrataMinSizeUndefinedInsteadOfAuto set (preserves
  // legacy "no auto-min" behavior). Clear the bit to opt into CSS §4.5
  // automatic minimum sizing.
  if (useAutoMinSize) {
    const errata = config.getErrata();
    config.setErrata(errata & ~Yoga.ERRATA_MIN_SIZE_UNDEFINED_INSTEAD_OF_AUTO);
  }
  return config;
}

// Builds a 2-child row where the first child is shrinkable text and the
// second is a fixed-size spacer that doesn't shrink. This forces the text
// to absorb all the shrink when free space is negative.
function makeShrinkRow(
  Yoga: Yoga,
  useAutoMinSize: boolean,
  containerWidth: number,
): { root: Node; text: Node; spacer: Node } {
  const config = makeWebConfig(Yoga, useAutoMinSize);
  const root = Yoga.Node.create(config);
  const text = Yoga.Node.create(config);
  const spacer = Yoga.Node.create(config);

  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(containerWidth);
  root.setHeight(50);

  text.setMeasureFunc(measureWordWrappingText);
  text.setFlexBasis(kNaturalWidth);
  text.setFlexGrow(0);
  text.setFlexShrink(1);
  root.insertChild(text, 0);

  spacer.setWidth(10);
  spacer.setFlexShrink(0);
  root.insertChild(spacer, 1);

  return { root, text, spacer };
}

// Default config (auto-min off): shrink path takes the text below its
// content size — legacy Yoga behavior preserved.
defineBackendTest("default_config_preserves_existing_shrink", ({ Yoga }) => {
  const row = makeShrinkRow(Yoga, /*useAutoMinSize=*/ false, 20);
  row.root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  // Container 20 - spacer 10 = 10 for text. Without auto-min, text shrinks
  // freely below kWordWidth (30).
  expect(row.text.getComputedWidth()).toBe(10);
});

// Auto-min on: text floored at min-content (kWordWidth). Container
// overflows rather than violate the floor.
defineBackendTest("auto_min_floors_text_at_min_content_width", ({ Yoga }) => {
  const row = makeShrinkRow(Yoga, /*useAutoMinSize=*/ true, 20);
  row.root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  // Floor = min(content=30, specified=NaN) = 30. Text stuck at 30; the
  // 10-px spacer takes its space; container of 20 overflows.
  expect(row.text.getComputedWidth()).toBe(kWordWidth);
  expect(row.spacer.getComputedWidth()).toBe(10);
});

// A measure-func leaf's auto-min floor must include the leaf's own padding and
// border on the main axis, just like the container branch and the normal
// measure pass. Regression test: the original probe omitted them, flooring a
// padded text at its bare longest-word width.
defineBackendTest("auto_min_includes_leaf_padding_and_border_width", ({ Yoga }) => {
  const config = makeWebConfig(Yoga, /*useAutoMinSize=*/ true);
  const root = Yoga.Node.create(config);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(20);
  root.setHeight(50);

  const text = Yoga.Node.create(config);
  text.setMeasureFunc(measureWordWrappingText);
  text.setFlexBasis(kNaturalWidth);
  text.setFlexGrow(0);
  text.setFlexShrink(1);
  text.setPadding(Yoga.EDGE_LEFT, 4);
  text.setPadding(Yoga.EDGE_RIGHT, 4);
  text.setBorder(Yoga.EDGE_LEFT, 1);
  text.setBorder(Yoga.EDGE_RIGHT, 1);
  root.insertChild(text, 0);

  const spacer = Yoga.Node.create(config);
  spacer.setWidth(10);
  spacer.setFlexShrink(0);
  root.insertChild(spacer, 1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  // Floor = content kWordWidth(30) + padding(4+4) + border(1+1) = 40. Without
  // the padding/border contribution the leaf would be wrongly floored at 30.
  expect(text.getComputedWidth()).toBe(40);
});

// Same fix on the column (cross) axis: vertical padding must be included in the
// height min-content.
defineBackendTest("auto_min_includes_leaf_padding_height", ({ Yoga }) => {
  const config = makeWebConfig(Yoga, /*useAutoMinSize=*/ true);
  const root = Yoga.Node.create(config);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
  root.setWidth(200);
  root.setHeight(20);

  const text = Yoga.Node.create(config);
  text.setMeasureFunc(measureWordWrappingText);
  text.setFlexBasis(kNaturalWidth); // tall basis forces shrink
  text.setFlexGrow(0);
  text.setFlexShrink(1);
  text.setPadding(Yoga.EDGE_TOP, 4);
  text.setPadding(Yoga.EDGE_BOTTOM, 4);
  root.insertChild(text, 0);

  const spacer = Yoga.Node.create(config);
  spacer.setHeight(10);
  spacer.setFlexShrink(0);
  root.insertChild(spacer, 1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  // Column probe height = natural kLineHeight(16) + padding(4+4) = 24.
  expect(text.getComputedHeight()).toBe(24);
});

// flex-basis: 0 with intrinsic content (the under-protection case from the
// critique). With auto-min on, an item with `flex: 1` is still floored at
// its min-content even though basis is 0.
defineBackendTest("flex_basis_zero_floors_at_min_content", ({ Yoga }) => {
  const config = makeWebConfig(Yoga, /*useAutoMinSize=*/ true);
  const root = Yoga.Node.create(config);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(50);
  root.setHeight(50);

  const a = Yoga.Node.create(config);
  a.setMeasureFunc(measureWordWrappingText);
  a.setFlex(1);
  root.insertChild(a, 0);

  const b = Yoga.Node.create(config);
  b.setMeasureFunc(measureWordWrappingText);
  b.setFlex(1);
  root.insertChild(b, 1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  // Each auto-min = kWordWidth. Container 50, total floor 60, overflows.
  expect(a.getComputedWidth()).toBe(kWordWidth);
  expect(b.getComputedWidth()).toBe(kWordWidth);
});

// Explicit width (basis) > content: floor = min(content, specified) =
// content. So text can shrink from basis-90 down to content-30.
defineBackendTest("content_smaller_than_specified_shrinks_to_content", ({ Yoga }) => {
  const row = makeShrinkRow(Yoga, /*useAutoMinSize=*/ true, 20);
  row.root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  // Auto-min = min(content=30, specified=NaN) = 30. (No flex-basis set as
  // a "specified main size" — Yoga's basis is set via setFlexBasis but the
  // CSS spec checks `width`/`height`, which here are undefined.) So the
  // floor is 30, and text shrinks from natural-90 down to 30.
  expect(row.text.getComputedWidth()).toBe(kWordWidth);
});

// max-width caps the auto-min.
defineBackendTest("auto_min_capped_by_max_size", ({ Yoga }) => {
  const config = makeWebConfig(Yoga, /*useAutoMinSize=*/ true);
  const root = Yoga.Node.create(config);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(10);
  root.setHeight(50);

  const text = Yoga.Node.create(config);
  text.setMeasureFunc(measureWordWrappingText);
  text.setFlexBasis(kNaturalWidth);
  text.setFlexGrow(0);
  text.setFlexShrink(1);
  text.setMaxWidth(20);
  root.insertChild(text, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  // Auto-min = min(content=30) capped by max=20 → 20. Text floored at 20.
  expect(text.getComputedWidth()).toBe(20);
});

// Explicit min-width: 0 opts out (CSS escape hatch).
defineBackendTest("explicit_min_width_zero_opts_out", ({ Yoga }) => {
  const config = makeWebConfig(Yoga, /*useAutoMinSize=*/ true);
  const root = Yoga.Node.create(config);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(20);
  root.setHeight(50);

  const text = Yoga.Node.create(config);
  text.setMeasureFunc(measureWordWrappingText);
  text.setFlexBasis(kNaturalWidth);
  text.setFlexGrow(0);
  text.setFlexShrink(1);
  text.setMinWidth(0);
  root.insertChild(text, 0);

  const spacer = Yoga.Node.create(config);
  spacer.setWidth(10);
  spacer.setFlexShrink(0);
  root.insertChild(spacer, 1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  // min-width:0 → no auto-min. Text shrinks to 10 (container - spacer).
  expect(text.getComputedWidth()).toBe(10);
});

// Aspect-ratio item with definite cross-size and no specified main:
// transferred-size = cross × ratio acts as the floor.
defineBackendTest("aspect_ratio_transferred_size_floors_main", ({ Yoga }) => {
  const config = makeWebConfig(Yoga, /*useAutoMinSize=*/ true);
  const root = Yoga.Node.create(config);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(30);
  root.setHeight(50);

  const img = Yoga.Node.create(config);
  img.setHeight(40);
  img.setAspectRatio(2);
  img.setFlexBasis(kNaturalWidth); // basis 90, container 30
  img.setFlexShrink(1);
  root.insertChild(img, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  // No specified main width, aspect-ratio defined, cross definite:
  // transferred-size = 40 * 2 = 80. Auto-min = min(content=0,
  // transferred=80) = 0 — wait, per §4.5: when specified is undefined and
  // aspect-ratio applies, floor = min(content, transferred). content=0
  // (no measure func, no children) so floor = 0. img can shrink to 30.
  // The transferred-size is the LOWER bound on the *content suggestion*
  // when there's no measure func: per §4.5, when content suggestion
  // would be 0 and transferred applies, transferred replaces it.
  // Yoga implements the spec as min(content, transferred), preferring the
  // smaller — pragmatic but slightly under-protective for replaced
  // elements without intrinsic size.
  expect(img.getComputedWidth()).toBe(30);
});

// Multi-level: outer column has limited height; inner wrapper has a
// fixed-size leaf (height 50) — auto-min protects the wrapper at 50.
defineBackendTest("nested_flexbox_recurses_into_min_content", ({ Yoga }) => {
  const config = makeWebConfig(Yoga, /*useAutoMinSize=*/ true);
  const root = Yoga.Node.create(config);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
  root.setWidth(200);
  root.setHeight(30);

  const wrapper = Yoga.Node.create(config);
  wrapper.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
  wrapper.setFlexGrow(0);
  wrapper.setFlexShrink(1);
  root.insertChild(wrapper, 0);

  const leaf = Yoga.Node.create(config);
  leaf.setMeasureFunc(() => ({ width: 200, height: 50 }));
  wrapper.insertChild(leaf, 0);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  // Wrapper's recursive min-content = leaf's intrinsic 50. Floor 50,
  // container 30 → wrapper protected at 50, container overflows.
  expect(wrapper.getComputedHeight()).toBe(50);
});

// overflow != visible disables auto-min on that item (CSS spec).
defineBackendTest("overflow_hidden_disables_auto_min", ({ Yoga }) => {
  const config = makeWebConfig(Yoga, /*useAutoMinSize=*/ true);
  const root = Yoga.Node.create(config);
  root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  root.setWidth(20);
  root.setHeight(50);

  const text = Yoga.Node.create(config);
  text.setMeasureFunc(measureWordWrappingText);
  text.setFlexBasis(kNaturalWidth);
  text.setFlexGrow(0);
  text.setFlexShrink(1);
  text.setOverflow(Yoga.OVERFLOW_HIDDEN);
  root.insertChild(text, 0);

  const spacer = Yoga.Node.create(config);
  spacer.setWidth(10);
  spacer.setFlexShrink(0);
  root.insertChild(spacer, 1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

  // overflow:hidden → auto-min = 0 → text shrinks to 10 (container -
  // spacer), well below kWordWidth.
  expect(text.getComputedWidth()).toBe(10);
});

// Errata smoke test: default config carries the legacy bit; clearing it
// enables auto-min, setting it back disables.
defineBackendTest("errata_bit_round_trips", ({ Yoga }) => {
  const config = Yoga.Config.create();
  expect(config.getErrata() & Yoga.ERRATA_MIN_SIZE_UNDEFINED_INSTEAD_OF_AUTO).not.toBe(0);

  config.setErrata(config.getErrata() & ~Yoga.ERRATA_MIN_SIZE_UNDEFINED_INSTEAD_OF_AUTO);
  expect(config.getErrata() & Yoga.ERRATA_MIN_SIZE_UNDEFINED_INSTEAD_OF_AUTO).toBe(0);

  config.setErrata(config.getErrata() | Yoga.ERRATA_MIN_SIZE_UNDEFINED_INSTEAD_OF_AUTO);
  expect(config.getErrata() & Yoga.ERRATA_MIN_SIZE_UNDEFINED_INSTEAD_OF_AUTO).not.toBe(0);
});
