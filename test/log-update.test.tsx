import { expect, test } from "vite-plus/test";

import { ansiEscapes } from "#/ansi/escapes.ts";
import { logUpdate } from "#/log-update.ts";

import createStdout from "./helpers/create-stdout.ts";

test("standard rendering - renders and updates output", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, { showCursor: true });

  render("Hello\n");
  expect(stdout.write.mock.calls.length).toBe(1);
  expect(stdout.write.mock.calls[0][0]).toBe("Hello\n");

  render("World\n");
  expect(stdout.write.mock.calls.length).toBe(2);
  expect(stdout.write.mock.calls[1][0]).toContain("World");
});

test("standard rendering - skips identical output", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, { showCursor: true });

  render("Hello\n");
  render("Hello\n");

  expect(stdout.write.mock.calls.length).toBe(1);
});

test("incremental rendering - renders and updates output", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("Hello\n");
  expect(stdout.write.mock.calls.length).toBe(1);
  expect(stdout.write.mock.calls[0][0]).toBe("Hello\n");

  render("World\n");
  expect(stdout.write.mock.calls.length).toBe(2);
  expect(stdout.write.mock.calls[1][0]).toContain("World");
});

test("incremental rendering - skips identical output", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("Hello\n");
  render("Hello\n");

  expect(stdout.write.mock.calls.length).toBe(1);
});

test("incremental rendering - surgical updates", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("Line 1\nLine 2\nLine 3\n");
  render("Line 1\nUpdated\nLine 3\n");

  const secondCall = stdout.write.mock.calls[1][0];
  expect(secondCall).toContain(ansiEscapes.cursorNextLine); // Skips unchanged lines
  expect(secondCall).toContain("Updated"); // Only updates changed line
  expect(secondCall).not.toContain("Line 1"); // Doesn't rewrite unchanged
  expect(secondCall).not.toContain("Line 3"); // Doesn't rewrite unchanged
});

test("incremental rendering - same-height update rewinds cursor to top with trailing newline", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("Line 1\nLine 2\nLine 3\n");
  render("Line 1\nUpdated\nLine 3\n");

  const secondCall = stdout.write.mock.calls[1][0];
  // Output ends with '\n', so split('\n') gives ["Line 1","Line 2","Line 3",""]
  // (length 4). After writing, cursor is on row 3 (the empty row past last
  // visible line). cursorUp must be 3 (= 4 - 1) to reach row 0.
  // Using visibleLineCount - 1 (= 2) would only reach row 1, leaving row 0
  // as a ghost line.
  expect(secondCall.startsWith(ansiEscapes.cursorUp(3))).toBe(true);
});

test("incremental rendering - clears extra lines when output shrinks", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("Line 1\nLine 2\nLine 3\n");
  render("Line 1\n");

  const secondCall = stdout.write.mock.calls[1][0];
  expect(secondCall).toContain(ansiEscapes.eraseLines(2)); // Erases 2 extra lines
});

test("incremental rendering - when output grows", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("Line 1\n");
  render("Line 1\nLine 2\nLine 3\n");

  // A frame that grew is rewritten in full: skipping unchanged lines with
  // cursorNextLine clamps at the bottom margin instead of scrolling, which
  // desynchronizes the tracked cursor position when the grown frame reaches
  // the bottom of the terminal.
  const secondCall = stdout.write.mock.calls[1][0];
  expect(secondCall).toContain(ansiEscapes.eraseLines(2)); // Erases the previous frame
  expect(secondCall).toContain("Line 1"); // Rewrites the whole frame
  expect(secondCall).toContain("Line 2");
  expect(secondCall).toContain("Line 3");
  expect(secondCall).not.toContain(ansiEscapes.cursorNextLine); // No incremental walk
});

