import { ansiEscapes, stripAnsi } from "@alchemy.run/sigil/ansi";
import { expect, test } from "vite-plus/test";

import { reconstructTerminalLines } from "../../test/helpers/reconstruct-terminal.ts";
import termHelper from "./helpers/term.ts";

// Sigil's full-clear sequence (internal to its renderer).
const homeAndEraseDown = ansiEscapes.cursorTo(0, 0) + ansiEscapes.eraseDown;

const countOccurrences = (text: string, searchValue: string): number => {
  if (searchValue === "") {
    return 0;
  }

  return text.split(searchValue).length - 1;
};

const getIssue450ControlSequenceCounts = (output: string) => ({
  fullClearCount: countOccurrences(output, homeAndEraseDown),
  eraseLineCount: countOccurrences(output, ansiEscapes.eraseLines(1)),
});

// All fixtures here go through the shared pty runner, with Synchronized
// Update Mode sequences stripped so assertions see content only.
const term = (
  fixture: string,
  args: string[] = [],
  options: { rows?: number; env?: Record<string, string> } = {},
) => termHelper(fixture, args, { ...options, stripSyncSequences: true });

type Issue450Fixture =
  | "issue-450-full-height-rerender"
  | "issue-450-full-height-rerender-with-marker"
  | "issue-450-height-minus-one-rerender"
  | "issue-450-full-height-with-static-rerender"
  | "issue-450-initial-overflow"
  | "issue-450-initial-fullscreen"
  | "issue-450-grow-to-fullscreen-rerender"
  | "issue-450-shrink-from-fullscreen-rerender"
  | "issue-450-shrink-from-overflow-rerender"
  | "issue-450-static-shrink-from-fullscreen-rerender"
  | "issue-969-windows-full-height-rerender"
  | "issue-935-overflow-rerender";

const runIssue450Fixture = async (fixture: Issue450Fixture, rows = 6): Promise<string> => {
  const processResult = term(fixture, [String(rows)]);
  await processResult.waitForExit();
  return processResult.output;
};

type Issue450FixtureResult = {
  output: string;
  fullClearCount: number;
  eraseLineCount: number;
};

const runIssue450FixtureWithCounts = async (
  fixture: Issue450Fixture,
  rows = 6,
): Promise<Issue450FixtureResult> => {
  const output = await runIssue450Fixture(fixture, rows);
  const { fullClearCount, eraseLineCount } = getIssue450ControlSequenceCounts(output);

  return {
    output,
    fullClearCount,
    eraseLineCount,
  };
};

const getOutputBeforeMarker = (output: string, marker: string): string => {
  const markerIndex = output.indexOf(marker);
  expect(markerIndex >= 0, `Fixture marker "${marker}" should be present`).toBe(true);
  return markerIndex >= 0 ? output.slice(0, markerIndex) : output;
};

const runIssue450FixtureBeforeMarker = async (
  fixture: Issue450Fixture,
  marker: string,
  rows = 6,
): Promise<string> => {
  const output = await runIssue450Fixture(fixture, rows);
  return getOutputBeforeMarker(output, marker);
};

const assertIssue450DynamicFrameOutput = (output: string): void => {
  expect(output, "Fixture should render multiple dynamic frames").toContain("frame 8");
};

test("do not erase screen", async () => {
  const ps = term("erase", ["4"]);
  await ps.waitForExit();
  expect(ps.output).not.toContain(homeAndEraseDown);

  for (const letter of ["A", "B", "C"]) {
    expect(ps.output).toContain(letter);
  }
});

test("do not erase screen where <Static> is taller than viewport", async () => {
  const ps = term("erase-with-static", ["4"]);

  await ps.waitForExit();
  expect(ps.output).not.toContain(homeAndEraseDown);

  for (const letter of ["A", "B", "C", "D", "E", "F"]) {
    expect(ps.output).toContain(letter);
  }
});

