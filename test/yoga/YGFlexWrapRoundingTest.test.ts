// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

// A content-sized wrapping row sizes itself to the max-content sum of its
// items, then recovers the space available to those items by subtracting its
// padding and border back off. When a measure function contributes a fractional
// width, that float round-trip can land a fraction of an ulp below the sum it
// came from, while the measurement cache still returns the max-content
// measurement unchanged because it treats the difference as equal
// (oldSizeIsMaxContentAndStillFits). The line must not break in that case: the
// container has already been sized for a single line, so breaking leaves its
// items laid out on two lines inside a box only tall enough for one.
//
// The widths swept here put the row's content sum just under 128 and its outer
// width just over it, so adding padding and border crosses a float binade and
// the subtraction cannot always recover the original value.
defineBackendTest("content_sized_wrap_row_does_not_break_line_on_rounding", ({ Yoga }) => {
  for (let step = 0; step < 100; step++) {
    const measuredWidth = 84 + step / 100;
    const trace = `measured width ${measuredWidth} (step ${step})`;

    const root = Yoga.Node.create();
    root.setWidth(400);
    root.setHeight(400);

    // Shrink-to-fit in the cross axis, so its width comes from its content.
    const wrapper = Yoga.Node.create();
    wrapper.setAlignSelf(Yoga.ALIGN_FLEX_START);
    wrapper.setBorder(Yoga.EDGE_ALL, 1);
    root.insertChild(wrapper, 0);

    const row = Yoga.Node.create();
    row.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
    row.setFlexWrap(Yoga.WRAP_WRAP);
    row.setPadding(Yoga.EDGE_ALL, 16);
    wrapper.insertChild(row, 0);

    // Reports a fractional width, standing in for a text measurement whose
    // result is not representable on the pixel grid.
    const measured = Yoga.Node.create();
    measured.setMeasureFunc(() => ({ width: measuredWidth, height: 20 }));
    row.insertChild(measured, 0);

    const rigid = Yoga.Node.create();
    rigid.setWidth(20);
    rigid.setHeight(20);
    row.insertChild(rigid, 1);

    root.calculateLayout(400, 400, Yoga.DIRECTION_LTR);

    // Both items fit on one line by construction: the row is content-sized and
    // the root is far wider than the content needs.
    expect(rigid.getComputedTop(), trace).toBe(measured.getComputedTop());

    // A single line of 20pt content plus 16pt of padding on each side. If the
    // line broke, the items occupy two lines while the box keeps this height.
    expect(row.getComputedHeight(), trace).toBe(52);
  }
});
