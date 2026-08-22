import { expect, test } from "vite-plus/test";

import { ansiEscapes } from "#/ansi/escapes.ts";
import {
  cursorPositionChanged,
  buildCursorSuffix,
  buildReturnToBottom,
  buildCursorOnlySequence,
  buildReturnToBottomPrefix,
} from "#/cursor-position.ts";

const showCursorEscape = "\u001B[?25h";
const hideCursorEscape = "\u001B[?25l";

// CursorPositionChanged

test("cursorPositionChanged - both undefined returns false", () => {
  expect(cursorPositionChanged(undefined, undefined)).toBe(false);
});

test("cursorPositionChanged - same position returns false", () => {
  expect(cursorPositionChanged({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(false);
});

test("cursorPositionChanged - different x returns true", () => {
  expect(cursorPositionChanged({ x: 1, y: 2 }, { x: 3, y: 2 })).toBe(true);
});

test("cursorPositionChanged - different y returns true", () => {
  expect(cursorPositionChanged({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(true);
});

test("cursorPositionChanged - undefined vs defined returns true", () => {
  expect(cursorPositionChanged(undefined, { x: 0, y: 0 })).toBe(true);
  expect(cursorPositionChanged({ x: 0, y: 0 }, undefined)).toBe(true);
});

// BuildCursorSuffix

test("buildCursorSuffix - returns empty string when cursorPosition is undefined", () => {
  expect(buildCursorSuffix(3, undefined)).toBe("");
});

test("buildCursorSuffix - moves up and positions cursor", () => {
  const result = buildCursorSuffix(3, { x: 5, y: 1 });
  expect(result).toBe(ansiEscapes.cursorUp(2) + ansiEscapes.cursorTo(5) + showCursorEscape);
});

test("buildCursorSuffix - no cursorUp when cursor is at last visible line", () => {
  const result = buildCursorSuffix(3, { x: 0, y: 3 });
  expect(result).toBe(ansiEscapes.cursorTo(0) + showCursorEscape);
});

test("buildCursorSuffix - cursor at first line of single-line output", () => {
  const result = buildCursorSuffix(1, { x: 4, y: 0 });
  expect(result).toBe(ansiEscapes.cursorUp(1) + ansiEscapes.cursorTo(4) + showCursorEscape);
});

// BuildReturnToBottom

test("buildReturnToBottom - returns empty string when previousCursorPosition is undefined", () => {
  expect(buildReturnToBottom(4, undefined)).toBe("");
});

test("buildReturnToBottom - moves down to bottom", () => {
  const result = buildReturnToBottom(4, { x: 5, y: 0 });
  expect(result).toBe(ansiEscapes.cursorDown(3) + ansiEscapes.cursorTo(0));
});

test("buildReturnToBottom - no cursorDown when cursor already at bottom", () => {
  const result = buildReturnToBottom(4, { x: 0, y: 3 });
  expect(result).toBe(ansiEscapes.cursorTo(0));
});

// BuildCursorOnlySequence

test("buildCursorOnlySequence - builds full sequence with hide prefix when cursor was shown", () => {
  const result = buildCursorOnlySequence({
    cursorWasShown: true,
    previousLineCount: 2,
    previousCursorPosition: { x: 0, y: 0 },
    cursorPosition: { x: 3, y: 0 },
  });
  const expected =
    hideCursorEscape +
    buildReturnToBottom(2, { x: 0, y: 0 }) +
    buildCursorSuffix(1, { x: 3, y: 0 });
  expect(result).toBe(expected);
});

test("buildCursorOnlySequence - no hide prefix when cursor was not shown", () => {
  const result = buildCursorOnlySequence({
    cursorWasShown: false,
    previousLineCount: 0,
    previousCursorPosition: undefined,
    cursorPosition: { x: 3, y: 0 },
  });
  expect(result.startsWith(hideCursorEscape)).toBe(false);
  expect(result).toContain(showCursorEscape);
});

// BuildReturnToBottomPrefix

test("buildReturnToBottomPrefix - returns empty string when cursor was not shown", () => {
  expect(buildReturnToBottomPrefix(false, 4, { x: 0, y: 0 })).toBe("");
});

test("buildReturnToBottomPrefix - returns hide + returnToBottom when cursor was shown", () => {
  const result = buildReturnToBottomPrefix(true, 4, { x: 0, y: 0 });
  expect(result).toBe(hideCursorEscape + buildReturnToBottom(4, { x: 0, y: 0 }));
});

test("buildReturnToBottomPrefix - with undefined previousCursorPosition still hides cursor", () => {
  const result = buildReturnToBottomPrefix(true, 4, undefined);
  expect(result).toBe(hideCursorEscape + buildReturnToBottom(4, undefined));
});
