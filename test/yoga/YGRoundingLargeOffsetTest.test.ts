// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

defineBackendTest("rounding_measured_height_is_exact_across_float_steps", ({ Yoga }) => {
  for (const spacer of [1012 + 1 / 3, 1012 + 2 / 3, 2004 + 1 / 3, 2028 + 2 / 3, 4052 + 2 / 3]) {
    const config = Yoga.Config.create();
    config.setPointScaleFactor(3);

    const root = Yoga.Node.create(config);
    root.setWidth(300);

    const spacerNode = Yoga.Node.create(config);
    spacerNode.setHeight(spacer);
    root.insertChild(spacerNode, 0);

    const text = Yoga.Node.create(config);
    text.setMeasureFunc(() => ({ width: 292, height: 44 }));
    root.insertChild(text, 1);

    root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

    expect(text.getComputedHeight(), `spacer ${spacer}`).toBe(44);
  }
});
