import { setTimeout as delay } from "node:timers/promises";

import React from "react";
import { expect, test, afterAll } from "vite-plus/test";

import { stripAnsi } from "#/ansi/strip.ts";
import { getCapabilities } from "#/capabilities/store.ts";
import { render, Box, Text, useCursor, useWindowSize } from "#/index.ts";

import { createStdin } from "./helpers/create-stdin.ts";
import createStdout, { type FakeStdout } from "./helpers/create-stdout.ts";
import { reconstructTerminalLines } from "./helpers/reconstruct-terminal.ts";

const getWriteContents = (stdout: FakeStdout): string[] =>
  stdout
    .getWrites()
    .filter((w) => w.length > 0 && !w.startsWith("\u001B[?25") && !w.startsWith("\u001B[?2026"));

test("useWindowSize catches resizes before its subscription is installed", async () => {
  const stdout = createStdout(100);
  stdout.rows = 40;
  let initialSize: string | undefined;

  function Test() {
    const { columns, rows } = useWindowSize();
    initialSize ??= `${columns}x${rows}`;

    React.useLayoutEffect(() => {
      stdout.columns = 60;
      stdout.rows = 20;
      stdout.emit("resize");
    }, []);

    return (
      <Text>
        {columns}x{rows}
      </Text>
    );
  }

  const { unmount, waitUntilRenderFlush } = render(<Test />, { stdout, debug: true });
  try {
    await waitUntilRenderFlush();
    await delay(100);

    expect(initialSize).toBe("100x40");
    expect(stdout.get()).toBe("60x20");
  } finally {
    unmount();
  }
});

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

for (const isTty of [false, true]) {
  test(`resolve the terminal-size fallback once per stream instead of on every render (isTTY: ${String(isTty)})`, async () => {
    const stdout = createStdout(0, isTty);
    const originalColumns = process.env.COLUMNS;
    const originalLines = process.env.LINES;
    const originalSizes = [process.stdout, process.stderr].map(
      (stream) => [stream, stream.columns, stream.rows] as const,
    );

    try {
      process.env.COLUMNS = "30";
      process.env.LINES = "10";
      for (const [stream] of originalSizes) {
        stream.columns = 0;
        stream.rows = 0;
      }

      function Test({ label }: { readonly label: string }) {
        return (
          <Box borderStyle="single">
            <Text>{label}</Text>
          </Box>
        );
      }

      const { rerender, unmount, waitUntilRenderFlush } = render(<Test label="first" />, {
        stdout,
        debug: true,
      });
      await waitUntilRenderFlush();

      process.env.COLUMNS = "50";
      rerender(<Test label="second" />);
      await waitUntilRenderFlush();
      unmount();

      const lastFrame = stripAnsi(
        stdout.getWrites().findLast((write) => write.includes("second")) ?? "",
      );
      const topBorder = lastFrame.split("\n").find((line) => line.startsWith("┌")) ?? "";
      expect(topBorder.length).toBe(30);
    } finally {
      for (const [name, value] of [
        ["COLUMNS", originalColumns],
        ["LINES", originalLines],
      ] as const) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      for (const [stream, columns, rows] of originalSizes) {
        stream.columns = columns;
        stream.rows = rows;
      }
    }
  });
}

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

// In-band size reports (mode 2048) come from the emulator itself, after it
// has rewrapped, so the renderer acts on them at once instead of waiting for
// the PTY-driven size to settle.
test("an in-band size report repaints immediately at the reported width", async () => {
  const stdout = createStdout(100);
  stdout.rows = 30;

  function Test() {
    const { columns } = useWindowSize();
    return (
      <Box borderStyle="round">
        <Text>{columns} wide</Text>
      </Box>
    );
  }

  const { waitUntilRenderFlush, unmount } = render(<Test />, { stdout });
  await waitUntilRenderFlush();
  expect(stripAnsi(getWriteContents(stdout).at(-1)!)).toContain("100 wide");

  const store = getCapabilities(process.stdin, stdout);
  const writesBefore = stdout.getWrites().length;
  // The PTY still says 100 columns; the emulator reports 60.
  expect(store.ingest("\u001B[48;30;60;0;0t")).toBe(true);
  await waitUntilRenderFlush();

  const afterReport = stripAnsi(stdout.getWrites().slice(writesBefore).join(""));
  expect(afterReport, "the report repaints without the settle delay").toContain("60 wide");
  const frame = getWriteContents(stdout).at(-1)!;
  const topBorder = stripAnsi(frame).split("\n")[0];
  expect(topBorder.length, "the frame is laid out at the reported width").toBe(60);

  unmount();
});

