// SPDX-License-Identifier: MIT

import Yoga from "../../../src/yoga/index.ts";
import type { Yoga as YogaApi } from "../../../src/yoga/index.ts";
import Reference from "../reference/index.ts";
import { generateCase } from "./case.ts";
import { caseSeed, options, reportFailure, reportSuccess } from "./cli.ts";
import { assertEqualLayouts, executeCase } from "./execute.ts";

const fuzzOptions = options(1_000);
const reference = Reference as unknown as YogaApi;
for (let index = 0; index < fuzzOptions.runs; index++) {
  const fuzzCase = generateCase(caseSeed(fuzzOptions.seed, index), fuzzOptions.maxNodes);
  try {
    assertEqualLayouts(executeCase(Yoga, fuzzCase), executeCase(reference, fuzzCase));
  } catch (error) {
    reportFailure("fuzz:differential", fuzzCase, fuzzOptions.maxNodes, error);
  }
}
reportSuccess("fuzz:differential", fuzzOptions);
