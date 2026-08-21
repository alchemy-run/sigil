// SPDX-License-Identifier: MIT

import { expect } from "vite-plus/test";

import Yoga from "../../../src/yoga/index.ts";
import type { Yoga as YogaApi } from "../../../src/yoga/index.ts";
import Reference from "../reference/index.ts";
import { snapshot, type LayoutSnapshot } from "./snapshot.ts";

export type LayoutScenario = (Yoga: YogaApi) => LayoutSnapshot;

export function layoutScenario(
  build: (Yoga: YogaApi) => ReturnType<YogaApi["Node"]["create"]>,
): LayoutScenario {
  return (engine) => {
    const root = build(engine);
    root.calculateLayout(undefined, undefined, engine.DIRECTION_LTR);
    return snapshot(root);
  };
}

export function compareBackends(scenario: LayoutScenario): void {
  expect(scenario(Yoga)).toEqual(scenario(Reference as unknown as YogaApi));
}
