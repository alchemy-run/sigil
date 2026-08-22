// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { Config } from "#/yoga/config.ts";
import { constants as YGEnums } from "#/yoga/generated/YGEnums.ts";
import { Node } from "#/yoga/node.ts";

export type { Config } from "#/yoga/config.ts";
export type { DirtiedFunction, MeasureFunction, Node } from "#/yoga/node.ts";

export const Yoga = {
  Config,
  Node,
  ...YGEnums,
};

export type Yoga = typeof Yoga;

export * from "#/yoga/generated/YGEnums.ts";
