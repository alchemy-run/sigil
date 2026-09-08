import EventEmitter from "node:events";

import { vi, type Mock } from "vite-plus/test";

// Fake process.stdin: an EventEmitter dressed up as a TTY read stream, with
// vi.fn() mocks where tests need to observe calls (setRawMode, read, ref).
export type FakeStdin = Omit<
  NodeJS.ReadStream,
  "setRawMode" | "setEncoding" | "read" | "ref" | "unref" | "pause" | "resume"
> & {
  isTTY: boolean;
  pause: Mock<() => FakeStdin>;
  resume: Mock<() => FakeStdin>;
  setRawMode: Mock<(mode: boolean) => void>;
  setEncoding: (encoding?: BufferEncoding) => FakeStdin;
  read: NodeJS.ReadableStream["read"] & Mock<() => unknown>;
  ref: Mock<() => void>;
  unref: Mock<() => void>;
};

export const createStdin = (): FakeStdin => {
  const stdin = new EventEmitter() as unknown as FakeStdin;
  stdin.isTTY = true;
  stdin.pause = vi.fn(() => stdin);
  stdin.resume = vi.fn(() => stdin);
  stdin.setRawMode = vi.fn();
  stdin.setEncoding = () => stdin;
  stdin.read = vi.fn() as FakeStdin["read"];
  stdin.unref = vi.fn();
  stdin.ref = vi.fn();

  return stdin;
};

export const emitReadable = (stdin: FakeStdin, chunk: string): void => {
  stdin.read.mockReturnValueOnce(chunk).mockReturnValueOnce(null);
  stdin.emit("readable");
  stdin.read.mockReset();
};
