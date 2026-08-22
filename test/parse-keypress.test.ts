import { expect, test } from "vite-plus/test";

import { parseKeypress } from "#/parse-keypress.ts";

// Vt220-style Ctrl+F1–F4 (ESC [ 1 ; 5 P/Q/R/S)
test('Ctrl+F1 resolves to name "f1"', () => {
  const key = parseKeypress("\u001B[1;5P");
  expect(key.name).toBe("f1");
  expect(key.ctrl).toBe(true);
  expect(key.shift).toBe(false);
  expect(key.meta).toBe(false);
});

test('Ctrl+F2 resolves to name "f2"', () => {
  const key = parseKeypress("\u001B[1;5Q");
  expect(key.name).toBe("f2");
  expect(key.ctrl).toBe(true);
});

test('Ctrl+F3 resolves to name "f3"', () => {
  const key = parseKeypress("\u001B[1;5R");
  expect(key.name).toBe("f3");
  expect(key.ctrl).toBe(true);
});

test('Ctrl+F4 resolves to name "f4"', () => {
  const key = parseKeypress("\u001B[1;5S");
  expect(key.name).toBe("f4");
  expect(key.ctrl).toBe(true);
});

// Unmapped codes fall back to empty string
test("unmapped ctrl sequence returns empty name", () => {
  const key = parseKeypress("\u001B[1;5I");
  expect(key.name).toBe("");
  expect(key.ctrl).toBe(true);
});

test("another unmapped ctrl sequence returns empty name", () => {
  const key = parseKeypress("\u001B[1;5X");
  expect(key.name).toBe("");
  expect(key.ctrl).toBe(true);
});

// Shift+F1 (modifier 2) uses the same [P mapping
test('Shift+F1 resolves to name "f1" with shift', () => {
  const key = parseKeypress("\u001B[1;2P");
  expect(key.name).toBe("f1");
  expect(key.shift).toBe(true);
  expect(key.ctrl).toBe(false);
});
