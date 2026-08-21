// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

defineBackendTest("padding_side_overrides_horizontal_and_vertical", ({ Yoga }) => {
  const edges = [
    Yoga.EDGE_TOP,
    Yoga.EDGE_BOTTOM,
    Yoga.EDGE_START,
    Yoga.EDGE_END,
    Yoga.EDGE_LEFT,
    Yoga.EDGE_RIGHT,
  ];

  for (const edgeValue of [0, 1]) {
    for (const edge of edges) {
      const root = Yoga.Node.create();
      root.setWidth(100);
      root.setHeight(100);
      root.setPadding(
        edge === Yoga.EDGE_TOP || edge === Yoga.EDGE_BOTTOM
          ? Yoga.EDGE_VERTICAL
          : Yoga.EDGE_HORIZONTAL,
        10,
      );
      root.setPadding(edge, edgeValue);
      root.calculateLayout(100, 100, Yoga.DIRECTION_LTR);
      expect(root.getComputedPadding(edge)).toBe(edgeValue);
    }
  }
});

defineBackendTest("padding_side_overrides_all", ({ Yoga }) => {
  const edges = [
    Yoga.EDGE_TOP,
    Yoga.EDGE_BOTTOM,
    Yoga.EDGE_START,
    Yoga.EDGE_END,
    Yoga.EDGE_LEFT,
    Yoga.EDGE_RIGHT,
  ];

  for (const edgeValue of [0, 1]) {
    for (const edge of edges) {
      const root = Yoga.Node.create();
      root.setWidth(100);
      root.setHeight(100);
      root.setPadding(Yoga.EDGE_ALL, 10);
      root.setPadding(edge, edgeValue);
      root.calculateLayout(100, 100, Yoga.DIRECTION_LTR);
      expect(root.getComputedPadding(edge)).toBe(edgeValue);
    }
  }
});

defineBackendTest("padding_horizontal_and_vertical_override_all", ({ Yoga }) => {
  for (const directionValue of [0, 1]) {
    for (const direction of [Yoga.EDGE_HORIZONTAL, Yoga.EDGE_VERTICAL]) {
      const root = Yoga.Node.create();
      root.setWidth(100);
      root.setHeight(100);
      root.setPadding(Yoga.EDGE_ALL, 10);
      root.setPadding(direction, directionValue);
      root.calculateLayout(100, 100, Yoga.DIRECTION_LTR);

      const edges =
        direction === Yoga.EDGE_VERTICAL
          ? [Yoga.EDGE_TOP, Yoga.EDGE_BOTTOM]
          : [Yoga.EDGE_START, Yoga.EDGE_END, Yoga.EDGE_LEFT, Yoga.EDGE_RIGHT];
      for (const edge of edges) {
        expect(root.getComputedPadding(edge)).toBe(directionValue);
      }
    }
  }
});
