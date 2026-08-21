// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { Config } from "./config.ts";
import YGEnums from "./generated/YGEnums.ts";
import { Node } from "./node.ts";

export type { Config } from "./config.ts";
export type { DirtiedFunction, MeasureFunction, Node } from "./node.ts";

const Yoga = {
  Config,
  Node,
  ...YGEnums,
};

export type Yoga = typeof Yoga;

export default Yoga;
export * from "./generated/YGEnums.ts";
