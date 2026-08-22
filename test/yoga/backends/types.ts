// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import type { Yoga } from "#/yoga/index.ts";

export interface LayoutBackend {
  readonly name: string;
  load(): Promise<Yoga>;
}
