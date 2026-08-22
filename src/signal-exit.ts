// Derived from `signal-exit` v3 (ISC, Ben Coe / Isaac Z. Schlueter),
// covering the surface Ink uses: run handlers when the process exits normally
// or would die from a fatal signal, `alwaysLast` ordering, and unsubscribe.
// Handlers receive `null` (not `undefined`) like the original package did —
// Ink's unmount() relies on that to detect process shutdown.
/* eslint-disable @typescript-eslint/no-restricted-types */
import { isWindows } from "#/env.ts";

type ExitHandler = (code: number | null, signal: NodeJS.Signals | null) => void;

type Registration = {
  handler: ExitHandler;
  alwaysLast: boolean;
};

const signals: NodeJS.Signals[] = isWindows
  ? ["SIGHUP", "SIGINT", "SIGTERM", "SIGBREAK"]
  : ["SIGHUP", "SIGINT", "SIGTERM", "SIGQUIT", "SIGUSR2"];

const registrations = new Set<Registration>();
const signalListeners = new Map<NodeJS.Signals, () => void>();
let loaded = false;
let emitted = false;

const emitExit = (code: number | null, signal: NodeJS.Signals | null): void => {
  if (emitted) {
    return;
  }

  emitted = true;

  const ordered = [...registrations].toSorted(
    (a, b) => Number(a.alwaysLast) - Number(b.alwaysLast),
  );

  for (const registration of ordered) {
    registration.handler(code, signal);
  }
};

const onExitEvent = (code: number): void => {
  emitExit(code, null);
};

const unload = (): void => {
  if (!loaded) {
    return;
  }

  loaded = false;
  process.off("exit", onExitEvent);

  for (const [signal, listener] of signalListeners) {
    process.off(signal, listener);
  }

  signalListeners.clear();
};

const load = (): void => {
  if (loaded) {
    return;
  }

  loaded = true;
  process.on("exit", onExitEvent);

  for (const signal of signals) {
    const listener = (): void => {
      // Only act when nothing else is handling this signal, meaning the
      // process would have died. Run handlers, then re-raise the signal with
      // default behavior restored so the exit code reflects the signal.
      if (process.listenerCount(signal) === 1) {
        unload();
        emitExit(null, signal);
        process.kill(process.pid, signal);
      }
    };

    try {
      process.on(signal, listener);
      signalListeners.set(signal, listener);
    } catch {}
  }
};

export const signalExit = (
  handler: ExitHandler,
  options: { alwaysLast?: boolean } = {},
): (() => void) => {
  const registration: Registration = {
    handler,
    alwaysLast: options.alwaysLast ?? false,
  };

  registrations.add(registration);
  load();

  return () => {
    registrations.delete(registration);

    if (registrations.size === 0) {
      unload();
    }
  };
};
