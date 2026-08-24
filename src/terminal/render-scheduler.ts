import { throttle, type Throttled } from "#/throttle.ts";

export type RenderScheduler = {
  readonly intervalMs: number;
  readonly throttled: Throttled<never[]> | undefined;
  readonly pending: boolean;
  readonly schedule: () => void;
  readonly immediate: () => void;
  markRendered: () => void;
};

/** Owns frame cadence independently of React reconciliation and terminal presentation. */
export function createRenderScheduler(
  render: () => void,
  options: { readonly unthrottled: boolean; readonly maxFps: number },
): RenderScheduler {
  const frameInterval = options.maxFps > 0 ? Math.max(1, Math.ceil(1000 / options.maxFps)) : 0;
  let pending = false;
  const throttled = options.unthrottled ? undefined : throttle(render, frameInterval);
  return {
    intervalMs: options.unthrottled ? 0 : frameInterval,
    throttled,
    get pending() {
      return pending;
    },
    schedule: options.unthrottled
      ? render
      : () => {
          pending = true;
          throttled!();
        },
    immediate: render,
    markRendered() {
      pending = false;
    },
  };
}
