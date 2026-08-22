// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { MeasureMode } from "#/yoga/generated/YGEnums.ts";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

function measureTextLike(width: number, widthMode: MeasureMode): { width: number; height: number } {
  let measuredWidth = 200;
  if (widthMode === MeasureMode.AtMost) {
    measuredWidth = Math.min(measuredWidth, width);
  }
  return { width: measuredWidth, height: 20 };
}

for (const fixFlexBasisFitContent of [false, true]) {
  const param = ` (fixFlexBasisFitContent: ${fixFlexBasisFitContent})`;

  // Auto-height container with a percentage-height child produces the same
  // layout regardless of feature state, because Check 3 preserves percentage
  // resolution when availableInnerHeight is NaN.
  defineBackendTest(`percentage_height_converges${param}`, ({ Yoga }) => {
    const config = Yoga.Config.create();
    config.setExperimentalFeatureEnabled(
      Yoga.EXPERIMENTAL_FEATURE_FIX_FLEX_BASIS_FIT_CONTENT,
      fixFlexBasisFitContent,
    );

    const root = Yoga.Node.create(config);
    root.setHeight(300);
    root.setWidth(100);

    const container = Yoga.Node.create(config);
    root.insertChild(container, 0);

    const child = Yoga.Node.create(config);
    child.setHeightPercent(50);
    container.insertChild(child, 0);

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

    expect(child.getComputedHeight()).toBe(75);
    expect(container.getComputedHeight()).toBe(150);
  });

  // Two auto-height containers with percentage children and flexGrow:1 produce
  // the same layout regardless of feature state.
  defineBackendTest(`percentage_with_flex_grow_converges${param}`, ({ Yoga }) => {
    const config = Yoga.Config.create();
    config.setExperimentalFeatureEnabled(
      Yoga.EXPERIMENTAL_FEATURE_FIX_FLEX_BASIS_FIT_CONTENT,
      fixFlexBasisFitContent,
    );

    const root = Yoga.Node.create(config);
    root.setHeight(400);
    root.setWidth(100);

    const containerA = Yoga.Node.create(config);
    containerA.setFlexGrow(1);
    root.insertChild(containerA, 0);

    const childA = Yoga.Node.create(config);
    childA.setHeightPercent(25);
    containerA.insertChild(childA, 0);

    const containerB = Yoga.Node.create(config);
    containerB.setFlexGrow(1);
    root.insertChild(containerB, 1);

    const childB = Yoga.Node.create(config);
    childB.setHeightPercent(50);
    containerB.insertChild(childB, 0);

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

    expect(containerA.getComputedHeight()).toBe(150);
    expect(containerB.getComputedHeight()).toBe(250);
  });

  // Auto-height container with flexShrink and a percentage child causing
  // overflow produces the same layout regardless of feature state.
  defineBackendTest(`flex_shrink_overflow_converges${param}`, ({ Yoga }) => {
    const config = Yoga.Config.create();
    config.setExperimentalFeatureEnabled(
      Yoga.EXPERIMENTAL_FEATURE_FIX_FLEX_BASIS_FIT_CONTENT,
      fixFlexBasisFitContent,
    );

    const root = Yoga.Node.create(config);
    root.setHeight(200);
    root.setWidth(100);

    const container = Yoga.Node.create(config);
    container.setFlexShrink(1);
    root.insertChild(container, 0);

    const child = Yoga.Node.create(config);
    child.setHeightPercent(100);
    container.insertChild(child, 0);

    const fixed = Yoga.Node.create(config);
    fixed.setHeight(150);
    root.insertChild(fixed, 1);

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

    expect(container.getComputedHeight()).toBe(50);
    expect(fixed.getComputedHeight()).toBe(150);
  });

  // In a scroll container (column), changing a sibling's height does not cause
  // re-measurement of unaffected subtrees when the feature is enabled.
  defineBackendTest(`scroll_avoids_remeasure${param}`, ({ Yoga }) => {
    let measureCount = 0;
    const measureFunc = () => {
      measureCount++;
      return { width: 50, height: 50 };
    };

    const config = Yoga.Config.create();
    config.setExperimentalFeatureEnabled(
      Yoga.EXPERIMENTAL_FEATURE_FIX_FLEX_BASIS_FIT_CONTENT,
      fixFlexBasisFitContent,
    );

    const root = Yoga.Node.create(config);
    root.setOverflow(Yoga.OVERFLOW_SCROLL);
    root.setWidth(100);
    root.setHeight(500);

    const sibling = Yoga.Node.create(config);
    sibling.setHeight(100);
    root.insertChild(sibling, 0);

    const wrapper = Yoga.Node.create(config);
    root.insertChild(wrapper, 1);

    const inner = Yoga.Node.create(config);
    wrapper.insertChild(inner, 0);

    const leaf = Yoga.Node.create(config);
    leaf.setMeasureFunc(measureFunc);
    inner.insertChild(leaf, 0);

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
    const firstPassCount = measureCount;

    sibling.setHeight(200);
    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
    const secondPassCount = measureCount - firstPassCount;

    expect(leaf.getComputedHeight()).toBe(50);

    expect(secondPassCount).toBe(0);
  });

  // Row direction is unaffected by the optimization. Width FitContent is always
  // preserved to support text wrapping through container nodes.
  defineBackendTest(`row_direction_unchanged${param}`, ({ Yoga }) => {
    const config = Yoga.Config.create();
    config.setExperimentalFeatureEnabled(
      Yoga.EXPERIMENTAL_FEATURE_FIX_FLEX_BASIS_FIT_CONTENT,
      fixFlexBasisFitContent,
    );

    const root = Yoga.Node.create(config);
    root.setWidth(100);
    root.setHeight(100);

    const container = Yoga.Node.create(config);
    root.insertChild(container, 0);

    const text = Yoga.Node.create(config);
    text.setMeasureFunc(measureTextLike);
    container.insertChild(text, 0);

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

    expect(text.getComputedWidth()).toBe(100);
  });

  // Scroll container in row direction: width FitContent is skipped for the
  // main axis (row) in scroll containers, matching legacy behavior.
  defineBackendTest(`row_scroll_skips_width${param}`, ({ Yoga }) => {
    const config = Yoga.Config.create();
    config.setExperimentalFeatureEnabled(
      Yoga.EXPERIMENTAL_FEATURE_FIX_FLEX_BASIS_FIT_CONTENT,
      fixFlexBasisFitContent,
    );

    const root = Yoga.Node.create(config);
    root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
    root.setOverflow(Yoga.OVERFLOW_SCROLL);
    root.setWidth(100);
    root.setHeight(100);

    const text = Yoga.Node.create(config);
    text.setMeasureFunc(measureTextLike);
    root.insertChild(text, 0);

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

    expect(text.getComputedWidth()).toBe(200);
  });
}

// Feature toggle invalidates layout cache.
defineBackendTest("flex_basis_fit_content_feature_change_invalidates_cache", ({ Yoga }) => {
  const config = Yoga.Config.create();
  config.setExperimentalFeatureEnabled(Yoga.EXPERIMENTAL_FEATURE_FIX_FLEX_BASIS_FIT_CONTENT, false);

  const root = Yoga.Node.create(config);
  root.setHeight(300);
  root.setWidth(100);

  const container = Yoga.Node.create(config);
  container.setFlexGrow(1);
  root.insertChild(container, 0);

  const child = Yoga.Node.create(config);
  child.setHeightPercent(50);
  container.insertChild(child, 0);

  const fixed = Yoga.Node.create(config);
  fixed.setHeight(100);
  root.insertChild(fixed, 1);

  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  const heightBefore = container.getComputedHeight();

  config.setExperimentalFeatureEnabled(Yoga.EXPERIMENTAL_FEATURE_FIX_FLEX_BASIS_FIT_CONTENT, true);
  root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  const heightAfter = container.getComputedHeight();

  expect(heightAfter).toBe(heightBefore);
});
