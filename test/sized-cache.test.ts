import { expect, test } from "vite-plus/test";

import { SizedCache } from "#/sized-cache.ts";

// With a max size of 16, generations rotate at 8 and entries above 2 are refused.
const createCache = () => new SizedCache<string, number>(16);

test("returns stored values", () => {
  const cache = createCache();
  cache.set("a", 1, 1);
  expect(cache.get("a")).toBe(1);
  expect(cache.get("b")).toBeUndefined();
});

test("keeps entries from the previous generation and promotes them on read", () => {
  const cache = createCache();
  cache.set("kept", 1, 2);
  cache.set("filler-1", 2, 2);
  cache.set("filler-2", 3, 2);
  cache.set("filler-3", 4, 2); // Rotates: everything above is now previous.

  expect(cache.get("kept")).toBe(1);

  // Fill and rotate again. Only the promoted entry survives.
  cache.set("filler-4", 5, 2);
  cache.set("filler-5", 6, 2);
  cache.set("filler-6", 7, 2);
  expect(cache.get("kept")).toBe(1);
  expect(cache.get("filler-1")).toBeUndefined();
});

test("evicts entries after two rotations without reads", () => {
  const cache = createCache();
  cache.set("first", 1, 2);
  for (let index = 0; index < 8; index++) {
    cache.set(`filler-${index}`, index, 2);
  }

  expect(cache.get("first")).toBeUndefined();
});

test("refuses entries larger than an eighth of the max size", () => {
  const cache = createCache();
  cache.set("small", 1, 1);
  cache.set("large", 2, 3);
  expect(cache.get("large")).toBeUndefined();
  expect(cache.get("small")).toBe(1);
});

test("replacing a key does not count its old size", () => {
  const cache = createCache();
  cache.set("kept", 1, 2);
  for (let index = 0; index < 10; index++) {
    cache.set("replaced", index, 2);
  }

  // Counting every replacement would have rotated twice and dropped `kept`.
  expect(cache.get("kept")).toBe(1);
  expect(cache.get("replaced")).toBe(9);
});

test("reports and clears entries from both generations", () => {
  const cache = createCache();
  cache.set("previous", 1, 2);
  cache.set("filler-1", 2, 2);
  cache.set("filler-2", 3, 2);
  cache.set("filler-3", 4, 2);
  cache.set("current", 5, 2);

  expect(cache.has("previous")).toBe(true);
  expect(cache.has("current")).toBe(true);
  expect(cache.has("missing")).toBe(false);

  cache.clear();
  expect(cache.has("previous")).toBe(false);
  expect(cache.has("current")).toBe(false);
});