test("incremental rendering - single write call with multiple surgical updates", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10\n");
  render(
    "Line 1\nUpdated 2\nLine 3\nUpdated 4\nLine 5\nUpdated 6\nLine 7\nUpdated 8\nLine 9\nUpdated 10\n",
  );

  expect(stdout.write.mock.calls.length).toBe(2); // Only 2 writes total (initial + update)
});

test("incremental rendering - shrinking output keeps screen tight", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("Line 1\nLine 2\nLine 3\n");
  render("Line 1\nLine 2\n");
  render("Line 1\n");

  const thirdCall = stdout.get();

  expect(thirdCall).toBe(
    ansiEscapes.eraseLines(2) + // Erase Line 2 and ending cursorNextLine
      ansiEscapes.cursorUp(1) + // Move to beginning of Line 1
      ansiEscapes.cursorNextLine,
  );
});

test("incremental rendering - clear() fully resets incremental state", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("Line 1\nLine 2\nLine 3\n");
  render.clear();
  render("Line 1\n");

  const afterClear = stdout.get();

  expect(afterClear).toBe(ansiEscapes.eraseLines(0) + "Line 1\n"); // Should do a fresh write
});

test("incremental rendering - done() resets before next render", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("Line 1\nLine 2\nLine 3\n");
  render.done();
  render("Line 1\n");

  const afterDone = stdout.get();

  expect(afterDone).toBe(ansiEscapes.eraseLines(0) + "Line 1\n"); // Should do a fresh write
});

test("incremental rendering - multiple consecutive clear() calls (should be harmless no-ops)", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("Line 1\nLine 2\nLine 3\n");
  render.clear();
  render.clear();
  render.clear();

  expect(stdout.write.mock.calls.length).toBe(4); // Initial render + 3 clears (each writes eraseLines)

  // Verify state is properly reset after multiple clears
  render("New content\n");
  const afterClears = stdout.get();
  expect(afterClears).toBe(ansiEscapes.eraseLines(0) + "New content\n"); // Should do a fresh write
});

test("incremental rendering - sync() followed by update (assert incremental path is used)", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render.sync("Line 1\nLine 2\nLine 3\n");
  expect(stdout.write.mock.calls.length).toBe(0); // The sync() call shouldn't write to stdout

  render("Line 1\nUpdated\nLine 3\n");
  expect(stdout.write.mock.calls.length).toBe(1);

  const firstCall = stdout.write.mock.calls[0][0];
  expect(firstCall).toContain(ansiEscapes.cursorNextLine); // Skips unchanged lines
  expect(firstCall).toContain("Updated"); // Only updates changed line
  expect(firstCall).not.toContain("Line 1"); // Doesn't rewrite unchanged
  expect(firstCall).not.toContain("Line 3"); // Doesn't rewrite unchanged
});

// Cursor positioning tests

const showCursorEscape = "\u001B[?25h";
const hideCursorEscape = "\u001B[?25l";

const renderingModes = [
  { name: "standard rendering", incremental: false },
  { name: "incremental rendering", incremental: true },
] as const;

const createRenderForMode = (incremental: boolean) => {
  const stdout = createStdout();
  const render = incremental
    ? logUpdate.create(stdout, { showCursor: true, incremental: true })
    : logUpdate.create(stdout, { showCursor: true });
  return { stdout, render };
};

test("standard rendering - positions cursor after output when cursorPosition is set", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, { showCursor: true });

  render.setCursorPosition({ x: 5, y: 1 });
  render("Line 1\nLine 2\nLine 3\n");

  const written = stdout.write.mock.calls[0][0];
  // Output is "Line 1\nLine 2\nLine 3\n" (3 visible lines)
  // Cursor after write is at line 3 (0-indexed), col 0
  // To reach y=1: cursorUp(3 - 1) = cursorUp(2)
  // Then cursorTo(5) and show cursor
  expect(written).toContain("Line 3");
  expect(
    written.endsWith(ansiEscapes.cursorUp(2) + ansiEscapes.cursorTo(5) + showCursorEscape),
  ).toBe(true);
});