test("last line of <Static> survives overflowing live updates (related to #973)", async () => {
  const rows = 4;
  const ps = term("full-clear-static-accounting", [String(rows)], {
    rows,
  });
  await ps.waitForExit();

  // The raw stream still contains "F" even when it has been erased on screen,
  // so reconstruct the visible buffer (scrollback + viewport) and assert the
  // last committed <Static> line is actually still there.
  const visibleLines = reconstructTerminalLines(ps.output, rows).filter((line) => line.length > 0);

  // Positive control: "LIVE-0" only renders on the final live-region update —
  // the frame that performs the off-by-one erase. Without this guard, an early
  // exit (before that frame) would leave "F" trivially present and the test
  // would pass without ever exercising the bug.
  expect(
    visibleLines,
    `Expected the bug-triggering live-region update to have rendered, got ${JSON.stringify(
      visibleLines,
    )}`,
  ).toContain("LIVE-0");

  // Distinct-frame guards: if the three phases coalesced into fewer renders,
  // the assertions here would pass without exercising the accounting. Only
  // the inflate frame renders "live-4".
  expect(ps.output, "Expected the inflate phase to have rendered as its own frame").toContain(
    "live-4",
  );
  // Overflowing frames are clamped to the viewport now; the historical
  // full-clear path (whose accounting bug #973 tracked) must never fire,
  // since it erased the user's scrollback.
  expect(
    ps.output,
    "Overflowing updates must not route frames through the scrollback-erasing full clear",
  ).not.toContain(homeAndEraseDown);
  expect(
    ps.output.includes("live-0") && ps.output,
    "Expected the shrink and nudge phases to have rendered as separate frames",
  ).toContain("LIVE-0");

  expect(
    visibleLines,
    `Last static line (F) must remain visible after a live-region update, got ${JSON.stringify(
      visibleLines,
    )}`,
  ).toContain("F");
});

test("erase screen", async () => {
  const ps = term("erase", ["3"]);
  await ps.waitForExit();
  expect(ps.output).toContain(homeAndEraseDown);

  for (const letter of ["A", "B", "C"]) {
    expect(ps.output).toContain(letter);
  }
});

test("erase screen where <Static> exists but interactive part is taller than viewport", async () => {
  const ps = term("erase", ["3"]);
  await ps.waitForExit();
  expect(ps.output).toContain(homeAndEraseDown);

  for (const letter of ["A", "B", "C"]) {
    expect(ps.output).toContain(letter);
  }
});

test("erase screen where state changes", async () => {
  const ps = term("erase-with-state-change", ["4"]);
  await ps.waitForExit();

  // The final frame is between the last eraseLines sequence and cursorShow
  // Split on cursorShow to isolate the final rendered content before the cursor is shown
  const beforeCursorShow = ps.output.split(ansiEscapes.cursorShow)[0];
  if (!beforeCursorShow) {
    expect.fail("beforeCursorShow is undefined");
  }

  // Find the last occurrence of an eraseLines sequence
  // eraseLines(1) is the minimal erase pattern used by Ink
  const eraseLinesPattern = ansiEscapes.eraseLines(1);
  const lastEraseIndex = beforeCursorShow.lastIndexOf(eraseLinesPattern);

  const lastFrame =
    lastEraseIndex === -1
      ? beforeCursorShow
      : beforeCursorShow.slice(lastEraseIndex + eraseLinesPattern.length);

  const lastFrameContent = stripAnsi(lastFrame);

  for (const letter of ["A", "B", "C"]) {
    expect(lastFrameContent).not.toContain(letter);
  }
});

test("erase screen where state changes in small viewport", async () => {
  const rows = 3;
  const ps = term("erase-with-state-change", [String(rows)], { rows });
  await ps.waitForExit();

  // The frame exactly filled the viewport, which is erasable in place —
  // clearTerminal (and its ESC[3J scrollback erase) must not fire.
  expect(ps.output).not.toContain(homeAndEraseDown);

  const visibleLines = reconstructTerminalLines(ps.output, rows);
  for (const letter of ["A", "B", "C"]) {
    expect(visibleLines).not.toContain(letter);
  }
});

test("fullscreen mode should not add extra newline at the bottom", async () => {
  const ps = term("fullscreen-no-extra-newline", ["5"]);
  await ps.waitForExit();

  expect(ps.output).toContain("Bottom line");

  const lastFrame = ps.output.split(homeAndEraseDown).at(-1) ?? "";

  // Check that the bottom line is at the end without extra newlines
  // In a 5-line terminal:
  // Line 1: Fullscreen: top
  // Lines 2-4: empty (from flexGrow)
  // Line 5: Bottom line (should be usable)
  const lines = lastFrame.split("\n");

  expect(lines.length, "Should have exactly 5 lines for 5-row terminal").toBe(5);

  expect(lines[4]?.includes("Bottom line") ?? false, "Bottom line should be on line 5").toBe(true);
});

