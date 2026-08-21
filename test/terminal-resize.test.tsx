import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import React from "react";
import { expect, test, afterAll } from "vite-plus/test";

import stripAnsi from "../src/ansi/strip.ts";
import { render, Box, Text, useWindowSize } from "../src/index.ts";
import createStdout, { type FakeStdout } from "./helpers/create-stdout.ts";

const getWriteContents = (stdout: FakeStdout): string[] =>
  stdout
    .getWrites()
    .filter((w) => w.length > 0 && !w.startsWith("\u001B[?25") && !w.startsWith("\u001B[?2026"));

test("useWindowSize returns current terminal dimensions and updates on resize", async () => {
  const stdout = createStdout(100);
  (stdout as any).rows = 40;

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

  expect(stripAnsi(getWriteContents(stdout).at(-1)!).includes("100x40")).toBe(true);

  (stdout as any).columns = 60;
  (stdout as any).rows = 20;
  stdout.emit("resize");
  await delay(100);

  expect(stripAnsi(getWriteContents(stdout).at(-1)!).includes("60x20")).toBe(true);
});

test("useWindowSize removes resize listener on unmount", async () => {
  const stdout = createStdout(100);
  (stdout as any).rows = 24;

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
  (stdout as any).rows = 24;

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
  delete (stdout as any).rows;

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
  expect(initialOutput.includes("Hello World")).toBe(true);
  expect(initialOutput.includes("╭")).toBe(true); // Box border

  // Decrease width - should trigger clear and rerender
  stdout.columns = 50;
  stdout.emit("resize");
  await delay(100);

  // Verify the output was updated for smaller width
  const lastOutput = stripAnsi(getWriteContents(stdout).at(-1)!);
  expect(lastOutput.includes("Hello World")).toBe(true);
  expect(lastOutput.includes("╭")).toBe(true); // Box border
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
  expect(stripAnsi(lastOutput).includes("Test")).toBe(true);
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
  expect(afterFirstDecrease.includes("Content")).toBe(true);

  // Second decrease
  stdout.columns = 60;
  stdout.emit("resize");
  await delay(100);

  const afterSecondDecrease = stripAnsi(getWriteContents(stdout).at(-1)!);
  expect(afterFirstDecrease).not.toBe(afterSecondDecrease);
  expect(afterSecondDecrease.includes("Content")).toBe(true);
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
  expect(afterResizeOutput.includes("Test Content")).toBe(true);

  // Now try to rerender with a different component
  rerender(
    <Box borderStyle="round">
      <Text>Updated Content</Text>
    </Box>,
  );
  await delay(100);

  // Verify content was updated
  expect(stripAnsi(getWriteContents(stdout).at(-1)!).includes("Updated Content")).toBe(true);
});
