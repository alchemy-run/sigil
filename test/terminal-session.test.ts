import { EventEmitter } from "node:events";

import { expect, test, vi } from "vite-plus/test";

import { ansiEscapes } from "#/ansi/escapes.ts";
import { setClipboard, setTerminalProgress } from "#/ansi/osc.ts";
import { createCell } from "#/screen/cell.ts";
import { Screen } from "#/screen/screen.ts";
import { TerminalSession } from "#/terminal/index.ts";

const frame = (...lines: string[]): Screen => {
  const width = Math.max(0, ...lines.map((line) => line.length));
  const screen = new Screen(width, lines.length);
  for (const [y, line] of lines.entries()) {
    for (let x = 0; x < line.length; x++) {
      screen.setCell(x, y, createCell(line.charAt(x), 1));
    }
  }
  return screen;
};

const streams = () => {
  const stdin = new EventEmitter() as NodeJS.ReadableStream;
  const stdout = new EventEmitter() as NodeJS.WriteStream;
  const stderr = new EventEmitter() as NodeJS.WriteStream;
  stdout.isTTY = true;
  const write = vi.fn((_data: unknown, callback?: () => void) => {
    callback?.();
    return true;
  });
  stdout.write = write as never;
  stderr.write = vi.fn(() => true);
  return { stdin, stdout, stderr, write };
};

test("owns profile, writes, modes, and idempotent cleanup per stream", async () => {
  const { stdin, stdout, stderr, write } = streams();
  const session = new TerminalSession({ stdin, stdout, stderr, colorPolicy: "ansi256" });
  expect(session.colorProfile).toBe("ansi256");
  session.enableMode("on", "off");
  session.write("frame");
  await session.flush();
  session.cleanup();
  session.cleanup();
  expect(write.mock.calls.map(([value]) => value)).toEqual(["on", "frame", "off"]);
});

test("owns clipboard writes and terminal progress cleanup", () => {
  const { stdin, stdout, stderr, write } = streams();
  const session = new TerminalSession({ stdin, stdout, stderr });
  session.copyToClipboard("secret");
  session.setProgress("normal", 25);
  session.cleanup();

  expect(write.mock.calls.map(([value]) => value)).toEqual([
    setClipboard("secret"),
    setTerminalProgress("normal", 25),
    setTerminalProgress("inactive"),
  ]);
});

test("refreshes active terminal progress until stopped", () => {
  vi.useFakeTimers();
  try {
    const { stdin, stdout, stderr, write } = streams();
    const session = new TerminalSession({ stdin, stdout, stderr });
    session.setProgress("indeterminate");

    vi.advanceTimersByTime(3000);
    expect(write.mock.calls.map(([value]) => value)).toEqual([
      setTerminalProgress("indeterminate"),
      setTerminalProgress("indeterminate"),
      setTerminalProgress("indeterminate"),
      setTerminalProgress("indeterminate"),
    ]);

    session.setProgress("inactive");
    vi.advanceTimersByTime(3000);
    expect(write).toHaveBeenCalledTimes(5);
    session.cleanup();
  } finally {
    vi.useRealTimers();
  }
});

test("reference-counts modes and owns screen and suspension state", () => {
  const { stdin, stdout, stderr, write } = streams();
  const session = new TerminalSession({ stdin, stdout, stderr });
  session.enableMode({ id: "mouse", enable: "mouse-on", disable: "mouse-off" });
  session.enableMode({ id: "mouse", enable: "mouse-on", disable: "mouse-off" });
  session.disableMode("mouse");
  expect(write.mock.calls.map(([value]) => value)).toEqual(["mouse-on"]);
  session.disableMode("mouse");
  session.setAlternateScreen(true);
  expect(session.inlineScreen).toBe(false);
  session.beginSuspension();
  expect(session.suspended).toBe(true);
  session.resume();
  expect(session.suspended).toBe(false);
  session.cleanup();
  expect(write.mock.calls.map(([value]) => value)).toEqual([
    "mouse-on",
    "mouse-off",
    "\u001B[?1049h",
    "\u001B[?1049l",
  ]);
});

test("owns sparse presentation and invalidates frames across terminal transitions", () => {
  const { stdin, stdout, stderr, write } = streams();
  const session = new TerminalSession({ stdin, stdout, stderr, colorPolicy: "none" });
  session.present(frame("one", "old"));
  write.mockClear();

  session.present(frame("one", "new"));
  expect(write.mock.calls.map(([value]) => value)).toEqual([ansiEscapes.eraseLines(2) + "new\n"]);

  session.setAlternateScreen(true);
  write.mockClear();
  session.present(frame("one", "new"), { fullscreen: true });
  expect(write.mock.calls.map(([value]) => value)).toEqual(["one\nnew"]);

  session.beginSuspension();
  session.resume();
  write.mockClear();
  session.present(frame("one", "new"), { fullscreen: true });
  expect(write.mock.calls.map(([value]) => value)).toEqual(["one\nnew"]);
  session.cleanup();
});

test("tracks cursor position, appearance, and color", () => {
  const { stdin, stdout, stderr, write } = streams();
  const session = new TerminalSession({ stdin, stdout, stderr });
  session.setCursor({ x: 2, y: 1 });
  session.setCursorAppearance({ shape: "bar", blinking: false, color: "#123456" });
  expect(session.cursor).toEqual({
    position: { x: 2, y: 1 },
    visible: true,
    shape: "bar",
    blinking: false,
    color: "#123456",
  });
  expect(write).toHaveBeenCalledWith("\u001B[6 q\u001B]12;#123456\u0007", expect.any(Function));
});

test("does not leave a pending flush when a write throws", async () => {
  const { stdin, stdout, stderr } = streams();
  stdout.write = vi.fn(() => {
    throw new Error("closed");
  });
  const session = new TerminalSession({ stdin, stdout, stderr });
  expect(() => session.write("frame")).toThrow("closed");
  await expect(session.flush()).resolves.toBeUndefined();
});

test("matches a reference model across cursor and mode transitions", () => {
  const { stdin, stdout, stderr, write } = streams();
  const session = new TerminalSession({ stdin, stdout, stderr });
  const counts = new Map<string, number>();
  const expectedWrites: string[] = [];
  let state = 0x5e_55_10;
  const random = (limit: number) => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state % limit;
  };

  for (let step = 0; step < 500; step++) {
    if (random(3) === 0) {
      const position = { x: random(80), y: random(24) };
      session.setCursor(position);
      expect(session.cursor.position).toEqual(position);
      continue;
    }
    const id = random(2) === 0 ? "mouse" : "paste";
    const count = counts.get(id) ?? 0;
    if (random(2) === 0) {
      session.enableMode({ id, enable: `${id}-on`, disable: `${id}-off` });
      counts.set(id, count + 1);
      if (count === 0) expectedWrites.push(`${id}-on`);
    } else {
      session.disableMode(id);
      if (count > 1) counts.set(id, count - 1);
      else if (count === 1) {
        counts.delete(id);
        expectedWrites.push(`${id}-off`);
      }
    }
  }
  session.cleanup();
  for (const id of [...counts.keys()].reverse()) expectedWrites.push(`${id}-off`);
  expect(write.mock.calls.map(([value]) => value)).toEqual(expectedWrites);
});