test("#442: full terminal-size box should not add an extra scroll line", async () => {
  const rows = 5;
  const ps = term("issue-442-full-height", [String(rows)]);
  await ps.waitForExit();

  const lastFrame = ps.output.split(homeAndEraseDown).at(-1) ?? "";
  const lastFrameContent = stripAnsi(lastFrame);
  const lines = lastFrameContent.split("\n");

  expect(
    lastFrameContent.endsWith("\n"),
    "Should not end with a trailing newline in fullscreen mode",
  ).toBe(false);
  expect(lines.length, "Should render exactly terminal row count without an extra line").toBe(rows);
  expect(lines.at(-1)?.includes("#442 bottom") ?? false).toBe(true);
});

test("#450: full-height rerenders should not repeatedly clear terminal", async () => {
  const { output, fullClearCount, eraseLineCount } = await runIssue450FixtureWithCounts(
    "issue-450-full-height-rerender",
  );

  assertIssue450DynamicFrameOutput(output);
  expect(
    fullClearCount <= 1,
    `Expected at most one full-clear sequence, received ${fullClearCount}`,
  ).toBe(true);
  expect(eraseLineCount > 0, "Expected incremental erase sequences for fullscreen rerenders").toBe(
    true,
  );
});

test("#969: full-height rerenders on Windows should clear terminal between frames", async () => {
  const output = await runIssue450Fixture("issue-969-windows-full-height-rerender");

  assertIssue450DynamicFrameOutput(output);
  // Windows consoles scroll when the bottom-right cell is written, which
  // breaks incremental erase for fullscreen frames. Each rerender must fall
  // back to a full clear there.
  const fullClearCount = countOccurrences(output, homeAndEraseDown);
  expect(
    fullClearCount >= 2,
    `Expected a full clear per fullscreen rerender, received ${fullClearCount}`,
  ).toBe(true);
});

test("#450: initial overflowing frame should not clear terminal", async () => {
  const renderedMarker = "__INITIAL_OVERFLOW_FRAME_RENDERED__";
  const outputBeforeMarker = await runIssue450FixtureBeforeMarker(
    "issue-450-initial-overflow",
    renderedMarker,
    3,
  );

  expect(outputBeforeMarker, "Initial overflowing render should not clear terminal").not.toContain(
    homeAndEraseDown,
  );
});

test("#450: initial full-height frame should not clear terminal", async () => {
  const renderedMarker = "__INITIAL_FULLSCREEN_FRAME_RENDERED__";
  const outputBeforeMarker = await runIssue450FixtureBeforeMarker(
    "issue-450-initial-fullscreen",
    renderedMarker,
    3,
  );

  expect(outputBeforeMarker, "Initial full-height render should not clear terminal").not.toContain(
    homeAndEraseDown,
  );
});

test("#450 control: rows - 1 rerenders should avoid clearTerminal", async () => {
  const { output, fullClearCount, eraseLineCount } = await runIssue450FixtureWithCounts(
    "issue-450-height-minus-one-rerender",
  );

  assertIssue450DynamicFrameOutput(output);
  expect(fullClearCount).toBe(0);
  expect(
    eraseLineCount > 0,
    "Expected incremental erase sequences for non-fullscreen rerenders",
  ).toBe(true);
});

test("#935: overflowing rerenders must not erase terminal scrollback", async () => {
  const rows = 6;
  const processResult = term("issue-935-overflow-rerender", [String(rows)], { rows });
  await processResult.waitForExit();
  const { output } = processResult;

  assertIssue450DynamicFrameOutput(output);
  // Sigil clamps overflowing frames to the viewport instead of taking the
  // full-clear path, but neither may touch the terminal's history. CSI 3J
  // erases scrollback and CSI 2J makes VS Code / Windows Terminal push the
  // viewport into scrollback before clearing.
  expect(output, "Must not emit CSI 3J").not.toContain("\u001B[3J");
  expect(output, "Must not emit CSI 2J").not.toContain(ansiEscapes.eraseScreen);

  const visibleLines = reconstructTerminalLines(output, rows);
  for (let index = 0; index < rows; index++) {
    expect(visibleLines, `Pre-existing scrollback line ${index} must survive rerenders`).toContain(
      `#935 scrollback ${index}`,
    );
  }

  // Frame 7's label is longer than every other frame's, so a missing or
  // partial clear leaves `STALE-ROW` behind. The final frame (rows + 1 tall)
  // is written in full on exit, so its label lands just above the viewport.
  const finalFrame = visibleLines.slice(-(rows + 1));
  expect(finalFrame[0]).toContain("frame 8");
  expect(visibleLines.some((line) => line.includes("STALE-ROW"))).toBe(false);
});

