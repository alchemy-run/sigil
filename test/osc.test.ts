import { expect, test } from "vite-plus/test";

import { OSC, ST } from "#/ansi/escapes.ts";
import {
  clearClipboard,
  notify,
  queryClipboard,
  setClipboard,
  setPointerShape,
  setTerminalProgress,
  setWindowTitle,
  setWorkingDirectory,
  tmuxPassthrough,
} from "#/ansi/osc.ts";

test("builds OSC 52 clipboard operations", () => {
  expect(setClipboard("hello 👋")).toBe(`${OSC}52;c;aGVsbG8g8J+Riw==${ST}`);
  expect(queryClipboard("primary")).toBe(`${OSC}52;p;?${ST}`);
  expect(clearClipboard("selection")).toBe(`${OSC}52;s;${ST}`);
});

test("builds terminal progress states and clamps percentages", () => {
  expect(setTerminalProgress("normal", 42.4)).toBe(`${OSC}9;4;1;42${ST}`);
  expect(setTerminalProgress("normal", 200)).toBe(`${OSC}9;4;1;100${ST}`);
  expect(setTerminalProgress("error")).toBe(`${OSC}9;4;2${ST}`);
  expect(setTerminalProgress("indeterminate")).toBe(`${OSC}9;4;3${ST}`);
  expect(setTerminalProgress("inactive")).toBe(`${OSC}9;4;0${ST}`);
});

test("builds common safe OSC integrations", () => {
  expect(setWindowTitle("build\u001B]2;injected")).toBe(`${OSC}2;build]2;injected${ST}`);
  expect(notify("9;collision")).toBe(`${OSC}9; 9;collision${ST}`);
  expect(setPointerShape("pointer")).toBe(`${OSC}22;pointer${ST}`);
  expect(setWorkingDirectory("/tmp/a b")).toBe(`${OSC}7;file:///tmp/a%20b${ST}`);
});

test("wraps OSC sequences for tmux passthrough", () => {
  expect(tmuxPassthrough(`${OSC}52;c;YQ==${ST}`)).toBe(
    "\u001BPtmux;\u001B\u001B]52;c;YQ==\u001B\u001B\\\u001B\\",
  );
});
