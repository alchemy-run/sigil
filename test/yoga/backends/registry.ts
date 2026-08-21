// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import type { LayoutBackend } from "./types.ts";
import { typescriptBackend } from "./typescript.ts";

const backends: LayoutBackend[] = [typescriptBackend];

export function getLayoutBackends(): readonly LayoutBackend[] {
  return backends;
}
