import { expect, test } from "vite-plus/test";

import { renderToString } from "#/index.ts";

import { Status } from "./fixtures/ink-status-component.tsx";

test("renders an Ink component package through an ink-to-sigil alias", () => {
  expect(renderToString(<Status state="ready" />, { columns: 20, colorProfile: "none" })).toBe(
    "╭──────────────────╮\n│ ready            │\n╰──────────────────╯",
  );
});
