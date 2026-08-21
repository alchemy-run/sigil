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

const patchConsole = (callback: Callback): Restore => {
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

export default patchConsole;
