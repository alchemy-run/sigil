import { EventEmitter } from "node:events";

import { expect, test, vi } from "vite-plus/test";

import { ansiEscapes } from "#/ansi/escapes.ts";
import { createCell } from "#/screen/cell.ts";
import { Screen } from "#/screen/screen.ts";
import { ScreenPresenter } from "#/terminal/screen-presenter.ts";

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

const presenter = () => {
  const stream = new EventEmitter() as NodeJS.WritableStream;
  const writes: string[] = [];
  stream.write = vi.fn((data: string) => {
    writes.push(data);
    return true;
  });
  const subject = new ScreenPresenter((data) => {
    writes.push(data);
    return true;
  }, stream);
  return { subject, writes };
};

test("rewrites only the suffix beginning at the first changed row", () => {
  const { subject, writes } = presenter();
  subject.present(frame("one", "two", "old", "end"), { colorProfile: "none" });
  writes.length = 0;

  subject.present(frame("one", "two", "new", "end"), { colorProfile: "none" });

  expect(writes).toEqual([ansiEscapes.eraseLines(3) + "new\nend\n"]);
});

test("rewrites an appended suffix without touching stable rows", () => {
  const { subject, writes } = presenter();
  subject.present(frame("one  ", "two  "), { colorProfile: "none" });
  writes.length = 0;

  subject.present(frame("one  ", "two  ", "three"), { colorProfile: "none" });

  expect(writes).toEqual([ansiEscapes.eraseLines(1) + "three\n"]);
});

test("erases removed rows while preserving the stable prefix", () => {
  const { subject, writes } = presenter();
  subject.present(frame("one  ", "two  ", "three", "four "), { colorProfile: "none" });
  writes.length = 0;

  subject.present(frame("one  ", "two  "), { colorProfile: "none" });

  expect(writes).toEqual([ansiEscapes.eraseLines(3)]);
});

test("uses a full rewrite when width or presentation mode changes", () => {
  const { subject, writes } = presenter();
  subject.present(frame("one", "two"), { colorProfile: "none" });
  writes.length = 0;

  subject.present(frame("wide", "two!"), { colorProfile: "none" });
  expect(writes).toEqual([ansiEscapes.eraseLines(3) + "wide\ntwo!\n"]);

  writes.length = 0;
  subject.present(frame("wide", "two!"), { colorProfile: "none", fullscreen: true });
  expect(writes).toEqual([ansiEscapes.eraseLines(3) + "wide\ntwo!"]);
});

test("forceRewrite bypasses suffix rendering", () => {
  const { subject, writes } = presenter();
  subject.present(frame("one", "two", "old"), { colorProfile: "none" });
  writes.length = 0;

  subject.present(frame("one", "two", "new"), {
    colorProfile: "none",
    forceRewrite: true,
  });

  expect(writes).toEqual([ansiEscapes.eraseLines(4) + "one\ntwo\nnew\n"]);
});

test("clear erases the rewrapped footprint when the terminal got narrower", () => {
  const { subject, writes } = presenter();
  subject.present(frame("short", "a line of twenty chars", "end"), { colorProfile: "none" });
  writes.length = 0;

  // At 10 columns the emulator rewraps the 22-cell row onto three rows.
  subject.clear({ columns: 10 });

  expect(writes).toEqual([ansiEscapes.eraseLines(1 + 3 + 1 + 1)]);
});

test("clear keeps the logical line count when the terminal is at least as wide", () => {
  const { subject, writes } = presenter();
  subject.present(frame("short", "a line of twenty chars", "end"), { colorProfile: "none" });
  writes.length = 0;

  subject.clear({ columns: 22 });
  subject.clear();

  expect(writes).toEqual([ansiEscapes.eraseLines(4), ansiEscapes.eraseLines(0)]);
});

test("clear ignores trailing blank padding but counts styled blanks", () => {
  const { subject, writes } = presenter();
  const screen = frame("ab   ", "c    ");
  for (let x = 1; x < 5; x++) {
    screen.setCell(
      x,
      1,
      createCell(" ", 1, {
        underline: "none",
        attributes: 0,
        background: { model: "rgb", red: 1, green: 2, blue: 3, alpha: 1 },
      }),
    );
  }
  subject.present(screen, { colorProfile: "none" });
  writes.length = 0;

  subject.clear({ columns: 2 });

  // "ab" fits one row; "c" plus four highlighted blanks is five cells → three rows.
  expect(writes).toEqual([ansiEscapes.eraseLines(1 + 3 + 1)]);
});
