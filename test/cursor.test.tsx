import { setTimeout as delay } from "node:timers/promises";

import React, { Suspense, act, useEffect, useState } from "react";
import { expect, test } from "vite-plus/test";

import ansiEscapes from "../src/ansi/escapes.ts";
import { render, Box, Text, useInput, useCursor, useStdout, useStderr } from "../src/index.ts";
import { createStdin, emitReadable } from "./helpers/create-stdin.ts";
import createStdout, { type FakeStdout } from "./helpers/create-stdout.ts";

const showCursorEscape = "\u001B[?25h";
const hideCursorEscape = "\u001B[?25l";

const waitForCondition = async (condition: () => boolean): Promise<void> => {
  if (condition()) {
    return;
  }

  const timeoutMs = 2000;
  const intervalMs = 10;
  const maxAttempts = Math.ceil(timeoutMs / intervalMs);

  await new Promise<void>((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      try {
        if (condition()) {
          clearInterval(interval);
          resolve();
          return;
        }
      } catch (error) {
        clearInterval(interval);
        reject(error instanceof Error ? error : new Error("Condition check threw"));
        return;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        reject(new Error(`Condition was not met in ${timeoutMs}ms`));
      }
    }, intervalMs);
  });
};

function InputApp() {
  const [text, setText] = useState("");
  const { setCursorPosition } = useCursor();

  useInput((input, key) => {
    if (key.backspace || key.delete) {
      setText((prev) => prev.slice(0, -1));
      return;
    }

    if (!key.ctrl && !key.meta && input) {
      setText((prev) => prev + input);
    }
  });

  setCursorPosition({ x: 2 + text.length, y: 0 });

  return (
    <Box>
      <Text>{`> ${text}`}</Text>
    </Box>
  );
}

test("cursor is shown at specified position after render", async () => {
  const stdout = createStdout();
  const stdin = createStdin();

  const { unmount } = render(<InputApp />, { stdout, stdin });
  await delay(50);

  // With isTTY=true, cli-cursor writes cursor escape sequences as separate
  // stdout.write calls (synchronized output wrappers), so we check the
  // combined output of the first render rather than a single firstCall.
  const firstRenderOutput = stdout.getWrites().join("");
  // Cursor should be shown at x=2 (after "> ")
  expect(
    firstRenderOutput.includes(showCursorEscape),
    "cursor should be visible after first render",
  ).toBe(true);
  expect(firstRenderOutput.includes(ansiEscapes.cursorTo(2)), "cursor should be at column 2").toBe(
    true,
  );

  unmount();
});

test("cursor is not hidden by useEffect after first render", async () => {
  const stdout = createStdout();
  const stdin = createStdin();

  const { unmount } = render(<InputApp />, { stdout, stdin });
  await delay(50);

  // Check all writes after the first render — none should be a bare hideCursorEscape
  // that would undo the showCursorEscape from log-update.
  // The last write to stdout should contain showCursorEscape (from log-update),
  // not be followed by a separate hideCursorEscape write from App.tsx useEffect.
  const output = stdout.getWrites().join("");
  const lastShowIndex = output.lastIndexOf(showCursorEscape);
  const lastHideIndex = output.lastIndexOf(hideCursorEscape);

  expect(
    lastShowIndex > lastHideIndex,
    "last cursor visibility change should be SHOW, not HIDE",
  ).toBe(true);

  unmount();
});

test("cursor follows text input", async () => {
  const stdout = createStdout();
  const stdin = createStdin();

  const { unmount } = render(<InputApp />, { stdout, stdin });
  await delay(50);

  emitReadable(stdin, "a");
  await delay(50);

  // With isTTY=true, stdout.get() (lastCall) may be a synchronized output
  // wrapper rather than the render content, so check all writes combined.
  const allOutput = stdout.getWrites().join("");
  // After typing 'a', cursor should be at x=3 ("> a" = 3 chars)
  expect(allOutput.includes(showCursorEscape)).toBe(true);
  expect(
    allOutput.includes(ansiEscapes.cursorTo(3)),
    'cursor should move to column 3 after typing "a"',
  ).toBe(true);

  unmount();
});

