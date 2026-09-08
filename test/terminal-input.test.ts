import { expect, test, vi } from "vite-plus/test";

import { parseMouseEvent, TerminalInput } from "#/terminal/input.ts";

test("decodes chunked keys and consumes terminal reports", () => {
  const ingest = vi.fn((sequence: string) => sequence === "\u001B[I");
  const input = new TerminalInput({ ingest } as never);
  expect(input.push("a\u001B[")).toEqual(["a"]);
  expect(input.hasPendingEscape()).toBe(false);
  expect(input.push("Ib")).toEqual(["b"]);
  expect(ingest).toHaveBeenCalledWith("\u001B[I");
});

test("keeps bracketed paste as a separate event", () => {
  const input = new TerminalInput({ ingest: () => false } as never);
  expect(input.push("\u001B[200~hello\nworld\u001B[201~")).toEqual([{ paste: "hello\nworld" }]);
});

test("decodes zero-based SGR mouse events and removes them from key input", () => {
  expect(parseMouseEvent("\u001B[<20;4;3M")).toEqual({
    type: "press",
    x: 3,
    y: 2,
    button: "left",
    shift: true,
    alt: false,
    ctrl: true,
  });
  const input = new TerminalInput({ ingest: () => false } as never);
  const listener = vi.fn();
  input.subscribeMouse(listener);
  expect(input.push("\u001B[<64;2;5M")).toEqual([]);
  expect(listener).toHaveBeenCalledWith(
    expect.objectContaining({ type: "wheel", button: "wheel-up" }),
  );
});

const replies = [
  "\u001B[4;588;2009t",
  "\u001B[6;14;7t",
  "\u001B[?1;2c",
  "\u001B[?1u",
  "\u001B[?2004;1$y",
  "\u001B[?997;1n",
  "\u001B]10;rgb:ffff/ffff/ffff\u0007",
  "\u001B]11;rgb:0000/0000/0000\u001B\\",
  "\u001BP>|xterm(1.0)\u001B\\",
  "\u001BP1+r524742\u001B\\",
  "\u001B_Gi=31;OK\u001B\\",
];

test.each(replies)("consumes late query reply %j without a query listener", (reply) => {
  const input = new TerminalInput({ ingest: () => false } as never);
  expect(input.push(`before${reply}after`)).toEqual(["before", "after"]);
  expect(input.push(`\u001B[200~${reply}\u001B[201~`)).toEqual([{ paste: reply }]);
});

test.each(replies)("buffers split reply %j across an escape timeout", (reply) => {
  for (let split = 2; split < reply.length; split++) {
    const input = new TerminalInput({ ingest: () => false } as never);
    expect(input.push(reply.slice(0, split))).toEqual([]);
    expect(input.hasPendingEscape()).toBe(false);
    expect(input.flushPendingEscape()).toBeUndefined();
    expect(input.push(`${reply.slice(split)}typed`)).toEqual(["typed"]);
  }
  const input = new TerminalInput({ ingest: () => false } as never);
  for (const byte of reply) expect(input.push(byte)).toEqual([]);
});

test("preserves normal keys, literal reply-like text, and the Escape timeout", () => {
  const input = new TerminalInput({ ingest: () => false } as never);
  expect(input.push("[4;588;2009t")).toEqual(["[4;588;2009t"]);
  expect(input.push("\u001B[A\u001B[97u\u001Bb")).toEqual(["\u001B[A", "\u001B[97u", "\u001Bb"]);
  expect(input.push("\u001B")).toEqual([]);
  expect(input.hasPendingEscape()).toBe(true);
  expect(input.flushPendingEscape()).toBe("\u001B");
});

test.each(replies)("preserves Escape adjacent to a reply %j", (reply) => {
  const input = new TerminalInput({ ingest: () => false } as never);
  expect(input.push(`\u001B${reply}`)).toEqual(["\u001B"]);
  expect(input.push("\u001B")).toEqual([]);
  expect(input.push(reply)).toEqual(["\u001B"]);
  expect(input.push(`${reply}\u001B`)).toEqual([]);
  expect(input.flushPendingEscape()).toBe("\u001B");
});

test.each(["\u001B[4;588;", "\u001B]10;rgb:ffff/", "\u001BP>|xterm"])(
  "Ctrl+C interrupts an unfinished reply %j",
  (prefix) => {
    const input = new TerminalInput({ ingest: () => false } as never);
    expect(input.push(prefix)).toEqual([]);
    expect(input.push("\u0003")).toEqual(["\u0003"]);
    expect(input.push("typed")).toEqual(["typed"]);
  },
);

test("Escape cancels a truncated CSI report without inserting its prefix", () => {
  const input = new TerminalInput({ ingest: () => false } as never);
  expect(input.push("\u001B[4;588;")).toEqual([]);
  expect(input.push("\u001B")).toEqual([]);
  expect(input.flushPendingEscape()).toBe("\u001B");
});