test("window-size-only consumers never query the terminal or change raw mode", async () => {
  const stdin = createStdin();
  const stdout = createStdout(100);
  function Size() {
    const { columns } = useWindowSize();
    return <Text>{columns}</Text>;
  }
  for (let mount = 0; mount < 3; mount++) {
    const instance = render(<Size />, { stdin, stdout, interactive: true });
    await instance.waitUntilRenderFlush();
    instance.unmount();
  }
  expect(stdout.getWrites().join("")).not.toContain("\u001B]10;?");
  expect(stdout.getWrites().join("")).not.toContain("\u001B[c");
  expect(stdin.setRawMode).not.toHaveBeenCalledWith(true);
});

// Replays the writes on a 10-row terminal below three shell lines, shrinking it
// to `rows` after the first `writesBeforeResize` writes. Only trailing empty
// rows are dropped, so a stray blank row inside the output still fails.
const screenAfterShrink = (
  stdout: FakeStdout,
  writesBeforeResize: number,
  rows: number,
): string[] => {
  const writes = stdout.getWrites().map((write) => write.replaceAll("\n", "\r\n"));
  const lines = reconstructTerminalLines(
    [
      "shell 0\r\nshell 1\r\nshell 2\r\n",
      ...writes.slice(0, writesBeforeResize),
      { rows },
      ...writes.slice(writesBeforeResize),
    ],
    10,
  );

  while (lines.at(-1) === "") lines.pop();
  return lines;
};

const shell = ["shell 0", "shell 1", "shell 2"];
const letters = ["A", "B", "C", "D", "E", "F"];

function CursorFrame({
  suffix = "",
  cursorY,
}: {
  readonly suffix?: string;
  readonly cursorY: number | undefined;
}) {
  const { setCursorPosition } = useCursor();
  setCursorPosition(cursorY === undefined ? undefined : { x: 0, y: cursorY });

  return (
    <Box flexDirection="column">
      {letters.map((letter) => (
        <Text key={letter}>{letter + suffix}</Text>
      ))}
    </Box>
  );
}

for (const { cursorY, rows } of [
  { cursorY: 0, rows: 8 },
  // The cursor has fewer rows below it than the shrink removes, so the
  // terminal also scrolls the top off.
  { cursorY: 4, rows: 7 },
]) {
  test(`rows shrink with a cursor above the output bottom keeps lines above the frame - cursor row ${cursorY}, ${rows} rows`, async () => {
    const stdout = createStdout(100, true, 10);
    const { rerender, unmount, waitUntilRenderFlush } = render(<CursorFrame cursorY={cursorY} />, {
      stdout,
    });

    try {
      await waitUntilRenderFlush();

      const writesBeforeResize = stdout.getWrites().length;
      stdout.rows = rows;
      stdout.emit("resize");
      await delay(100);
      await waitUntilRenderFlush();

      // The shrink drops the frame rows below the cursor, so they have to be repainted.
      expect(screenAfterShrink(stdout, writesBeforeResize, rows)).toEqual([...shell, ...letters]);

      rerender(<CursorFrame suffix="!" cursorY={cursorY} />);
      await waitUntilRenderFlush();

      expect(screenAfterShrink(stdout, writesBeforeResize, rows)).toEqual([
        ...shell,
        ...letters.map((letter) => letter + "!"),
      ]);
    } finally {
      unmount();
    }
  });
}

