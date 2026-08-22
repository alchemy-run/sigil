import { setTimeout as delay } from "node:timers/promises";

import React from "react";
import { expect, test, afterAll } from "vite-plus/test";

import { stripAnsi } from "#/ansi/strip.ts";
import { render, Box, Text, useWindowSize } from "#/index.ts";

import createStdout, { type FakeStdout } from "./helpers/create-stdout.ts";

const getWriteContents = (stdout: FakeStdout): string[] =>
  stdout
    .getWrites()
    .filter((w) => w.length > 0 && !w.startsWith("\u001B[?25") && !w.startsWith("\u001B[?2026"));

test("useWindowSize returns current terminal dimensions and updates on resize", async () => {
  const stdout = createStdout(100);
  stdout.rows = 40;

  function Test() {
    const { columns, rows } = useWindowSize();
    return (
      <Text>
        {columns}x{rows}
      </Text>
    );
  }

  const { waitUntilRenderFlush } = render(<Test />, { stdout });
  await waitUntilRenderFlush();

  expect(stripAnsi(getWriteContents(stdout).at(-1)!)).toContain("100x40");

  stdout.columns = 60;
  stdout.rows = 20;
  stdout.emit("resize");
  await delay(100);

  expect(stripAnsi(getWriteContents(stdout).at(-1)!)).toContain("60x20");
});

test("useWindowSize removes resize listener on unmount", async () => {
  const stdout = createStdout(100);
  stdout.rows = 24;

  function Test() {
    const { columns, rows } = useWindowSize();
    return (
      <Text>
        {columns}x{rows}
      </Text>
    );
  }

  const initialListenerCount = stdout.listenerCount("resize");
  const { unmount, waitUntilRenderFlush } = render(<Test />, { stdout });
  await waitUntilRenderFlush();

  expect(stdout.listenerCount("resize") > initialListenerCount).toBe(true);
  unmount();

  expect(stdout.listenerCount("resize")).toBe(initialListenerCount);
});

test("useWindowSize does not crash when resize fires after unmount", async () => {
  const stdout = createStdout(100);
  stdout.rows = 24;

  function Test() {
    const { columns, rows } = useWindowSize();
    return (
      <Text>
        {columns}x{rows}
      </Text>
    );
  }

  const { unmount, waitUntilRenderFlush } = render(<Test />, { stdout });
  await waitUntilRenderFlush();
  unmount();

  stdout.emit("resize");
  await delay(50);

  expect(true).toBe(true); // TODO: figure out, ported from t.pass()
});

test("useWindowSize falls back to a positive column count when stdout.columns is 0", async () => {
  const stdout = createStdout(0);
  let capturedColumns = -1;

  function Test() {
    const { columns } = useWindowSize();
    capturedColumns = columns;
    return <Text>{columns}</Text>;
  }

  const { waitUntilRenderFlush } = render(<Test />, { stdout });
  await waitUntilRenderFlush();

  expect(capturedColumns > 0).toBe(true);
});

test("useWindowSize falls back to terminal-size rows when stdout.rows is missing", async () => {
  const stdout = createStdout(0);
  let capturedRows = -1;
  const originalColumns = process.env.COLUMNS;
  const originalLines = process.env.LINES;
  const originalProcessStdoutColumns = process.stdout.columns;
  const originalProcessStdoutRows = process.stdout.rows;
  const originalProcessStderrColumns = process.stderr.columns;
  const originalProcessStderrRows = process.stderr.rows;

  afterAll(() => {
    process.env.COLUMNS = originalColumns;
    process.env.LINES = originalLines;
    process.stdout.columns = originalProcessStdoutColumns;
    process.stdout.rows = originalProcessStdoutRows;
    process.stderr.columns = originalProcessStderrColumns;
    process.stderr.rows = originalProcessStderrRows;
  });

  process.env.COLUMNS = "123";
  process.env.LINES = "45";
  process.stdout.columns = 0;
  process.stdout.rows = 0;
  process.stderr.columns = 0;
  process.stderr.rows = 0;
  delete (stdout as { rows?: number }).rows;

  function Test() {
    const { rows } = useWindowSize();
    capturedRows = rows;
    return <Text>{rows}</Text>;
  }

  const { waitUntilRenderFlush } = render(<Test />, { stdout });
  await waitUntilRenderFlush();

  expect(capturedRows).toBe(45);
});

