// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

// Regression test for `cleanupContentsNodesRecursively` stamping
// `hasNewLayout=true` on a display:contents child during a measurement-only
// visit.
//
// Setup: Root (overflow=visible, flex column) -> Parent (flex-grow=1)
//        -> Contents (display:contents) -> Leaf.
// Flipping root's overflow between the two passes invalidates Parent's
// measurement cache (computeFlexBasisForChild's `applyHeightFitContent`
// branch flips) but leaves Parent's layout cache intact (its allotment is
// unchanged). So in pass 2, Parent's calculateLayoutImpl runs only with
// performLayout=false - the layout-phase visit is served from cache and
// `cleanupContentsNodesRecursively` never runs at performLayout=true.
defineBackendTest("contents_child_hasNewLayout_not_stamped_on_measure_only_visit", ({ Yoga }) => {
  const leaf = Yoga.Node.create();
  leaf.setWidth(20);
  leaf.setHeight(20);

  const contents = Yoga.Node.create();
  contents.setDisplay(Yoga.DISPLAY_CONTENTS);
  contents.insertChild(leaf, 0);

  const parent = Yoga.Node.create();
  parent.setFlexGrow(1);
  parent.insertChild(contents, 0);

  const root = Yoga.Node.create();
  root.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
  root.setWidth(200);
  root.setHeight(200);
  root.setOverflow(Yoga.OVERFLOW_VISIBLE);
  root.insertChild(parent, 0);

  root.calculateLayout(200, 200, Yoga.DIRECTION_LTR);

  // Simulate a consumer (e.g. React Native's layout pass) reading and
  // clearing the hasNewLayout flags.
  root.markLayoutSeen();
  parent.markLayoutSeen();
  contents.markLayoutSeen();
  leaf.markLayoutSeen();

  root.setOverflow(Yoga.OVERFLOW_SCROLL);
  root.calculateLayout(200, 200, Yoga.DIRECTION_LTR);

  expect(contents.hasNewLayout()).toBe(false);
});

// Regression test for `cleanupContentsNodesRecursively` invoked from
// `layoutAbsoluteDescendants`: it must stamp `hasNewLayout=true` on
// display:contents children on the path to an absolute descendant whose
// position changed this pass. Otherwise consumers traversing the tree via
// hasNewLayout would skip the contents subtree and miss the update.
//
// Setup: root (containing block) -> staticChild (fixed 50x50)
//        -> contents (display:contents) -> absoluteChild (right/bottom-
//        anchored so its position depends on the containing block).
// Growing root in pass 2 dirties only root. staticChild's fixed dimensions
// make its layout cache hit, so its main-path cleanup never runs.
// absoluteChild depends on the containing block and is repositioned by
// `layoutAbsoluteDescendants`, which is the only path that can stamp
// contents along the way.
defineBackendTest(
  "absolute_descendant_through_contents_is_reachable_via_hasNewLayout",
  ({ Yoga }) => {
    const absoluteChild = Yoga.Node.create();
    absoluteChild.setPositionType(Yoga.POSITION_TYPE_ABSOLUTE);
    absoluteChild.setPosition(Yoga.EDGE_RIGHT, 0);
    absoluteChild.setPosition(Yoga.EDGE_BOTTOM, 0);
    absoluteChild.setWidth(10);
    absoluteChild.setHeight(10);

    const contents = Yoga.Node.create();
    contents.setDisplay(Yoga.DISPLAY_CONTENTS);
    contents.insertChild(absoluteChild, 0);

    const staticChild = Yoga.Node.create();
    staticChild.setPositionType(Yoga.POSITION_TYPE_STATIC);
    staticChild.setWidth(50);
    staticChild.setHeight(50);
    staticChild.insertChild(contents, 0);

    const root = Yoga.Node.create();
    root.setWidth(100);
    root.setHeight(100);
    root.insertChild(staticChild, 0);

    root.calculateLayout(100, 100, Yoga.DIRECTION_LTR);

    // Simulate a consumer (e.g. React Native's layout pass) reading and
    // clearing the hasNewLayout flags.
    root.markLayoutSeen();
    staticChild.markLayoutSeen();
    contents.markLayoutSeen();
    absoluteChild.markLayoutSeen();

    root.setWidth(150);
    root.calculateLayout(150, 100, Yoga.DIRECTION_LTR);

    expect(absoluteChild.hasNewLayout()).toBe(true);
    expect(staticChild.hasNewLayout()).toBe(true);
    expect(contents.hasNewLayout()).toBe(true);
  },
);

// Regression test for `cleanupContentsNodesRecursively` invoked from
// `layoutAbsoluteDescendants`: it must not stamp `hasNewLayout=true` on
// display:contents children when no new layout was produced for their
// parent this pass. Otherwise the stale flag survives across passes and
// can be observed by a later cache-hit on the parent.
//
// Setup: root -> a (fixed 50x50) -> b (fixed 30x30)
//        -> contents (display:contents) -> leaf.
// Flipping root's overflow in pass 2 dirties only root. a and b have fixed
// sizes so their layout caches hit; a.calculateLayoutImpl is skipped, so
// b.calculateLayoutInternal is never invoked. `layoutAbsoluteDescendants`
// still walks down through a and b looking for absolute descendants, but
// there are none beneath b - so b.hasNewLayout stays false and the
// cleanup along that walk must leave contents unflagged.
defineBackendTest(
  "absolute_phase_cleanup_does_not_stamp_when_parent_layout_skipped",
  ({ Yoga }) => {
    const leaf = Yoga.Node.create();
    leaf.setWidth(10);
    leaf.setHeight(10);

    const contents = Yoga.Node.create();
    contents.setDisplay(Yoga.DISPLAY_CONTENTS);
    contents.insertChild(leaf, 0);

    const b = Yoga.Node.create();
    b.setPositionType(Yoga.POSITION_TYPE_STATIC);
    b.setWidth(30);
    b.setHeight(30);
    b.insertChild(contents, 0);

    const a = Yoga.Node.create();
    a.setPositionType(Yoga.POSITION_TYPE_STATIC);
    a.setWidth(50);
    a.setHeight(50);
    a.insertChild(b, 0);

    const root = Yoga.Node.create();
    root.setWidth(200);
    root.setHeight(200);
    root.setOverflow(Yoga.OVERFLOW_VISIBLE);
    root.insertChild(a, 0);

    root.calculateLayout(200, 200, Yoga.DIRECTION_LTR);

    // Simulate a consumer (e.g. React Native's layout pass) reading and
    // clearing the hasNewLayout flags.
    root.markLayoutSeen();
    a.markLayoutSeen();
    b.markLayoutSeen();
    contents.markLayoutSeen();
    leaf.markLayoutSeen();

    root.setOverflow(Yoga.OVERFLOW_SCROLL);
    root.calculateLayout(200, 200, Yoga.DIRECTION_LTR);

    expect(b.hasNewLayout()).toBe(false);
    expect(contents.hasNewLayout()).toBe(false);
  },
);
