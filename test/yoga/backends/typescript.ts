// SPDX-License-Identifier: MIT

import { Yoga } from "#/yoga/index.ts";

import type { LayoutBackend } from "./types.ts";

export const typescriptBackend: LayoutBackend = {
  name: "typescript",
  load() {
    return Promise.resolve(Yoga);
  },
};