test("clear screen when terminal width decreases", async () => {
  const stdout = createStdout(100);

  function Test() {
    return (
      <Box borderStyle="round">
        <Text>Hello World</Text>
      </Box>
    );
  }

  render(<Test />, { stdout });

  const initialOutput = stripAnsi(getWriteContents(stdout)[0]);
  expect(initialOutput).toContain("Hello World");
  expect(initialOutput).toContain("╭"); // Box border

  // Decrease width - should trigger clear and rerender
  stdout.columns = 50;
  stdout.emit("resize");
  await delay(100);

  // Verify the output was updated for smaller width
  const lastOutput = stripAnsi(getWriteContents(stdout).at(-1)!);
  expect(lastOutput).toContain("Hello World");
  expect(lastOutput).toContain("╭"); // Box border
  expect(initialOutput).not.toBe(lastOutput); // Output should change due to width
});

test("no screen clear when terminal width increases", async () => {
  const stdout = createStdout(50);

  function Test() {
    return (
      <Box borderStyle="round">
        <Text>Test</Text>
      </Box>
    );
  }

  render(<Test />, { stdout });

  const initialOutput = getWriteContents(stdout)[0];

  // Increase width - should rerender but not clear
  stdout.columns = 100;
  stdout.emit("resize");
  await delay(100);

  const lastOutput = getWriteContents(stdout).at(-1)!;

  // When increasing width, we don't clear, so we should see eraseLines used for incremental update
  // But when decreasing, the clear() is called which also uses eraseLines
  // The key difference: decreasing width triggers an explicit clear before render
  expect(stripAnsi(initialOutput)).not.toBe(stripAnsi(lastOutput));
  expect(stripAnsi(lastOutput)).toContain("Test");
});

test("consecutive width decreases trigger screen clear each time", async () => {
  const stdout = createStdout(100);

  function Test() {
    return (
      <Box borderStyle="round">
        <Text>Content</Text>
      </Box>
    );
  }

  render(<Test />, { stdout });

  const initialOutput = stripAnsi(getWriteContents(stdout)[0]);

  // First decrease
  stdout.columns = 80;
  stdout.emit("resize");
  await delay(100);

  const afterFirstDecrease = stripAnsi(getWriteContents(stdout).at(-1)!);
  expect(initialOutput).not.toBe(afterFirstDecrease);
  expect(afterFirstDecrease).toContain("Content");

  // Second decrease
  stdout.columns = 60;
  stdout.emit("resize");
  await delay(100);

  const afterSecondDecrease = stripAnsi(getWriteContents(stdout).at(-1)!);
  expect(afterFirstDecrease).not.toBe(afterSecondDecrease);
  expect(afterSecondDecrease).toContain("Content");
});

test("width decrease clears lastOutput to force rerender", async () => {
  const stdout = createStdout(100);

  function Test() {
    return (
      <Box borderStyle="round">
        <Text>Test Content</Text>
      </Box>
    );
  }

  const { rerender } = render(<Test />, { stdout });

  const initialOutput = stripAnsi(getWriteContents(stdout)[0]);

  // Decrease width - with a border, this will definitely change the output
  stdout.columns = 50;
  stdout.emit("resize");
  await delay(100);

  const afterResizeOutput = stripAnsi(getWriteContents(stdout).at(-1)!);

  // Outputs should be different because the border width changed
  expect(initialOutput).not.toBe(afterResizeOutput);
  expect(afterResizeOutput).toContain("Test Content");

  // Now try to rerender with a different component
  rerender(
    <Box borderStyle="round">
      <Text>Updated Content</Text>
    </Box>,
  );
  await delay(100);

  // Verify content was updated
  expect(stripAnsi(getWriteContents(stdout).at(-1)!)).toContain("Updated Content");
});

