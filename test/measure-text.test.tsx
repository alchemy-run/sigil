import { expect, test } from "vite-plus/test";

import { measureText } from "#/measure-text.ts";

test("measure single word", () => {
  expect(measureText("constructor")).toEqual({ width: 11, height: 1 });
});

test("measure empty string", () => {
  expect(measureText("")).toEqual({ width: 0, height: 0 });
});

test("measure multiline text", () => {
  const result = measureText("hello\nworld");
  expect(result.width).toBe(5);
  expect(result.height).toBe(2);
});

test("measure multiline text with varying line lengths", () => {
  const result = measureText("a\nfoo\nhi");
  expect(result.width).toBe(3);
  expect(result.height).toBe(3);
});

test("measure text with trailing newline", () => {
  const result = measureText("hello\n");
  expect(result.width).toBe(5);
  expect(result.height).toBe(2);
});

test("measure text with only newlines", () => {
  const result = measureText("\n\n");
  expect(result.width).toBe(0);
  expect(result.height).toBe(3);
});

test("returns cached result on repeated calls", () => {
  const first = measureText("cached-test");
  expect(first.width).toBe(11);
  expect(first.height).toBe(1);
  const second = measureText("cached-test");
  expect(first).toBe(second);
});

test("evicts old cached results", () => {
  const first = measureText("eviction-test-first");

  for (let index = 0; index < 8192; index++) {
    measureText(`eviction-test-${index}`);
  }

  const second = measureText("eviction-test-first");
  expect(first).not.toBe(second);
});

test("measure text with ANSI escape sequences", () => {
  const result = measureText("\u001B[31mred\u001B[0m");
  expect(result.width).toBe(3);
  expect(result.height).toBe(1);
});

test("measure text with 256-color ANSI", () => {
  const result = measureText("\u001B[38;5;196mred\u001B[0m");
  expect(result.width).toBe(3);
  expect(result.height).toBe(1);
});

test("measure text with wide characters", () => {
  const result = measureText("你好");
  expect(result.width).toBe(4);
  expect(result.height).toBe(1);
});

test("measure text with emoji", () => {
  const result = measureText("🍔");
  expect(result.width).toBe(2);
  expect(result.height).toBe(1);
});

test("measure multiline with wide characters", () => {
  const result = measureText("🍔🍟\nabc");
  expect(result.width).toBe(4);
  expect(result.height).toBe(2);
});
