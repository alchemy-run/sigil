import EventEmitter from "node:events";

import { vi, type Mock } from "vite-plus/test";

// Fake process.stdout: `write` is a vi.fn() so tests can inspect calls
// (`stdout.write.mock.lastCall`, `.mock.calls`, …) without casting.
export type FakeStdout = Omit<NodeJS.WriteStream, "write"> & {
  write: NodeJS.WriteStream["write"] & Mock<(chunk: string, ...rest: unknown[]) => boolean>;
  get: () => string;
  getWrites: () => string[];
};

const createStdout = (columns?: number, isTTY?: boolean): FakeStdout => {
  const stdout = new EventEmitter() as unknown as FakeStdout;
  stdout.columns = columns ?? 100;
  stdout.isTTY = isTTY ?? true;

  const write = vi.fn((...args: [chunk: string, ...rest: unknown[]]) => {
    // `write(chunk, cb)` and `write(chunk, encoding, cb)` both put the
    // callback last; Node invokes it asynchronously, so match that.
    const callback = args.at(-1);
    if (typeof callback === "function") {
      queueMicrotask(callback as () => void);
    }

    return true;
  });
  stdout.write = write;

  stdout.get = () => write.mock.calls.findLast(([chunk]) => chunk.length > 0)?.[0] ?? "";

  stdout.getWrites = () => write.mock.calls.map(([chunk]) => chunk);

  return stdout;
};

export default createStdout;
