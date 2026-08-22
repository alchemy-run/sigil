// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { expect } from "vite-plus/test";

import type { Node } from "#/yoga/index.ts";

import { defineBackendTest } from "./backends/defineBackendTest.ts";

function childrenOf(node: Node): Node[] {
  return Array.from({ length: node.getChildCount() }, (_, index) => node.getChild(index));
}

defineBackendTest("set_children_adds_children_to_parent", ({ Yoga }) => {
  const root = Yoga.Node.create();
  const children = [Yoga.Node.create(), Yoga.Node.create()];
  root.setChildren(children);
  expect(childrenOf(root)).toEqual(children);
  expect(children.map((child) => child.getParent())).toEqual([root, root]);
});

defineBackendTest("set_children_to_empty_removes_old_children", ({ Yoga }) => {
  const root = Yoga.Node.create();
  const children = [Yoga.Node.create(), Yoga.Node.create()];
  root.setChildren(children);
  root.setChildren([]);
  expect(childrenOf(root)).toEqual([]);
  expect(children.map((child) => child.getParent())).toEqual([null, null]);
});

defineBackendTest("set_children_replaces_non_common_children", ({ Yoga }) => {
  const root = Yoga.Node.create();
  const oldChildren = [Yoga.Node.create(), Yoga.Node.create()];
  const newChildren = [Yoga.Node.create(), Yoga.Node.create()];
  root.setChildren(oldChildren);
  root.setChildren(newChildren);
  expect(childrenOf(root)).toEqual(newChildren);
  expect(oldChildren.map((child) => child.getParent())).toEqual([null, null]);
});

defineBackendTest("set_children_keeps_and_reorders_common_children", ({ Yoga }) => {
  const root = Yoga.Node.create();
  const first = Yoga.Node.create();
  const second = Yoga.Node.create();
  const third = Yoga.Node.create();
  root.setChildren([first, second, third]);
  const fourth = Yoga.Node.create();
  root.setChildren([third, second, fourth]);
  expect(childrenOf(root)).toEqual([third, second, fourth]);
  expect([first, second, third, fourth].map((child) => child.getParent())).toEqual([
    null,
    root,
    root,
    root,
  ]);
});