test("#450: full-height rerenders should not clear before unmount", async () => {
  const renderedMarker = "__FULL_HEIGHT_RERENDER_COMPLETED__";
  const outputBeforeMarker = await runIssue450FixtureBeforeMarker(
    "issue-450-full-height-rerender-with-marker",
    renderedMarker,
  );
  const { fullClearCount } = getIssue450ControlSequenceCounts(outputBeforeMarker);

  assertIssue450DynamicFrameOutput(outputBeforeMarker);
  expect(fullClearCount).toBe(0);
});

test("#450: grow from rows - 1 to full-height should not clear before unmount", async () => {
  const renderedMarker = "__GROW_TO_FULLSCREEN_RERENDER_COMPLETED__";
  const outputBeforeMarker = await runIssue450FixtureBeforeMarker(
    "issue-450-grow-to-fullscreen-rerender",
    renderedMarker,
  );
  const { fullClearCount } = getIssue450ControlSequenceCounts(outputBeforeMarker);

  assertIssue450DynamicFrameOutput(outputBeforeMarker);
  expect(fullClearCount).toBe(0);
});

test("#450: shrink from full-height to rows - 1 must not clear the terminal", async () => {
  const { output, fullClearCount } = await runIssue450FixtureWithCounts(
    "issue-450-shrink-from-fullscreen-rerender",
  );

  assertIssue450DynamicFrameOutput(output);
  expect(fullClearCount).toBe(0);
});

test("#450: shrink from overflow to rows - 1 must not clear the terminal", async () => {
  const { output, fullClearCount } = await runIssue450FixtureWithCounts(
    "issue-450-shrink-from-overflow-rerender",
  );

  assertIssue450DynamicFrameOutput(output);
  expect(fullClearCount).toBe(0);
});

test("#450: <Static> with shrink from full-height must not clear the terminal", async () => {
  const { output, fullClearCount } = await runIssue450FixtureWithCounts(
    "issue-450-static-shrink-from-fullscreen-rerender",
  );

  expect(output).toContain("#450 static line");
  assertIssue450DynamicFrameOutput(output);
  expect(fullClearCount).toBe(0);
});

test("#450: full-height rerenders with <Static> should not repeatedly clear terminal", async () => {
  const { output, fullClearCount, eraseLineCount } = await runIssue450FixtureWithCounts(
    "issue-450-full-height-with-static-rerender",
  );

  expect(output, "Fixture should emit static output").toContain("#450 static line");
  assertIssue450DynamicFrameOutput(output);
  expect(
    fullClearCount <= 1,
    `Expected at most one full-clear sequence, received ${fullClearCount}`,
  ).toBe(true);
  expect(eraseLineCount > 0, "Expected incremental erase sequences for fullscreen rerenders").toBe(
    true,
  );
});

test("clear output", async () => {
  const ps = term("clear");
  await ps.waitForExit();

  const secondFrame = ps.output.split(ansiEscapes.eraseLines(4))[1];

  for (const letter of ["A", "B", "C"]) {
    expect(secondFrame).not.toContain(letter);
  }
});

for (const patchConsoleOption of ["omitted", "undefined"]) {
  test(`intercept console methods with ${patchConsoleOption} patchConsole option`, async () => {
    const ps = term("console", [patchConsoleOption]);
    await ps.waitForExit();

    const frames = ps.output.split(ansiEscapes.eraseLines(2)).map((line) => {
      return stripAnsi(line);
    });

    expect(frames).toEqual(["Hello World\r\n", "First log\r\nHello World\r\nSecond log\r\n"]);
  });
}

test("undefined stream options use the default streams", async () => {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const ps = term("undefined-render-streams", [], { env: { CI: "true" } });
  await ps.waitForExit();
  expect(ps.output).toContain("Default streams: true");
});
