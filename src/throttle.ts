// Derived from `throttle` from `es-toolkit/compat` (lodash-style),
// covering the surface Ink uses: leading + trailing edges, cancel() and flush().

export type Throttled<Arguments extends unknown[]> = {
  (...args: Arguments): void;
  cancel: () => void;
  flush: () => void;
};

/**
Invokes `fn` at most once per `wait` milliseconds.

The first call in a window fires immediately (leading edge). Calls made while
the window is open are coalesced into a single trailing invocation with the
latest arguments. Matches the lodash semantics Ink relied on: a single call
produces only a leading invocation, no trailing one.
*/
export const throttle = <Arguments extends unknown[]>(
  fn: (...args: Arguments) => void,
  wait = 0,
): Throttled<Arguments> => {
  let timer: NodeJS.Timeout | undefined;
  let pendingArgs: Arguments | undefined;

  const invokePending = (): void => {
    const args = pendingArgs!;
    pendingArgs = undefined;
    fn(...args);
  };

  const onTimer = (): void => {
    if (pendingArgs) {
      invokePending();
      timer = setTimeout(onTimer, wait);
    } else {
      timer = undefined;
    }
  };

  const throttled = (...args: Arguments): void => {
    if (timer) {
      pendingArgs = args;
      return;
    }

    fn(...args);
    timer = setTimeout(onTimer, wait);
  };

  throttled.cancel = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }

    pendingArgs = undefined;
  };

  throttled.flush = (): void => {
    if (!pendingArgs) {
      return;
    }

    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }

    invokePending();
  };

  return throttled;
};
