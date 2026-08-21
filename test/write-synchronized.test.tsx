import EventEmitter from "node:events";

import { expect, test } from "vite-plus/test";

import isInCi from "../src/is-in-ci.ts";
import { bsu, esu, shouldSynchronize } from "../src/write-synchronized.ts";

const createStream = ({ tty = false } = {}) => {
  const stream = new EventEmitter() as unknown as NodeJS.WriteStream;
  if (tty) {
    stream.isTTY = true;
  }

  return stream;
};

for (const [sequenceName, sequence, expected] of [
  ["bsu", bsu, "\u001B[?2026h"],
  ["esu", esu, "\u001B[?2026l"],
] as const) {
  test(`${sequenceName} is the expected synchronized update sequence`, () => {
    expect(sequence).toBe(expected);
  });
}

test("shouldSynchronize returns true for interactive TTY stream", () => {
  const stream = createStream({ tty: true });
  expect(shouldSynchronize(stream, true)).toBe(true);
});

test("shouldSynchronize returns false for non-interactive TTY stream", () => {
  const stream = createStream({ tty: true });
  expect(shouldSynchronize(stream, false)).toBe(false);
});

test("shouldSynchronize returns false for non-TTY stream", () => {
  const stream = createStream({ tty: false });
  expect(shouldSynchronize(stream, true)).toBe(false);
});

test("shouldSynchronize uses CI detection when interactive is not specified", () => {
  const ttyStream = createStream({ tty: true });
  // When interactive is omitted, shouldSynchronize falls back to is-in-ci.
  // In CI the result is false (non-interactive by design); outside CI it's true.
  if (isInCi) {
    expect(shouldSynchronize(ttyStream)).toBe(false);
  } else {
    expect(shouldSynchronize(ttyStream)).toBe(true);
  }
});

test("shouldSynchronize returns false for non-TTY stream when interactive is not specified", () => {
  const stream = createStream({ tty: false });
  expect(shouldSynchronize(stream)).toBe(false);
});
