// SPDX-License-Identifier: MIT

import { describe, expect, test } from "vite-plus/test";

import { Yoga } from "#/yoga/index.ts";

import { generateCase } from "./fuzz/case.ts";
import { assertInvariants, executeCase } from "./fuzz/execute.ts";

describe("fuzz regressions", () => {
  test.each([1235096823, 3869548039])(
    "normalizes an indefinite size to max-content (seed %i)",
    (seed) => {
      const fuzzCase = generateCase(seed);
      const first = executeCase(Yoga, fuzzCase);
      const second = executeCase(Yoga, fuzzCase);

      expect(() => assertInvariants(first, second)).not.toThrow();
    },
  );
});