test("cursor moves on space input even when output is identical", async () => {
  const stdout = createStdout();
  const stdin = createStdin();

  const { unmount } = render(<InputApp />, { stdout, stdin });
  await delay(50);

  emitReadable(stdin, "a");
  await delay(50);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const afterA = stdout.write.mock.calls.length;

  emitReadable(stdin, " ");
  await delay(50);

  // Space adds to text, cursor should move even if Ink output looks the same (padded)
  expect(stdout.write.mock.calls.length > afterA, "should write to stdout after space input").toBe(
    true,
  );

  // With isTTY=true, stdout.get() (lastCall) may be a synchronized output
  // wrapper rather than the render content, so check all writes combined.
  const allOutput = stdout.getWrites().join("");
  // After "a ", cursor should be at x=4
  expect(
    allOutput.includes(ansiEscapes.cursorTo(4)),
    'cursor should be at column 4 after "a "',
  ).toBe(true);

  unmount();
});

test("cursor is cleared when component using useCursor unmounts", async () => {
  const stdout = createStdout();
  const stdin = createStdin();

  function CursorChild() {
    const { setCursorPosition } = useCursor();
    setCursorPosition({ x: 5, y: 0 });
    return <Text>child</Text>;
  }

  function Parent() {
    const [showChild, setShowChild] = useState(true);

    useInput((_input, key) => {
      if (key.return) {
        setShowChild(false);
      }
    });

    return <Box>{showChild ? <CursorChild /> : <Text>no cursor</Text>}</Box>;
  }

  const { unmount } = render(<Parent />, { stdout, stdin });
  await delay(50);

  // With isTTY=true, cli-cursor writes cursor escape sequences as separate
  // stdout.write calls, so check the combined initial render output.
  const initialRenderOutput = stdout.getWrites().join("");
  expect(initialRenderOutput.includes(showCursorEscape), "cursor should be visible initially").toBe(
    true,
  );

  const writesBeforeEnter = stdout.write.mock.calls.length;

  // Unmount the child by pressing Enter
  emitReadable(stdin, "\r");
  await delay(50);

  // After child unmounts, cursor position should be cleared.
  // Only look at writes after the initial render to avoid counting
  // the initial render's cursor sequences.
  const outputAfterChildUnmount = stdout.getWrites().slice(writesBeforeEnter).join("");
  const lastShowIndex = outputAfterChildUnmount.lastIndexOf(showCursorEscape);
  const lastHideIndex = outputAfterChildUnmount.lastIndexOf(hideCursorEscape);
  expect(
    lastHideIndex > lastShowIndex,
    "cursor should be hidden after child with useCursor unmounts",
  ).toBe(true);

  unmount();
});

test("cursor position does not leak from suspended concurrent render to fallback", async () => {
  const stdout = createStdout();
  const stdin = createStdin();

  let resolvePromise: () => void;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  let suspended = true;

  function CursorChild() {
    const { setCursorPosition } = useCursor();
    setCursorPosition({ x: 5, y: 0 }); // Render-phase side effect
    if (suspended) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw promise;
    }

    return <Text>loaded</Text>;
  }

  function Test() {
    return (
      <Suspense fallback={<Text>loading</Text>}>
        <CursorChild />
      </Suspense>
    );
  }

  await act(async () => {
    render(<Test />, { stdout, stdin, concurrent: true });
  });

  const fallbackOutput = stdout.getWrites().join("");
  expect(fallbackOutput.includes("loading")).toBe(true);
  expect(
    fallbackOutput.includes(showCursorEscape),
    "fallback output should not contain show cursor escape from suspended concurrent render",
  ).toBe(false);

  // Cleanup: resolve promise and unmount
  suspended = false;
  resolvePromise!();
  await act(async () => {
    await delay(50);
  });
});

test("screen does not scroll up on subsequent renders", async () => {
  const stdout = createStdout();
  const stdin = createStdin();

  function MultiLineApp() {
    const [text, setText] = useState("");
    const { setCursorPosition } = useCursor();

    useInput((input, key) => {
      if (!key.ctrl && !key.meta && input) {
        setText((prev) => prev + input);
      }
    });

    setCursorPosition({ x: 2 + text.length, y: 1 });

    return (
      <Box flexDirection="column">
        <Text>Header</Text>
        <Text>{`> ${text}`}</Text>
      </Box>
    );
  }

  const { unmount } = render(<MultiLineApp />, { stdout, stdin });
  await delay(50);

  const writesBeforeInput = stdout.write.mock.calls.length;

  emitReadable(stdin, "x");
  await delay(50);

  // With isTTY=true, stdout.get() (lastCall) may be a synchronized output
  // wrapper rather than the render content, so check writes from the
  // second render combined.
  const secondRenderOutput = stdout.getWrites().slice(writesBeforeInput).join("");
  // When cursor was at y=1 (line 1), next render should first cursorDown to bottom,
  // then erase. The write should contain cursorDown to return to bottom.
  // It should NOT just erase from cursor position (which would scroll screen up).
  expect(secondRenderOutput.includes(hideCursorEscape), "should hide cursor before erase").toBe(
    true,
  );
  // The write should include the new text
  expect(secondRenderOutput.includes("x"), "should contain the typed character").toBe(true);

  unmount();
});

