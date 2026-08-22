// SPDX-License-Identifier: MIT

import { Yoga } from "#/yoga/index.ts";

import { generateCase } from "./case.ts";
import { caseSeed, options, reportFailure, reportSuccess } from "./cli.ts";
import { assertInvariants, executeCase } from "./execute.ts";

const fuzzOptions = options(10_000);
for (let index = 0; index < fuzzOptions.runs; index++) {
  const fuzzCase = generateCase(caseSeed(fuzzOptions.seed, index), fuzzOptions.maxNodes);
  try {
    assertInvariants(executeCase(Yoga, fuzzCase), executeCase(Yoga, fuzzCase));
  } catch (error) {
    reportFailure("fuzz", fuzzCase, fuzzOptions.maxNodes, error);
  }
}
reportSuccess("fuzz", fuzzOptions);