// Regression tests for inline rendering breaking on terminal height resize.
// Found in practice with a windowed plan view: a static inline frame, the
// user resizes the terminal vertically, and the incremental renderer keeps
// diffing against a screen that no longer matches its state — or worse,
// transient exactly-fullscreen frames trigger a scrollback-erasing
// clearTerminal (ESC[3J).

let setResizeRegressionCount: (count: number) => void = () => {};

function ResizeRegressionList({ initialCount }: { readonly initialCount: number }) {
  const [count, setCount] = React.useState(initialCount);
  setResizeRegressionCount = setCount;
  return (
    <Box flexDirection="column">
      {Array.from({ length: count }, (_, index) => (
        <Text key={index}>Item {index + 1}</Text>
      ))}
    </Box>
  );
}

test("height-only resize rewrites the inline frame (stale-screen regression)", async () => {
  const stdout = createStdout(80);
  stdout.rows = 10;

  // The frame must not depend on the window size: the bug is that Ink wrote
  // nothing at all after a height-only resize because the output string was
  // unchanged, while the terminal had reflowed the screen underneath it.
  const { waitUntilRenderFlush, unmount } = render(<ResizeRegressionList initialCount={3} />, {
    stdout,
    interactive: true,
  });
  await waitUntilRenderFlush();
  expect(stripAnsi(getWriteContents(stdout).join(""))).toContain("Item 3");

  const writesBefore = stdout.getWrites().length;
  stdout.rows = 20;
  stdout.emit("resize");
  await delay(100);

  const afterResize = stdout.getWrites().slice(writesBefore).join("");
  expect(
    stripAnsi(afterResize),
    "A height change must force a full rewrite of the inline frame",
  ).toContain("Item 3");

  unmount();
});

test("shrinking from an exactly-fullscreen frame does not erase scrollback", async () => {
  const stdout = createStdout(80);
  stdout.rows = 4;

  const { waitUntilRenderFlush, unmount } = render(<ResizeRegressionList initialCount={4} />, {
    stdout,
    interactive: true,
  });
  await waitUntilRenderFlush();

  // Shrink back to an inline frame. The 4-row frame exactly filled the
  // viewport and is erasable in place; clearTerminal (with its ESC[3J
  // scrollback erase) must not fire.
  setResizeRegressionCount(2);
  await delay(100);
  await waitUntilRenderFlush();

  expect(
    stdout.getWrites().join(""),
    "Leaving an exactly-fullscreen frame must not erase the scrollback buffer",
  ).not.toContain("\u001B[3J");

  unmount();
});

test("overflowing frames are clamped to the viewport instead of erasing scrollback", async () => {
  const stdout = createStdout(80);
  stdout.rows = 4;

  const { waitUntilRenderFlush, unmount } = render(<ResizeRegressionList initialCount={8} />, {
    stdout,
    interactive: true,
  });
  await waitUntilRenderFlush();

  // Update while still overflowing: historically this took the full
  // clearTerminal fallback on every frame, wiping scrollback each time.
  setResizeRegressionCount(9);
  await delay(100);
  await waitUntilRenderFlush();

  const allWrites = stdout.getWrites().join("");
  expect(allWrites, "Overflowing updates must not erase the scrollback buffer").not.toContain(
    "\u001B[3J",
  );

  const lastFrame = stripAnsi(getWriteContents(stdout).at(-1)!);
  expect(lastFrame, "The bottom rows of the frame must be visible").toContain("Item 9");
  expect(
    lastFrame,
    "Rows above the viewport must be clamped away rather than pushed into scrollback",
  ).not.toContain("Item 1\n");

  unmount();
});

test("height shrink below the previous frame height does not erase scrollback", async () => {
  const stdout = createStdout(80);
  stdout.rows = 6;

  const { waitUntilRenderFlush, unmount } = render(<ResizeRegressionList initialCount={6} />, {
    stdout,
    interactive: true,
  });
  await waitUntilRenderFlush();

  const writesBefore = stdout.getWrites().length;
  stdout.rows = 4;
  stdout.emit("resize");
  await delay(100);

  const afterResize = stdout.getWrites().slice(writesBefore).join("");
  expect(
    afterResize,
    "A height shrink must not funnel the stale frame height into clearTerminal",
  ).not.toContain("\u001B[3J");

  unmount();
});