function StdoutWriteApp() {
  const { setCursorPosition } = useCursor();
  const { write } = useStdout();

  setCursorPosition({ x: 2, y: 0 });

  useEffect(() => {
    write("from stdout hook\n");
  }, [write]);

  return <Text>Hello</Text>;
}

function StderrWriteApp() {
  const { setCursorPosition } = useCursor();
  const { write } = useStderr();

  setCursorPosition({ x: 2, y: 0 });

  useEffect(() => {
    write("from stderr hook\n");
  }, [write]);

  return <Text>Hello</Text>;
}

type HookWriteCase = {
  readonly testName: string;
  readonly App: () => React.JSX.Element;
  readonly includeStderr?: boolean;
  readonly assertTargetWrite: (output: string, stderr: FakeStdout | undefined) => void;
};

const hookWriteCases: HookWriteCase[] = [
  {
    testName: "cursor remains visible after useStdout().write()",
    App: StdoutWriteApp,
    assertTargetWrite(output) {
      expect(output.includes("from stdout hook")).toBe(true);
    },
  },
  {
    testName: "cursor remains visible after useStderr().write()",
    App: StderrWriteApp,
    includeStderr: true,
    assertTargetWrite(_output, stderr) {
      expect(stderr!.write).toHaveBeenCalled();
    },
  },
];

for (const testCase of hookWriteCases) {
  test(testCase.testName, async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    const stderr = testCase.includeStderr ? createStdout() : undefined;

    const { unmount } = render(
      <testCase.App />,
      stderr ? { stdout, stderr, stdin } : { stdout, stdin },
    );
    await delay(50);

    const output = stdout.getWrites().join("");
    const lastShowIndex = output.lastIndexOf(showCursorEscape);
    const lastHideIndex = output.lastIndexOf(hideCursorEscape);

    testCase.assertTargetWrite(output, stderr);
    expect(
      lastShowIndex > lastHideIndex,
      "last cursor visibility escape should be show after hook write",
    ).toBe(true);

    unmount();
  });
}

function DebugStdoutWriteApp() {
  const { write } = useStdout();

  useEffect(() => {
    write("from stdout hook\n");
  }, [write]);

  return <Text>Hello</Text>;
}

function DebugStderrWriteApp() {
  const { write } = useStderr();

  useEffect(() => {
    write("from stderr hook\n");
  }, [write]);

  return <Text>Hello</Text>;
}

test("debug mode: useStdout().write() replays latest frame", async () => {
  const stdout = createStdout();
  const { unmount } = render(<DebugStdoutWriteApp />, { stdout, debug: true });
  await waitForCondition(() =>
    stdout.getWrites().some((write) => write.includes("from stdout hook\nHello")),
  );

  const writes = stdout.getWrites();
  const hookWrite = writes.find((write) => write.includes("from stdout hook\nHello"));

  expect(hookWrite).toBeTruthy();
  expect(writes.includes("")).toBe(false);

  unmount();
});

test("debug mode: useStdout().write() does not leak into stderr", async () => {
  const stdout = createStdout();
  const stderr = createStdout();
  const { unmount } = render(<DebugStdoutWriteApp />, {
    stdout,
    stderr,
    debug: true,
  });
  await waitForCondition(() =>
    stdout.getWrites().some((write) => write.includes("from stdout hook\nHello")),
  );

  const stderrWrites = stderr.getWrites();
  expect(stderrWrites.some((write) => write.includes("from stdout hook\n"))).toBe(false);
  expect(stderrWrites.some((write) => write.includes("Hello"))).toBe(false);
  expect(stderrWrites.includes("")).toBe(false);

  unmount();
});

test("debug mode: useStderr().write() replays latest frame without empty writes", async () => {
  const stdout = createStdout();
  const stderr = createStdout();
  const { unmount } = render(<DebugStderrWriteApp />, {
    stdout,
    stderr,
    debug: true,
  });
  await waitForCondition(() =>
    stderr.getWrites().some((write) => write.includes("from stderr hook\n")),
  );
  await waitForCondition(() => stdout.getWrites().length > 1);

  const stdoutWrites = stdout.getWrites();
  const stderrWrites = stderr.getWrites();
  const stdoutWritesAfterInitialRender = stdoutWrites.slice(1);

  expect(stderrWrites.some((write) => write.includes("from stderr hook\n"))).toBe(true);
  expect(stderrWrites.some((write) => write.includes("Hello"))).toBe(false);
  expect(stdoutWritesAfterInitialRender.length > 0).toBe(true);
  expect(stdoutWritesAfterInitialRender.some((write) => write.includes("Hello"))).toBe(true);
  expect(stdoutWritesAfterInitialRender.some((write) => write.includes("from stderr hook\n"))).toBe(
    false,
  );
  expect(stdoutWrites.includes("")).toBe(false);
  expect(stderrWrites.includes("")).toBe(false);

  unmount();
});

