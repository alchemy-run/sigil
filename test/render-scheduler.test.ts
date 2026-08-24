import { expect, test, vi } from "vite-plus/test";

import { createRenderScheduler } from "#/terminal/render-scheduler.ts";

test("runs immediate sessions synchronously", () => {
  const render = vi.fn();
  const scheduler = createRenderScheduler(render, { unthrottled: true, maxFps: 30 });
  scheduler.schedule();
  expect(render).toHaveBeenCalledOnce();
  expect(scheduler.intervalMs).toBe(0);
  expect(scheduler.pending).toBe(false);
});

test("coalesces scheduled frames and exposes pending state", () => {
  vi.useFakeTimers();
  const render = vi.fn();
  const scheduler = createRenderScheduler(render, { unthrottled: false, maxFps: 20 });
  scheduler.schedule();
  scheduler.schedule();
  scheduler.schedule();
  expect(scheduler.intervalMs).toBe(50);
  expect(scheduler.pending).toBe(true);
  expect(render).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(50);
  expect(render).toHaveBeenCalledTimes(2);
  scheduler.markRendered();
  expect(scheduler.pending).toBe(false);
  vi.useRealTimers();
});
