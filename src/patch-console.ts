// Derived from `patch-console` (MIT, Vadim Demedes).
// Note: use the explicit `node:console` Console class — the global `console`
// is replaced by a proxy without `.Console` under some test runners.
import { Console } from "node:console";
import { PassThrough } from "node:stream";

const consoleMethods = [
  "assert",
  "count",
  "countReset",
  "debug",
  "dir",
  "dirxml",
  "error",
  "group",
  "groupCollapsed",
  "groupEnd",
  "info",
  "log",
  "table",
  "time",
  "timeEnd",
  "timeLog",
  "trace",
  "warn",
] as const;

type ConsoleMethod = (typeof consoleMethods)[number];

export type Callback = (stream: "stdout" | "stderr", data: string) => void;
export type Restore = () => void;

export const patchConsole = (callback: Callback): Restore => {
  const stdout = new PassThrough();
  const stderr = new PassThrough();

  stdout.write = (data: string | Uint8Array): boolean => {
    callback("stdout", String(data));
    return true;
  };

  stderr.write = (data: string | Uint8Array): boolean => {
    callback("stderr", String(data));
    return true;
  };

  const internalConsole = new Console(stdout, stderr);
  const originalMethods = new Map<ConsoleMethod, unknown>();

  for (const method of consoleMethods) {
    originalMethods.set(method, console[method]);
    (console as Record<ConsoleMethod, unknown>)[method] = internalConsole[method];
  }

  return () => {
    for (const method of consoleMethods) {
      (console as Record<ConsoleMethod, unknown>)[method] = originalMethods.get(method);
    }

    originalMethods.clear();
  };
};

// Intercept direct `write` calls on a stream. The write is swallowed and the
// decoded chunk is handed to `onData`; write callbacks still fire so callers
// awaiting flushes don't hang.
export const patchStreamWrite = (
  stream: NodeJS.WritableStream,
  onData: (data: string) => void,
): Restore => {
  // Keep the unbound reference: restore below must reassign the exact
  // original function object, not a bound copy.
  // oxlint-disable-next-line typescript/unbound-method
  const originalWrite = stream.write;

  const patchedWrite = (
    chunk: unknown,
    encodingOrCallback?: unknown,
    callback?: unknown,
  ): boolean => {
    const data =
      typeof chunk === "string"
        ? chunk
        : chunk instanceof Uint8Array
          ? Buffer.from(chunk).toString()
          : String(chunk);

    onData(data);

    const done =
      typeof encodingOrCallback === "function"
        ? encodingOrCallback
        : typeof callback === "function"
          ? callback
          : undefined;
    done?.();

    return true;
  };

  stream.write = patchedWrite;

  return () => {
    stream.write = originalWrite;
  };
};