function DebugStderrWriteAfterRerenderApp() {
  const [text, setText] = useState("Initial");
  const { write } = useStderr();

  useEffect(() => {
    setText("Updated");
  }, []);

  useEffect(() => {
    if (text === "Updated") {
      write("from stderr hook\n");
    }
  }, [text, write]);

  return <Text>{text}</Text>;
}

function DebugStdoutWriteAfterRerenderApp() {
  const [text, setText] = useState("Initial");
  const { write } = useStdout();

  useEffect(() => {
    setText("Updated");
  }, []);

  useEffect(() => {
    if (text === "Updated") {
      write("from stdout hook\n");
    }
  }, [text, write]);

  return <Text>{text}</Text>;
}

test("debug mode: useStdout().write() replays rerendered frame", async () => {
  const stdout = createStdout();
  const { unmount } = render(<DebugStdoutWriteAfterRerenderApp />, {
    stdout,
    debug: true,
  });
  await waitForCondition(() =>
    stdout.getWrites().some((write) => write.includes("from stdout hook\nUpdated")),
  );

  const stdoutWrites = stdout.getWrites();

  expect(stdoutWrites.some((write) => write.includes("from stdout hook\nUpdated"))).toBe(true);
  expect(stdoutWrites.some((write) => write.includes("from stdout hook\nInitial"))).toBe(false);
  expect(stdoutWrites.includes("")).toBe(false);

  unmount();
});

test("debug mode: useStderr().write() replays rerendered frame", async () => {
  const stdout = createStdout();
  const stderr = createStdout();
  const { unmount } = render(<DebugStderrWriteAfterRerenderApp />, {
    stdout,
    stderr,
    debug: true,
  });
  await waitForCondition(() =>
    stderr.getWrites().some((write) => write.includes("from stderr hook\n")),
  );
  await waitForCondition(() =>
    stdout
      .getWrites()
      .slice(1)
      .some((write) => write.includes("Updated")),
  );

  const stdoutWrites = stdout.getWrites();
  const stderrWrites = stderr.getWrites();
  const stdoutWritesAfterInitialRender = stdoutWrites.slice(1);

  expect(stderrWrites.some((write) => write.includes("from stderr hook\n"))).toBe(true);
  expect(stderrWrites.some((write) => write.includes("Updated"))).toBe(false);
  expect(stderrWrites.some((write) => write.includes("Initial"))).toBe(false);
  expect(stdoutWritesAfterInitialRender.some((write) => write.includes("Updated"))).toBe(true);
  expect(stdoutWritesAfterInitialRender.some((write) => write.includes("Initial"))).toBe(false);
  expect(stdoutWritesAfterInitialRender.some((write) => write.includes("from stderr hook\n"))).toBe(
    false,
  );
  expect(stdoutWrites.includes("")).toBe(false);
  expect(stderrWrites.includes("")).toBe(false);

  unmount();
});

// Fullscreen frames are the only ones Ink renders without a trailing newline,
// which is what makes the cursor suffix measure from the last visible line
// rather than from one row past it. These drive that through the real
// `render()` wiring — `outputToRender = isFullscreen ? output : output + '\n'`
// — instead of handing log-update a hand-built string.

const fullscreenLines = (count: number, marker: string): string[] =>
  Array.from({ length: count }, (_, index) =>
    index === 1 ? `Line ${index}${marker}` : `Line ${index}`,
  );

function FullscreenCursorApp({
  lineCount,
  cursorY,
  marker,
}: {
  readonly lineCount: number;
  readonly cursorY: number;
  readonly marker: string;
}) {
  const { setCursorPosition } = useCursor();
  setCursorPosition({ x: 3, y: cursorY });

  return (
    <Box flexDirection="column">
      {fullscreenLines(lineCount, marker).map((line) => (
        <Text key={line}>{line}</Text>
      ))}
    </Box>
  );
}

// Both renderers need covering here. The trailing newline is omitted for
// fullscreen in either mode, but only the incremental renderer skips the final
// cursorNextLine to keep the cursor on the last line, so it is the one where
// the row basis is easiest to get wrong.
const inkRenderingModes = [
  { name: "standard rendering", incremental: false },
  { name: "incremental rendering", incremental: true },
] as const;

