// SPDX-License-Identifier: MIT

import type { Node } from "#/yoga/index.ts";

export interface LayoutSnapshot {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly hadOverflow: boolean;
  readonly children: readonly LayoutSnapshot[];
}

export function snapshot(node: Node): LayoutSnapshot {
  return {
    left: node.getComputedLeft(),
    top: node.getComputedTop(),
    width: node.getComputedWidth(),
    height: node.getComputedHeight(),
    hadOverflow: node.getComputedHadOverflow(),
    children: Array.from({ length: node.getChildCount() }, (_, index) =>
      snapshot(node.getChild(index)),
    ),
  };
}
