import { expect, test } from "vite-plus/test";

import { ansiEscapes } from "#/ansi/escapes.ts";
import { stripAnsi } from "#/ansi/strip.ts";
import { Text, render, useCursor } from "#/index.ts";
import { createCell } from "#/screen/cell.ts";
import { Screen } from "#/screen/screen.ts";
import { ScreenPresenter } from "#/terminal/screen-presenter.ts";

import createStdout from "./helpers/create-stdout.ts";
import { reconstructTerminalLines } from "./helpers/reconstruct-terminal.ts";

function Example() {
  const { setCursorPosition } = useCursor();
  setCursorPosition({ x: 2, y: 0 });
  return <Text>{"Header\nFooter"}</Text>;
}

test("unmount returns a positioned cursor below the frame", async () => {
  const stdout = createStdout(100, true, 10);
  const instance = render(<Example />, { stdout, interactive: true, patchConsole: false });

  try {
    await instance.waitUntilRenderFlush();
    instance.unmount();
    await instance.waitUntilExit();

    const output = stdout.getWrites().join("") + "$ command";
    const lines = reconstructTerminalLines(output.replaceAll("\n", "\r\n"), 10);
    expect(lines.slice(0, 3)).toEqual(["Header", "Footer", "$ command"]);
  } finally {
    instance.unmount();
  }
});

test("done returns the cursor once without erasing output", () => {
  const writes: string[] = [];
  const stdout = createStdout();
  const presenter = new ScreenPresenter((data) => {
    writes.push(data);
    return true;
  }, stdout);
  const screen = new Screen(6, 2);
  for (const [y, line] of ["Header", "Footer"].entries()) {
    for (let x = 0; x < line.length; x++) screen.setCell(x, y, createCell(line.charAt(x), 1));
  }
  presenter.present(screen, { colorProfile: "none", cursor: { x: 2, y: 0 } });

  const beforeDone = writes.length;
  presenter.done();
  expect(writes.slice(beforeDone)).toEqual([ansiEscapes.cursorDown(2) + ansiEscapes.cursorTo(0)]);
  presenter.done();
  expect(writes.length).toBe(beforeDone + 1);
});

test("alternate-screen exit does not reposition the primary cursor", async () => {
  const stdout = createStdout(100, true, 10);
  const instance = render(<Example />, {
    stdout,
    interactive: true,
    alternateScreen: true,
    patchConsole: false,
  });

  try {
    await instance.waitUntilRenderFlush();
    instance.unmount();
    await instance.waitUntilExit();
    const output = stdout.getWrites().join("");
    const exitIndex = output.lastIndexOf(ansiEscapes.exitAlternativeScreen);
    expect(exitIndex).toBeGreaterThanOrEqual(0);
    const restoredScreen = output.slice(exitIndex + ansiEscapes.exitAlternativeScreen.length);
    // Showing the cursor is allowed after restoring the primary screen, but moving it is not.
    expect(restoredScreen.replaceAll(ansiEscapes.cursorShow, "")).toBe("");
    expect(stripAnsi(restoredScreen)).toBe("");
  } finally {
    instance.unmount();
  }
});
