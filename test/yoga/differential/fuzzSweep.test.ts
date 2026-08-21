// SPDX-License-Identifier: MIT
// Deterministic differential sweep: layouts from src/yoga must match the
// f64-patched reference Yoga build exactly for a fixed batch of fuzz cases.
// The open-ended search lives in `pnpm fuzz:differential` / `pnpm fuzz:loop`.

import { test } from "vite-plus/test";

import Yoga from "../../../src/yoga/index.ts";
import type { Yoga as YogaApi } from "../../../src/yoga/index.ts";
import { generateCase } from "../fuzz/case.ts";
import { caseSeed } from "../fuzz/cli.ts";
import { assertEqualLayouts, executeCase } from "../fuzz/execute.ts";
import Reference from "../reference/index.ts";

const reference = Reference as unknown as YogaApi;
// Same base seed as upstream yoga-layout-js's fuzz:smoke run.
const baseSeed = 12_648_430;
const runs = 250;

test(`differential fuzz sweep matches the reference build (${runs} cases)`, () => {
  for (let index = 0; index < runs; index++) {
    const fuzzCase = generateCase(caseSeed(baseSeed, index), 24);
    assertEqualLayouts(executeCase(Yoga, fuzzCase), executeCase(reference, fuzzCase));
  }
});
