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
