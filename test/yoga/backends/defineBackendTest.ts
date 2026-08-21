// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { test } from "vite-plus/test";

import type { Yoga } from "#/yoga/index.ts";

import { getLayoutBackends } from "./registry.ts";

type BackendTest = (context: { Yoga: Yoga }) => void | Promise<void>;

function register(name: string, body: BackendTest, skipped: boolean): void {
  for (const backend of getLayoutBackends()) {
    const testFunction = skipped ? test.skip : test;
    testFunction(`${backend.name}: ${name}`, async () => {
      await body({ Yoga: await backend.load() });
    });
  }
}

export const defineBackendTest = Object.assign(
  (name: string, body: BackendTest) => register(name, body, false),
  {
    skip: (name: string, body: BackendTest) => register(name, body, true),
  },
);
