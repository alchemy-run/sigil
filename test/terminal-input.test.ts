import { expect, test, vi } from "vite-plus/test";

import { parseMouseEvent, TerminalInput } from "#/terminal/input.ts";

test("decodes chunked keys and consumes terminal reports", () => {
  const ingest = vi.fn((sequence: string) => sequence === "\u001B[I");
  const input = new TerminalInput({ ingest } as never);
  expect(input.push("a\u001B[")).toEqual(["a"]);
  expect(input.hasPendingEscape()).toBe(true);
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
