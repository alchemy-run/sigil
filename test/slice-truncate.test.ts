import { test, expect } from "vite-plus/test";

import { sliceAnsi } from "#/ansi/slice.ts";
import { stringWidth } from "#/ansi/string-width.ts";
import { cliTruncate } from "#/ansi/truncate.ts";

// The style tokenizer behind sliceAnsi shares its escape grammar with
// sanitize-ansi (src/ansi-tokenizer.ts), so every sequence form Sigil
// preserves must slice without leaking parameters or counting them as
// visible columns.

const colonSgr = "A\u001B[38:2::255:100:0mcolorful\u001B[39mB";

test("sliceAnsi preserves colon-parameter SGR styling", () => {
  expect(sliceAnsi(colonSgr, 0, 5)).toBe("A\u001B[38:2::255:100:0mcolo\u001B[39m");
});

test("cliTruncate places the ellipsis inside colon-parameter SGR styling", () => {
  expect(cliTruncate(colonSgr, 6)).toBe("A\u001B[38:2::255:100:0mcolo…\u001B[39m");
});

test("stringWidth and sliceAnsi agree on colon-parameter SGR", () => {
  expect(stringWidth(colonSgr)).toBe(10);
});

test("sliceAnsi normalizes C1 SGR to 7-bit and pairs its close code", () => {
  const c1 = "A\u009B31mred\u009B39mB";

  expect(sliceAnsi(c1, 0, 4)).toBe("A\u001B[31mred\u001B[39m");
});

test("sliceAnsi normalizes C1 OSC hyperlinks to 7-bit", () => {
  const c1Link = "\u009D8;;https://example.com\u0007link\u009D8;;\u0007";

  expect(sliceAnsi(c1Link, 0, 3)).toBe("\u001B]8;;https://example.com\u0007lin\u001B]8;;\u0007");
});

test("sliceAnsi treats non-SGR CSI sequences as zero-width", () => {
  // Cursor movement codes are dropped from the slice output (only style
  // codes are re-emitted), but they must never count as visible columns.
  expect(sliceAnsi("A\u001B[2KB\u001B[1Ahi", 0, 3)).toBe("ABh");
});

test("sliceAnsi drops an unterminated OSC tail instead of showing its payload", () => {
  expect(sliceAnsi("ok\u001B]0;title-with-no-terminator", 0, 10)).toBe("ok");
});