test("rows shrink right after a commit clears the cursor keeps lines above the frame", async () => {
  const stdout = createStdout(100, true, 10);
  const { rerender, unmount, waitUntilRenderFlush } = render(<CursorFrame cursorY={0} />, {
    stdout,
  });

  try {
    await waitUntilRenderFlush();

    // The commit clears the cursor, but its frame is still throttled, so the
    // terminal still shows the cursor when the rows shrink.
    rerender(<CursorFrame cursorY={undefined} />);
    const writesBeforeResize = stdout.getWrites().length;
    stdout.rows = 8;
    stdout.emit("resize");
    await delay(100);
    await waitUntilRenderFlush();

    expect(screenAfterShrink(stdout, writesBeforeResize, 8)).toEqual([...shell, ...letters]);
  } finally {
    unmount();
  }
});

test("width and height shrinking together keeps lines above the frame", async () => {
  const stdout = createStdout(100, true, 10);
  const { unmount, waitUntilRenderFlush } = render(<CursorFrame cursorY={0} />, { stdout });

  try {
    await waitUntilRenderFlush();

    const writesBeforeResize = stdout.getWrites().length;
    // Pairing a width decrease with a height decrease must still use the
    // committed cursor position to find what to erase.
    stdout.columns = 50;
    stdout.rows = 6;
    stdout.emit("resize");
    await delay(100);
    await waitUntilRenderFlush();

    expect(screenAfterShrink(stdout, writesBeforeResize, 6)).toEqual([...shell, ...letters]);
  } finally {
    unmount();
  }
});

const sixLines = Array.from({ length: 6 }, (_, index) => `line ${index}`);

function SixLines() {
  return (
    <Box flexDirection="column">
      {sixLines.map((line) => (
        <Text key={line}>{line}</Text>
      ))}
    </Box>
  );
}

function CursorSixLines({ cursorRow }: { readonly cursorRow?: number }) {
  const { setCursorPosition } = useCursor();
  setCursorPosition(cursorRow === undefined ? undefined : { x: 0, y: cursorRow });
  return <SixLines />;
}

test("rewrites the frame when the terminal height shrinks onto it", async () => {
  const stdout = createStdout(40, true, 10);
  const { unmount, waitUntilRenderFlush } = render(<SixLines />, { stdout });

  try {
    await waitUntilRenderFlush();

    const writesBefore = stdout.getWrites().length;
    // The frame now exactly fills the viewport, and the terminal scrolled its
    // top row into scrollback when it shrank, so the viewport must be redrawn.
    stdout.rows = 6;
    stdout.emit("resize");
    await delay(100);
    await waitUntilRenderFlush();

    expect(screenAfterShrink(stdout, writesBefore, 6).slice(-6)).toEqual(sixLines);
  } finally {
    unmount();
  }
});

for (const { description, initialCursorRow, shrink } of [
  {
    description: "a custom cursor sits on it",
    initialCursorRow: 0,
    shrink: (stdout: FakeStdout) => {
      stdout.emit("resize");
    },
  },
  {
    description: "the same render moves a custom cursor",
    initialCursorRow: 4,
    shrink: (stdout: FakeStdout, rerender: (tree: React.ReactNode) => void) => {
      stdout.emit("resize");
      rerender(<CursorSixLines cursorRow={2} />);
    },
  },
]) {
  test(`keeps content above the frame when the terminal height shrinks onto it and ${description}`, async () => {
    const stdout = createStdout(40, true, 10);
    const { unmount, rerender, waitUntilRenderFlush } = render(
      <CursorSixLines cursorRow={initialCursorRow} />,
      { stdout },
    );

    try {
      await waitUntilRenderFlush();

      const writesBefore = stdout.getWrites().length;
      stdout.rows = 6;
      shrink(stdout, rerender);
      await delay(100);
      await waitUntilRenderFlush();

      // The frame now exactly fills the viewport. Replay the stream on a
      // modelled terminal with shell output above the frame.
      expect(screenAfterShrink(stdout, writesBefore, 6).filter(Boolean)).toEqual([
        ...shell,
        ...sixLines,
      ]);
    } finally {
      unmount();
    }
  });
}