test("standard rendering - hides cursor before erase when cursor was previously shown", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, { showCursor: true });

  render.setCursorPosition({ x: 0, y: 0 });
  render("Hello\n");
  render.setCursorPosition({ x: 0, y: 0 });
  render("World\n");

  const secondCall = stdout.write.mock.calls[1][0];
  // Should start with hide cursor before erasing
  expect(secondCall.startsWith(hideCursorEscape)).toBe(true);
  // Should end with show cursor at position
  expect(
    secondCall.endsWith(ansiEscapes.cursorUp(1) + ansiEscapes.cursorTo(0) + showCursorEscape),
  ).toBe(true);
});

test("standard rendering - no cursor positioning when cursorPosition is undefined", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, { showCursor: true });

  render("Hello\n");

  const written = stdout.write.mock.calls[0][0];
  expect(written).not.toContain(showCursorEscape);
});

test("standard rendering - cursor position at second-to-last line emits cursorUp(1)", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, { showCursor: true });

  render.setCursorPosition({ x: 3, y: 2 });
  render("Line 1\nLine 2\nLine 3\n");

  const written = stdout.write.mock.calls[0][0];
  // Output has 3 visible lines. After write, cursor is at line 3 (past last visible).
  // To reach y=2: cursorUp(3 - 2) = cursorUp(1)
  expect(
    written.endsWith(ansiEscapes.cursorUp(1) + ansiEscapes.cursorTo(3) + showCursorEscape),
  ).toBe(true);
});

for (const { name, incremental } of renderingModes) {
  test(`${name} - clear() returns cursor to bottom before erasing`, () => {
    const { stdout, render } = createRenderForMode(incremental);

    render.setCursorPosition({ x: 5, y: 0 });
    render("Line 1\nLine 2\nLine 3\n");

    render.clear();

    const clearCall = stdout.write.mock.calls[1][0];
    // Cursor was at y=0, output had 4 lines (3 visible + trailing newline).
    // clear() should: hide cursor, move down to bottom (from y=0 to line 3), then erase
    expect(clearCall).toContain(hideCursorEscape);
    expect(clearCall).toContain(ansiEscapes.cursorDown(3));
    expect(clearCall).toContain(ansiEscapes.eraseLines(4));
  });
}

test("standard rendering - clearing cursor position stops cursor positioning", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, { showCursor: true });

  render.setCursorPosition({ x: 0, y: 0 });
  render("Hello\n");

  render.setCursorPosition(undefined);
  render("World\n");

  const secondCall = stdout.write.mock.calls[1][0];
  expect(secondCall).not.toContain(showCursorEscape);
});

test("incremental rendering - positions cursor after surgical updates", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render.setCursorPosition({ x: 5, y: 1 });
  render("Line 1\nLine 2\nLine 3\n");

  const written = stdout.write.mock.calls[0][0];
  // After incremental write, cursor is at line 3 (past last visible)
  // To reach y=1: cursorUp(3 - 1) = cursorUp(2)
  expect(
    written.endsWith(ansiEscapes.cursorUp(2) + ansiEscapes.cursorTo(5) + showCursorEscape),
  ).toBe(true);
});

test("incremental rendering - positions cursor after update", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render.setCursorPosition({ x: 2, y: 0 });
  render("Line 1\nLine 2\nLine 3\n");
  render.setCursorPosition({ x: 2, y: 0 });
  render("Line 1\nUpdated\nLine 3\n");

  const secondCall = stdout.write.mock.calls[1][0];
  // After incremental update, cursor is at line 3
  // To reach y=0: cursorUp(3)
  expect(
    secondCall.endsWith(ansiEscapes.cursorUp(3) + ansiEscapes.cursorTo(2) + showCursorEscape),
  ).toBe(true);
});