for (const { name, incremental } of inkRenderingModes) {
  test(`${name} - fullscreen: cursor lands on the requested row across rerender and cursor-only update`, async () => {
    const stdout = createStdout();
    // Output that exactly fills the viewport is fullscreen, so Ink omits
    // the trailing newline and the renderer stops on the last visible line.
    (stdout as any).rows = 5;

    const { rerender, unmount, waitUntilRenderFlush } = render(
      <FullscreenCursorApp lineCount={5} cursorY={2} marker="" />,
      { stdout, incrementalRendering: incremental },
    );
    await waitUntilRenderFlush();

    // 5 lines with no trailing newline: the cursor is left on row 4, so
    // reaching y=2 is cursorUp(2). Measuring from the visible-line count
    // instead would emit cursorUp(3) and land a row too high.
    const expected = ansiEscapes.cursorUp(2) + ansiEscapes.cursorTo(3) + showCursorEscape;
    const overshoot = ansiEscapes.cursorUp(3) + ansiEscapes.cursorTo(3) + showCursorEscape;

    const firstRender = stdout.getWrites().join("");
    expect(firstRender.includes(expected), "first frame").toBe(true);
    expect(firstRender.includes(overshoot), "first frame does not overshoot").toBe(false);

    const writesBeforeRerender = stdout.write.mock.calls.length;
    rerender(<FullscreenCursorApp lineCount={5} cursorY={2} marker="!" />);
    await waitUntilRenderFlush();

    const changedRerender = stdout.getWrites().slice(writesBeforeRerender).join("");
    expect(changedRerender.includes("Line 1!"), "content actually changed").toBe(true);
    expect(changedRerender.includes(expected), "changed rerender").toBe(true);
    expect(changedRerender.includes(overshoot), "changed rerender does not overshoot").toBe(false);

    const writesBeforeCursorMove = stdout.write.mock.calls.length;
    rerender(<FullscreenCursorApp lineCount={5} cursorY={0} marker="!" />);
    await waitUntilRenderFlush();

    // Output is unchanged, so this takes the cursor-only path, which derives
    // the bottom row from previousLineCount (5) rather than from the output.
    // Not on Windows: fullscreen frames there always take the clearing
    // path instead, so the expected sequence comes from sync(). It works
    // out to the same bytes, because both measure from lines.length - 1.
    const cursorOnly = stdout.getWrites().slice(writesBeforeCursorMove).join("");
    expect(
      cursorOnly.includes(ansiEscapes.cursorUp(4) + ansiEscapes.cursorTo(3) + showCursorEscape),
      "cursor-only update",
    ).toBe(true);
    expect(
      cursorOnly.includes(ansiEscapes.cursorUp(5) + ansiEscapes.cursorTo(3) + showCursorEscape),
      "cursor-only update does not overshoot",
    ).toBe(false);

    unmount();
  });
}

// Both renderers again: overflowing frames are clamped to the viewport's
// bottom rows instead of taking the historical clearTerminal + sync() path,
// which erased the user's scrollback on every overflowing update.
for (const { name, incremental } of inkRenderingModes) {
  test(`${name} - fullscreen: overflowing frame is clamped and keeps cursor positioning`, async () => {
    const stdout = createStdout();
    (stdout as any).rows = 5;

    const { rerender, unmount, waitUntilRenderFlush } = render(
      <FullscreenCursorApp lineCount={6} cursorY={2} marker="" />,
      { stdout, incrementalRendering: incremental },
    );
    await waitUntilRenderFlush();

    const writesBeforeRerender = stdout.write.mock.calls.length;
    rerender(<FullscreenCursorApp lineCount={6} cursorY={2} marker="!" />);
    await waitUntilRenderFlush();

    const synced = stdout.getWrites().slice(writesBeforeRerender).join("");
    expect(synced.includes(ansiEscapes.clearTerminal), "must not erase the scrollback buffer").toBe(
      false,
    );
    expect(synced.includes("Line 1!"), "the changed row survives the clamp").toBe(true);
    expect(synced.includes("Line 0"), "rows above the viewport are clamped away").toBe(false);
    // The clamped frame is 5 lines with no trailing newline: the cursor is
    // left on row 4, so y=2 is cursorUp(2).
    expect(
      synced.includes(ansiEscapes.cursorUp(2) + ansiEscapes.cursorTo(3) + showCursorEscape),
    ).toBe(true);

    unmount();
  });
}
