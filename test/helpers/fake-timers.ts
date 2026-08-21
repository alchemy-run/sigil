// `@sinonjs/fake-timers`-compatible clock on top of Vitest's fake timers
// (which use the same engine internally).
import { vi } from "vite-plus/test";

export type InstalledClock = {
  tick(ms: number): void;
  tickAsync(ms: number): Promise<void>;
  runAll(): void;
  countTimers(): number;
  uninstall(): void;
};

type InstallOptions = {
  readonly toFake?: readonly string[];
  readonly now?: number | Date;
};

const FakeTimers = {
  install(options: InstallOptions = {}): InstalledClock {
    vi.useFakeTimers({
      ...(options.toFake ? { toFake: [...options.toFake] as never[] } : {}),
      ...(options.now === undefined ? {} : { now: options.now }),
    });

    return {
      tick(ms) {
        vi.advanceTimersByTime(ms);
      },
      async tickAsync(ms) {
        await vi.advanceTimersByTimeAsync(ms);
      },
      runAll() {
        vi.runAllTimers();
      },
      countTimers() {
        return vi.getTimerCount();
      },
      uninstall() {
        vi.useRealTimers();
      },
    };
  },
};

export default FakeTimers;
