import { expect, test } from "vite-plus/test";

import wrapText, { wrapTextCache } from "../src/wrap-text.ts";

test("wraps text", () => {
  expect(wrapText("hello world", 5, "wrap")).toBe("hello\n \nworld");
});

test("truncates text at the end", () => {
  expect(wrapText("hello world", 5, "truncate-end")).toBe("hell…");
});

test("uses separate cache entries for different widths", () => {
  expect(wrapText("hello world", 5, "truncate-end")).toBe("hell…");
  expect(wrapText("hello world", 8, "truncate-end")).toBe("hello w…");
});

test("evicts old cached results", () => {
  const cacheKey = "cache-test-first5truncate-end";
  wrapTextCache.clear();
  wrapText("cache-test-first", 5, "truncate-end");

  for (let index = 0; index < 8192; index++) {
    wrapText(`cache-test-${index}`, 5, "truncate-end");
  }

  expect(wrapTextCache.has(cacheKey)).toBe(false);
});