for (const { name, incremental } of renderingModes) {
  test(`${name} - repositions cursor when only cursor position changes (same output)`, () => {
    const { stdout, render } = createRenderForMode(incremental);

    render.setCursorPosition({ x: 2, y: 0 });
    render("Hello\n");
    expect(stdout.write.mock.calls.length).toBe(1);

    // Same output, but cursor moved (simulates space input where output is padded identically)
    render.setCursorPosition({ x: 3, y: 0 });
    render("Hello\n");

    expect(stdout.write.mock.calls.length).toBe(2);
    const secondCall = stdout.write.mock.calls[1][0];
    // Should reposition cursor: hide + return to bottom + move to new position + show
    expect(secondCall).toContain(showCursorEscape);
    expect(secondCall.endsWith(ansiEscapes.cursorTo(3) + showCursorEscape)).toBe(true);
  });
}

test("standard rendering - returns to bottom before erase when cursor was positioned", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, { showCursor: true });

  render.setCursorPosition({ x: 0, y: 0 });
  render("Line 1\nLine 2\nLine 3\n");

  render.setCursorPosition({ x: 5, y: 0 });
  render("Line A\nLine B\nLine C\n");

  const secondCall = stdout.write.mock.calls[1][0];
  // Should: hide cursor, move down to bottom (from y=0 to line 3), then erase + rewrite
  expect(secondCall.startsWith(hideCursorEscape)).toBe(true);
  expect(secondCall).toContain(ansiEscapes.cursorDown(3));
  expect(secondCall).toContain("Line A");
});

for (const { name, incremental } of renderingModes) {
  test(`${name} - sync() resets cursor state`, () => {
    const { stdout, render } = createRenderForMode(incremental);

    render.setCursorPosition({ x: 5, y: 0 });
    render("Line 1\nLine 2\nLine 3\n");

    // Sync() simulates clearTerminal path: screen is fully reset
    render.sync("Fresh output\n");

    // Next render should NOT include hideCursor + cursorDown (return-to-bottom prefix)
    // because sync() should have reset previousCursorPosition and cursorWasShown
    render("Updated output\n");

    const afterSync = stdout.get();
    expect(afterSync).not.toContain(hideCursorEscape);
    expect(afterSync).not.toContain(ansiEscapes.cursorDown(3));
  });
}

for (const { name, incremental } of renderingModes) {
  test(`${name} - sync() writes cursor suffix when cursor is dirty`, () => {
    const { stdout, render } = createRenderForMode(incremental);

    render.setCursorPosition({ x: 5, y: 1 });
    render.sync("Line 1\nLine 2\nLine 3\n");

    // Sync() should write cursor suffix to position cursor
    // 3 visible lines, cursor at y=1 → cursorUp(3-1) = cursorUp(2)
    expect(stdout.write.mock.calls.length).toBe(1);
    const written = stdout.write.mock.calls[0][0];
    expect(written).toBe(ansiEscapes.cursorUp(2) + ansiEscapes.cursorTo(5) + showCursorEscape);
  });
}

for (const { name, incremental } of renderingModes) {
  test(`${name} - sync() with no trailing newline positions cursor from the last line`, () => {
    const { stdout, render } = createRenderForMode(incremental);

    render.setCursorPosition({ x: 5, y: 1 });
    render.sync("Line 1\nLine 2\nLine 3");

    // 3 visible lines without a trailing newline, so the cursor is on line 2.
    // To reach y=1: cursorUp(2 - 1) = cursorUp(1).
    expect(stdout.write.mock.calls.length).toBe(1);
    const written = stdout.write.mock.calls[0][0];
    expect(written).toBe(ansiEscapes.cursorUp(1) + ansiEscapes.cursorTo(5) + showCursorEscape);
  });
}

for (const { name, incremental } of renderingModes) {
  test(`${name} - sync() with cursor sets cursorWasShown for next render`, () => {
    const { stdout, render } = createRenderForMode(incremental);

    render.setCursorPosition({ x: 5, y: 1 });
    render.sync("Line 1\nLine 2\nLine 3\n");

    // Next render should hide cursor before erasing (cursorWasShown = true from sync)
    render("Updated\n");

    const renderCall = stdout.get();
    expect(renderCall.startsWith(hideCursorEscape)).toBe(true);
  });
}

