import { expect, test } from "vite-plus/test";

import * as api from "#/index.ts";

import { rootRuntimeExports } from "./contracts/root-public-api.tsx";

test("root runtime exports match the compatibility manifest", () => {
  expect(Object.keys(api).toSorted()).toEqual(rootRuntimeExports.toSorted());
});