for (const { name, incremental } of renderingModes) {
  test(`${name} - sync() hides cursor when previous render showed cursor`, () => {
    const { stdout, render } = createRenderForMode(incremental);

    render.setCursorPosition({ x: 5, y: 1 });
    render("Line 1\nLine 2\nLine 3\n");
    expect(stdout.write.mock.calls.length).toBe(1);

    render.sync("Fresh output\n");

    expect(stdout.write.mock.calls.length).toBe(2);
    expect(stdout.write.mock.calls[1][0]).toBe(hideCursorEscape);
  });
}

test("standard rendering - sync() without cursor does not write to stream", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, { showCursor: true });

  render.sync("Line 1\nLine 2\nLine 3\n");

  expect(stdout.write.mock.calls.length).toBe(0);
});

// No-trailing-newline tests (fullscreen mode)

test("incremental rendering - no trailing newline: trailing to no-trailing transition", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("A\nB\n");
  render("A\nB");

  const secondCall = stdout.write.mock.calls[1][0];
  // Both lines are unchanged, so only cursor movement should occur.
  // The key is that the cursor does NOT overshoot past line B.
  expect(secondCall).toContain(ansiEscapes.cursorNextLine); // Skip unchanged A
  expect(secondCall.endsWith("\n")).toBe(false); // No trailing newline in output
});

test("incremental rendering - no trailing newline: no-trailing to no-trailing update", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("A\nB");
  render("A\nC");

  const secondCall = stdout.write.mock.calls[1][0];
  expect(secondCall).toContain(ansiEscapes.cursorNextLine); // Skip unchanged A
  expect(secondCall).toContain("C"); // Updates B to C
  expect(secondCall.endsWith("\n")).toBe(false); // No trailing newline
});

test("incremental rendering - no trailing newline: shrink", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("A\nB");
  render("A");

  const secondCall = stdout.write.mock.calls[1][0];
  // Should erase 1 extra line (B), not over-erase A
  // previousVisible=2, visibleCount=1, no trailing newline -> eraseLines(2-1+0) = eraseLines(1)
  expect(secondCall).toContain(ansiEscapes.eraseLines(1));
  expect(secondCall.endsWith("\n")).toBe(false); // No trailing newline
});

test("incremental rendering - no trailing newline: cursor after shrink", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render.setCursorPosition({ x: 2, y: 0 });
  render("Line 1\nLine 2\nLine 3");
  render.setCursorPosition({ x: 2, y: 0 });
  render("Line 1\nLine 2");

  // The shrink branch reaches the cursor suffix through different arithmetic
  // than the grow/equal branch: eraseLines() + cursorUp(visibleCount) rather
  // than cursorUp(previousLines.length - 1). Both must leave the cursor on
  // the same row the suffix measures from.
  //
  // eraseLines(1) removes "Line 3" without moving off its row, cursorUp(2)
  // lands on row 0, and the loop emits one cursorNextLine for the unchanged
  // "Line 1" and nothing for the unchanged last line, so the cursor ends on
  // row 1 — which is nextLines.length - 1. To reach y=0: cursorUp(1).
  const secondCall = stdout.write.mock.calls[1][0];
  expect(
    secondCall.endsWith(ansiEscapes.cursorUp(1) + ansiEscapes.cursorTo(2) + showCursorEscape),
  ).toBe(true);
});

test("incremental rendering - no trailing newline: grow", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("A");
  render("A\nB\nC");

  const secondCall = stdout.write.mock.calls[1][0];
  expect(secondCall).toContain("B"); // New line B
  expect(secondCall).toContain("C"); // New line C
  expect(secondCall.endsWith("\n")).toBe(false); // No trailing newline
});

test("incremental rendering - no trailing newline: unchanged lines do not overshoot cursor", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("A\nB");
  render("A\nB"); // Identical - should be skipped entirely

  expect(stdout.write.mock.calls.length).toBe(1); // No second write (identical)

  // Now change only the first line
  render("X\nB");

  const thirdCall = stdout.write.mock.calls[1][0];
  // Should write X with newline to advance to B's line, then skip B.
  // The buffer ends with the \n that moves to B's line, but no extra
  // cursorNextLine past B -- the cursor stays on the last visible line.
  expect(thirdCall).toContain("X");
  // Verify no cursorNextLine appears after B's position (B is unchanged
  // and last, so no cursor movement is emitted for it)
  const lastCursorNextLine = thirdCall.lastIndexOf(ansiEscapes.cursorNextLine);
  expect(lastCursorNextLine).toBe(-1); // No cursorNextLine at all since A is changed (written) not skipped
});

test("incremental rendering - no trailing newline: cursor lands on the target line", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render.setCursorPosition({ x: 7, y: 1 });
  render("Line 1\nLine 2\nLine 3\nLine 4");

  // The first render takes the `previousOutput.length === 0` branch, which
  // Ink reaches whenever useStdout().write() clears and restores the frame.
  const firstCall = stdout.write.mock.calls[0][0];
  expect(
    firstCall.endsWith(ansiEscapes.cursorUp(2) + ansiEscapes.cursorTo(7) + showCursorEscape),
  ).toBe(true);

  render.setCursorPosition({ x: 7, y: 1 });
  render("Line 1\nLine 2!\nLine 3\nLine 4");

  const secondCall = stdout.write.mock.calls[1][0];
  // 4 visible lines without a trailing newline, so the renderer leaves the
  // cursor on line 3. To reach y=1: cursorUp(3 - 1) = cursorUp(2).
  expect(
    secondCall.endsWith(ansiEscapes.cursorUp(2) + ansiEscapes.cursorTo(7) + showCursorEscape),
  ).toBe(true);
});

test("standard rendering - no trailing newline: cursor lands on the target line", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, { showCursor: true });

  render.setCursorPosition({ x: 7, y: 1 });
  render("Line 1\nLine 2\nLine 3\nLine 4");

  const written = stdout.write.mock.calls[0][0];
  expect(
    written.endsWith(ansiEscapes.cursorUp(2) + ansiEscapes.cursorTo(7) + showCursorEscape),
  ).toBe(true);
});

for (const { name, incremental } of renderingModes) {
  test(`${name} - cursor-only update with no trailing newline lands on the target line`, () => {
    const { stdout, render } = createRenderForMode(incremental);

    render.setCursorPosition({ x: 0, y: 3 });
    render("Line 1\nLine 2\nLine 3\nLine 4");
    // Same output, cursor moves only: takes the buildCursorOnlySequence path.
    render.setCursorPosition({ x: 5, y: 0 });
    render("Line 1\nLine 2\nLine 3\nLine 4");

    const secondCall = stdout.write.mock.calls[1][0];
    expect(
      secondCall.endsWith(ansiEscapes.cursorUp(3) + ansiEscapes.cursorTo(5) + showCursorEscape),
    ).toBe(true);
  });
}

test("incremental rendering - render to empty string (full clear vs early exit)", () => {
  const stdout = createStdout();
  const render = logUpdate.create(stdout, {
    showCursor: true,
    incremental: true,
  });

  render("Line 1\nLine 2\nLine 3\n");
  render("\n");

  expect(stdout.write.mock.calls.length).toBe(2);
  const secondCall = stdout.write.mock.calls[1][0];
  expect(secondCall).toBe(ansiEscapes.eraseLines(4) + "\n"); // Erases all 4 lines + writes single newline

  // Rendering empty string again should be skipped (identical output)
  render("\n");
  expect(stdout.write.mock.calls.length).toBe(2); // No additional write
});
