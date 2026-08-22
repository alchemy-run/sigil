import { setTimeout as delay } from "node:timers/promises";

import React, { Suspense, startTransition } from "react";
import { expect, test } from "vite-plus/test";

import { render, Text, useAnimation } from "../src/index.ts";
import { act } from "./helpers/act.ts";
import createStdout from "./helpers/create-stdout.ts";
import FakeTimers from "./helpers/fake-timers.ts";
import mockTimerCalls from "./helpers/mock-timer-calls.ts";

function AnimatedCounter({ interval }: { readonly interval?: number }) {
  const { frame } = useAnimation({ interval });
  return <Text>{String(frame)}</Text>;
}

function ConditionalAnimation({
  isActive,
  interval,
}: {
  readonly isActive: boolean;
  readonly interval?: number;
}) {
  const { frame } = useAnimation({ interval, isActive });
  return <Text>{String(frame)}</Text>;
}

test("frame increments over time", async () => {
  const stdout = createStdout();
  const { unmount } = render(<AnimatedCounter interval={50} />, {
    stdout,
    debug: true,
  });

  await delay(20);
  expect(stdout.write.mock.lastCall![0]).toBe("0");

  await delay(80);
  const frame = Number.parseInt(stdout.write.mock.lastCall![0], 10);
  expect(frame >= 1).toBe(true);
  unmount();
});

test("does not update when isActive is false", async () => {
  const stdout = createStdout();
  const { unmount } = render(<ConditionalAnimation isActive={false} interval={50} />, {
    stdout,
    debug: true,
  });

  await delay(20);
  expect(stdout.write.mock.lastCall![0]).toBe("0");

  await delay(120);
  expect(stdout.write.mock.lastCall![0]).toBe("0");
  unmount();
});

test("multiple animations with the same interval stay in sync", async () => {
  function MultiSpinner() {
    const { frame: frame1 } = useAnimation({ interval: 50 });
    const { frame: frame2 } = useAnimation({ interval: 50 });
    return (
      <Text>
        {String(frame1)},{String(frame2)}
      </Text>
    );
  }

  const stdout = createStdout();
  const { unmount } = render(<MultiSpinner />, {
    stdout,
    debug: true,
  });

  await delay(20);
  expect(stdout.write.mock.lastCall![0]).toBe("0,0");

  await delay(100);
  const output = stdout.write.mock.lastCall![0];
  const [a, b] = output.split(",").map(Number);
  // Both frames should be equal since they use the same interval.
  expect(a).toBe(b);
  expect(a >= 1).toBe(true);
  unmount();
});

test("multiple animations with the same interval share one timer", async () => {
  const clock = FakeTimers.install();
  const mocks = mockTimerCalls();

  try {
    function MultiSpinner() {
      const { frame: frame1 } = useAnimation({ interval: 50 });
      const { frame: frame2 } = useAnimation({ interval: 50 });
      return (
        <Text>
          {String(frame1)},{String(frame2)}
        </Text>
      );
    }

    const stdout = createStdout();
    const { unmount } = render(<MultiSpinner />, {
      stdout,
      debug: true,
    });

    expect(mocks.setTimeoutCallCount >= 1).toBe(true);
    expect(mocks.timeoutDelays.every((timeoutDelay) => timeoutDelay === 50)).toBe(true);

    await clock.tickAsync(100);
    const output = stdout.write.mock.lastCall![0];
    const [frame1, frame2] = output.split(",").map(Number);
    expect(frame1).toBe(frame2);
    expect(frame1 >= 1).toBe(true);

    unmount();
  } finally {
    mocks.restore();
    clock.uninstall();
  }
});

test("animations with different intervals still use the shared timer", async () => {
  const clock = FakeTimers.install();
  const mocks = mockTimerCalls();

  try {
    function MultiSpinner() {
      const { frame: fastFrame } = useAnimation({ interval: 50 });
      const { frame: slowFrame } = useAnimation({ interval: 80 });
      return (
        <Text>
          {String(fastFrame)},{String(slowFrame)}
        </Text>
      );
    }

    const stdout = createStdout();
    const { unmount } = render(<MultiSpinner />, {
      stdout,
      debug: true,
    });

    expect(mocks.timeoutDelays.every((timeoutDelay) => timeoutDelay >= 50)).toBe(true);

    await clock.tickAsync(170);
    const output = stdout.write.mock.lastCall![0];
    const [fastFrame, slowFrame] = output.split(",").map(Number);
    expect(fastFrame > slowFrame).toBe(true);

    unmount();
  } finally {
    mocks.restore();
    clock.uninstall();
  }
});

test("shared timer is cleaned up and recreated after the last animation unmounts", async () => {
  const clock = FakeTimers.install();
  const mocks = mockTimerCalls();

  try {
    const stdout = createStdout();
    const firstRender = render(<AnimatedCounter interval={50} />, {
      stdout,
      debug: true,
    });

    expect(mocks.setTimeoutCallCount >= 1).toBe(true);

    firstRender.unmount();
    expect(mocks.clearTimeoutCallCount >= 1).toBe(true);

    const secondRender = render(<AnimatedCounter interval={50} />, {
      stdout,
      debug: true,
    });

    expect(mocks.setTimeoutCallCount).toBe(2);

    await clock.tickAsync(120);
    expect(Number.parseInt(stdout.write.mock.lastCall![0], 10) >= 1).toBe(true);

    secondRender.unmount();
    expect(mocks.clearTimeoutCallCount >= 2).toBe(true);
  } finally {
    mocks.restore();
    clock.uninstall();
  }
});

test("shared timer stays alive while another same-interval animation remains mounted", async () => {
  const clock = FakeTimers.install();
  const mocks = mockTimerCalls();

  try {
    function AnimationValue() {
      const { frame } = useAnimation({ interval: 50 });
      return <Text>{String(frame)}</Text>;
    }

    function MaybeDualAnimation({ showSecond }: { readonly showSecond: boolean }) {
      return (
        <>
          <AnimationValue />
          {showSecond ? <Text>,</Text> : undefined}
          {showSecond ? <AnimationValue /> : undefined}
        </>
      );
    }

    const stdout = createStdout();
    const { rerender, unmount } = render(<MaybeDualAnimation showSecond />, {
      stdout,
      debug: true,
    });

    expect(mocks.setTimeoutCallCount >= 1).toBe(true);

    await clock.tickAsync(120);
    const frameBeforeUnmount = Number.parseInt(stdout.write.mock.lastCall![0].split(",")[0], 10);
    expect(frameBeforeUnmount >= 1).toBe(true);

    rerender(<MaybeDualAnimation showSecond={false} />);

    expect(mocks.setTimeoutCallCount >= 1).toBe(true);
    expect(mocks.clearTimeoutCallCount >= 1).toBe(true);

    await clock.tickAsync(120);
    const frameAfterUnmount = Number.parseInt(stdout.write.mock.lastCall![0], 10);
    expect(frameAfterUnmount > frameBeforeUnmount).toBe(true);

    unmount();
    expect(mocks.clearTimeoutCallCount >= 2).toBe(true);
  } finally {
    mocks.restore();
    clock.uninstall();
  }
});

test("shared timer stays alive while another different-interval animation remains mounted", async () => {
  const clock = FakeTimers.install();
  const mocks = mockTimerCalls();

  try {
    function AnimationValue({ interval }: { readonly interval: number }) {
      const { frame } = useAnimation({ interval });
      return <Text>{String(frame)}</Text>;
    }

    function MaybeDualAnimation({ showSecond }: { readonly showSecond: boolean }) {
      return (
        <>
          <AnimationValue interval={50} />
          {showSecond ? <Text>,</Text> : undefined}
          {showSecond ? <AnimationValue interval={80} /> : undefined}
        </>
      );
    }

    const stdout = createStdout();
    const { rerender, unmount } = render(<MaybeDualAnimation showSecond />, {
      stdout,
      debug: true,
    });

    expect(mocks.setTimeoutCallCount >= 1).toBe(true);

    await clock.tickAsync(120);
    const frameBeforeUnmount = Number.parseInt(stdout.write.mock.lastCall![0].split(",")[0], 10);
    expect(frameBeforeUnmount >= 1).toBe(true);

    rerender(<MaybeDualAnimation showSecond={false} />);

    expect(mocks.setTimeoutCallCount >= 1).toBe(true);
    expect(mocks.clearTimeoutCallCount >= 1).toBe(true);

    await clock.tickAsync(120);
    const frameAfterUnmount = Number.parseInt(stdout.write.mock.lastCall![0], 10);
    expect(frameAfterUnmount > frameBeforeUnmount).toBe(true);

    unmount();
    expect(mocks.clearTimeoutCallCount >= 2).toBe(true);
  } finally {
    mocks.restore();
    clock.uninstall();
  }
});

test("inactive animations do not start the shared timer until one becomes active", async () => {
  const clock = FakeTimers.install();
  const mocks = mockTimerCalls();

  try {
    function MaybeActiveAnimations({
      isFirstActive,
      isSecondActive,
    }: {
      readonly isFirstActive: boolean;
      readonly isSecondActive: boolean;
    }) {
      const { frame: firstFrame } = useAnimation({
        interval: 50,
        isActive: isFirstActive,
      });
      const { frame: secondFrame } = useAnimation({
        interval: 50,
        isActive: isSecondActive,
      });

      return (
        <Text>
          {String(firstFrame)},{String(secondFrame)}
        </Text>
      );
    }

    const stdout = createStdout();
    const { rerender, unmount } = render(
      <MaybeActiveAnimations isFirstActive={false} isSecondActive={false} />,
      {
        stdout,
        debug: true,
      },
    );

    expect(mocks.setTimeoutCallCount).toBe(0);

    await clock.tickAsync(100);
    expect(stdout.write.mock.lastCall![0]).toBe("0,0");

    rerender(<MaybeActiveAnimations isFirstActive isSecondActive={false} />);

    expect(mocks.setTimeoutCallCount).toBe(1);

    await clock.tickAsync(120);
    const [firstFrame, secondFrame] = stdout.write.mock.lastCall![0].split(",").map(Number);
    expect(firstFrame >= 1).toBe(true);
    expect(secondFrame).toBe(0);

    unmount();
    expect(mocks.clearTimeoutCallCount >= 1).toBe(true);
  } finally {
    mocks.restore();
    clock.uninstall();
  }
});

test("cleans up on unmount", async () => {
  const stdout = createStdout();
  const { unmount } = render(<AnimatedCounter interval={50} />, {
    stdout,
    debug: true,
  });

  await delay(80);
  unmount();

  const outputAfterUnmount = stdout.write.mock.lastCall![0];
  await delay(120);
  // No new writes should happen after unmount
  expect(stdout.write.mock.lastCall![0]).toBe(outputAfterUnmount);
});

test("no timer leak when all animations are inactive", async () => {
  const clock = FakeTimers.install();
  const mocks = mockTimerCalls();

  try {
    const stdout = createStdout();

    // Mount with isActive=false — no timer should start
    const { rerender, unmount } = render(<ConditionalAnimation isActive={false} interval={50} />, {
      stdout,
      debug: true,
    });

    expect(mocks.setTimeoutCallCount).toBe(0);

    // Activate — timer should start
    rerender(<ConditionalAnimation isActive interval={50} />);
    expect(mocks.setTimeoutCallCount).toBe(1);

    await clock.tickAsync(120);
    expect(Number.parseInt(stdout.write.mock.lastCall![0], 10) >= 1).toBe(true);

    // Deactivate — subscriber unsubscribes, timer should be cleaned up
    rerender(<ConditionalAnimation isActive={false} interval={50} />);
    expect(mocks.clearTimeoutCallCount >= 1).toBe(true);

    // Unmount — timer should already be gone
    unmount();
    expect(mocks.clearTimeoutCallCount >= 1).toBe(true);
  } finally {
    mocks.restore();
    clock.uninstall();
  }
});

test("frame catches up when the shared timer is delayed", async () => {
  const clock = FakeTimers.install();

  try {
    const stdout = createStdout();
    const { unmount } = render(<AnimatedCounter interval={50} />, {
      stdout,
      debug: true,
    });

    await clock.tickAsync(220);
    expect(stdout.write.mock.lastCall![0]).toBe("4");

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("resets frame when isActive toggles from false to true", async () => {
  const stdout = createStdout();
  const { rerender, unmount } = render(<ConditionalAnimation isActive interval={50} />, {
    stdout,
    debug: true,
  });

  await delay(130);
  const frameBeforePause = Number.parseInt(stdout.write.mock.lastCall![0], 10);
  expect(frameBeforePause >= 1).toBe(true);

  // Pause
  rerender(<ConditionalAnimation isActive={false} interval={50} />);
  await delay(50);

  // Resume - frame should reset to 0
  rerender(<ConditionalAnimation isActive interval={50} />);
  expect(stdout.write.mock.lastCall![0]).toBe("0");

  // Should start incrementing again
  await delay(120);
  const frameAfterResume = Number.parseInt(stdout.write.mock.lastCall![0], 10);
  expect(frameAfterResume >= 1).toBe(true);
  unmount();
});

test("resets frame when interval changes", async () => {
  function DynamicInterval({ interval }: { readonly interval: number }) {
    const { frame } = useAnimation({ interval });
    return <Text>{String(frame)}</Text>;
  }

  const stdout = createStdout();
  const { rerender, unmount } = render(<DynamicInterval interval={50} />, {
    stdout,
    debug: true,
  });

  await delay(130);
  const frameBefore = Number.parseInt(stdout.write.mock.lastCall![0], 10);
  expect(frameBefore >= 1).toBe(true);

  // Change interval - frame should reset to 0
  rerender(<DynamicInterval interval={200} />);
  expect(stdout.write.mock.lastCall![0]).toBe("0");
  unmount();
});

test("time and delta reset to 0 when interval changes", async () => {
  const clock = FakeTimers.install();

  try {
    function DynamicInterval({ interval }: { readonly interval: number }) {
      const { frame, time, delta } = useAnimation({ interval });
      return (
        <Text>
          {String(frame)},{String(Math.round(time))},{String(Math.round(delta))}
        </Text>
      );
    }

    const stdout = createStdout();
    const { rerender, unmount } = render(<DynamicInterval interval={50} />, {
      stdout,
      debug: true,
      maxFps: 120,
    });

    await clock.tickAsync(200);
    const [frameBefore, timeBefore] = stdout.write.mock.lastCall![0].split(",").map(Number);
    expect(frameBefore >= 1).toBe(true);
    expect(timeBefore >= 50).toBe(true);

    // Changing interval should reset frame, time, and delta to 0
    rerender(<DynamicInterval interval={200} />);
    expect(stdout.write.mock.lastCall![0]).toBe("0,0,0");

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("time and delta reset to 0 when animation is resumed", async () => {
  const clock = FakeTimers.install();

  try {
    function ConditionalDisplay({ isActive }: { readonly isActive: boolean }) {
      const { frame, time, delta } = useAnimation({ interval: 50, isActive });
      return (
        <Text>
          {String(frame)},{String(Math.round(time))},{String(Math.round(delta))}
        </Text>
      );
    }

    const stdout = createStdout();
    const { rerender, unmount } = render(<ConditionalDisplay isActive />, {
      stdout,
      debug: true,
      maxFps: 120,
    });

    await clock.tickAsync(200);
    const [frameBefore, timeBefore] = stdout.write.mock.lastCall![0].split(",").map(Number);
    expect(frameBefore >= 1).toBe(true);
    expect(timeBefore >= 50).toBe(true);

    // Pause then resume — frame, time, and delta should all reset to 0
    rerender(<ConditionalDisplay isActive={false} />);
    rerender(<ConditionalDisplay isActive />);
    expect(stdout.write.mock.lastCall![0]).toBe("0,0,0");

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("different intervals advance at different rates", async () => {
  function DualAnimation() {
    const { frame: fast } = useAnimation({ interval: 50 });
    const { frame: slow } = useAnimation({ interval: 200 });
    return (
      <Text>
        {String(fast)},{String(slow)}
      </Text>
    );
  }

  const stdout = createStdout();
  const { unmount } = render(<DualAnimation />, {
    stdout,
    debug: true,
  });

  await delay(300);
  const output = stdout.write.mock.lastCall![0];
  const [fast, slow] = output.split(",").map(Number);
  expect(fast > slow).toBe(true);
  unmount();
});

test("defaults to 100ms interval", async () => {
  const clock = FakeTimers.install();

  try {
    function DefaultInterval() {
      const { frame } = useAnimation();
      return <Text>{String(frame)}</Text>;
    }

    const stdout = createStdout();
    const { unmount } = render(<DefaultInterval />, {
      stdout,
      debug: true,
      maxFps: 120,
    });

    expect(stdout.write.mock.lastCall![0]).toBe("0");

    await clock.tickAsync(250);

    expect(Number.parseInt(stdout.write.mock.lastCall![0], 10) >= 1).toBe(true);

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("treats NaN interval as the default interval", async () => {
  const clock = FakeTimers.install();

  try {
    const stdout = createStdout();
    const { unmount } = render(<AnimatedCounter interval={Number.NaN} />, {
      stdout,
      debug: true,
      maxFps: 120,
    });

    expect(stdout.write.mock.lastCall![0]).toBe("0");

    await clock.tickAsync(250);

    expect(Number.parseInt(stdout.write.mock.lastCall![0], 10) >= 1).toBe(true);

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("treats Infinity interval as the default interval", async () => {
  const clock = FakeTimers.install();

  try {
    const stdout = createStdout();
    const { unmount } = render(<AnimatedCounter interval={Number.POSITIVE_INFINITY} />, {
      stdout,
      debug: true,
      maxFps: 120,
    });

    expect(stdout.write.mock.lastCall![0]).toBe("0");

    await clock.tickAsync(250);

    expect(Number.parseInt(stdout.write.mock.lastCall![0], 10) >= 1).toBe(true);

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("treats negative Infinity interval as the default interval", async () => {
  const clock = FakeTimers.install();

  try {
    const stdout = createStdout();
    const { unmount } = render(<AnimatedCounter interval={Number.NEGATIVE_INFINITY} />, {
      stdout,
      debug: true,
      maxFps: 120,
    });

    expect(stdout.write.mock.lastCall![0]).toBe("0");

    await clock.tickAsync(250);

    expect(Number.parseInt(stdout.write.mock.lastCall![0], 10) >= 1).toBe(true);

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("clamps oversized finite interval to the timer maximum", async () => {
  const clock = FakeTimers.install();

  try {
    const stdout = createStdout();
    const { unmount } = render(<AnimatedCounter interval={Number.MAX_SAFE_INTEGER} />, {
      stdout,
      debug: true,
      maxFps: 120,
    });

    expect(stdout.write.mock.lastCall![0]).toBe("0");

    await clock.tickAsync(1000);

    expect(stdout.write.mock.lastCall![0]).toBe("0");

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("clamps zero interval to 1ms", async () => {
  const clock = FakeTimers.install();

  try {
    const stdout = createStdout();
    const { unmount } = render(<AnimatedCounter interval={0} />, {
      stdout,
      debug: true,
      maxFps: 1000,
    });

    expect(stdout.write.mock.lastCall![0]).toBe("0");

    await clock.tickAsync(5);

    expect(stdout.write.mock.lastCall![0]).toBe("5");

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("clamps negative interval to 1ms", async () => {
  const clock = FakeTimers.install();

  try {
    const stdout = createStdout();
    const { unmount } = render(<AnimatedCounter interval={-10} />, {
      stdout,
      debug: true,
      maxFps: 1000,
    });

    expect(stdout.write.mock.lastCall![0]).toBe("0");

    await clock.tickAsync(5);

    expect(stdout.write.mock.lastCall![0]).toBe("5");

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("maxFps does not speed up animation state", async () => {
  const clock = FakeTimers.install();

  try {
    const stdout = createStdout();
    const { unmount } = render(<AnimatedCounter interval={8} />, {
      stdout,
      debug: true,
      maxFps: 120,
    });

    expect(stdout.write.mock.lastCall![0]).toBe("0");

    await clock.tickAsync(25);

    expect(stdout.write.mock.lastCall![0]).toBe("3");

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("low maxFps caps animation rerenders", async () => {
  const clock = FakeTimers.install();

  try {
    let renderCount = 0;

    function RenderCountingAnimation() {
      renderCount++;
      const { frame } = useAnimation({ interval: 10 });
      return <Text>{String(frame)}</Text>;
    }

    const stdout = createStdout();
    const { unmount } = render(<RenderCountingAnimation />, {
      stdout,
      maxFps: 1,
    });

    expect(renderCount).toBe(1);

    await clock.tickAsync(35);

    expect(renderCount).toBe(1);

    await clock.tickAsync(1000);

    expect(renderCount >= 2).toBe(true);

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("maxFps 0 does not affect animation cadence", async () => {
  const clock = FakeTimers.install();

  try {
    const stdout = createStdout();
    const { unmount } = render(<AnimatedCounter interval={8} />, {
      stdout,
      debug: true,
      maxFps: 0,
    });

    expect(stdout.write.mock.lastCall![0]).toBe("0");

    await clock.tickAsync(25);

    expect(stdout.write.mock.lastCall![0]).toBe("3");

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("delta accounts for throttled ticks", async () => {
  let lastRenderedDelta = 0;

  function DeltaCapture() {
    const { delta } = useAnimation({ interval: 20 });
    // Captured in the render phase so we can verify the coalesced delta
    // value regardless of when Ink throttles its stdout write.
    lastRenderedDelta = delta;
    return <Text>x</Text>;
  }

  // Deliberately no debug: true — that forces renderThrottleMs = 0 and
  // would prevent the throttle code path from activating.
  // maxFps: 5 → renderThrottleMs = 200ms. Ten 20ms animation ticks fire
  // in the first window, but setAnimState is only called once (at the edge
  // of the 200ms window), so delta reflects ~200ms, not a single 20ms tick.
  const stdout = createStdout();
  const { unmount } = render(<DeltaCapture />, { stdout, maxFps: 5 });

  expect(lastRenderedDelta).toBe(0);

  // Wait well past one full 200ms throttle window.
  await delay(350);

  expect(
    lastRenderedDelta >= 150,
    `expected delta >= 150ms (one throttle window), got ${lastRenderedDelta}`,
  ).toBe(true);

  unmount();
});

test("pausing animation stops ticks before the next frame", async () => {
  const clock = FakeTimers.install();

  try {
    const stdout = createStdout();
    const { rerender, unmount } = render(<ConditionalAnimation isActive interval={8} />, {
      stdout,
      debug: true,
      maxFps: 120,
    });

    await clock.tickAsync(25);

    const pausedFrame = Number.parseInt(stdout.write.mock.lastCall![0], 10);
    expect(pausedFrame >= 1).toBe(true);

    rerender(<ConditionalAnimation isActive={false} interval={8} />);

    expect(stdout.write.mock.lastCall![0]).toBe(String(pausedFrame));

    await clock.tickAsync(25);

    expect(stdout.write.mock.lastCall![0]).toBe(String(pausedFrame));

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("changing interval unsubscribes stale ticks before reset", async () => {
  const clock = FakeTimers.install();

  try {
    function DynamicInterval({ interval }: { readonly interval: number }) {
      const { frame } = useAnimation({ interval });
      return <Text>{String(frame)}</Text>;
    }

    const stdout = createStdout();
    const { rerender, unmount } = render(<DynamicInterval interval={8} />, {
      stdout,
      debug: true,
      maxFps: 120,
    });

    await clock.tickAsync(25);
    expect(Number.parseInt(stdout.write.mock.lastCall![0], 10) >= 1).toBe(true);

    rerender(<DynamicInterval interval={200} />);

    expect(stdout.write.mock.lastCall![0]).toBe("0");

    await clock.tickAsync(17);

    expect(stdout.write.mock.lastCall![0]).toBe("0");

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("wall clock changes do not move animations backwards", async () => {
  const clock = FakeTimers.install();
  const originalDateNow = Date.now;
  let wallClockTime = 1000;
  Date.now = () => wallClockTime;

  try {
    const stdout = createStdout();
    const { unmount } = render(<AnimatedCounter interval={8} />, {
      stdout,
      debug: true,
      maxFps: 120,
    });

    wallClockTime = 1024;
    await clock.tickAsync(25);

    const frameBeforeClockJump = Number.parseInt(stdout.write.mock.lastCall![0], 10);
    expect(frameBeforeClockJump >= 1).toBe(true);

    wallClockTime = 900;
    await clock.tickAsync(25);

    expect(Number.parseInt(stdout.write.mock.lastCall![0], 10) >= frameBeforeClockJump).toBe(true);

    unmount();
  } finally {
    Date.now = originalDateNow;
    clock.uninstall();
  }
});

test("animations advance in debug mode when interactive is false", async () => {
  const clock = FakeTimers.install();

  try {
    const stdout = createStdout();
    const { unmount } = render(<AnimatedCounter interval={8} />, {
      stdout,
      debug: true,
      interactive: false,
      maxFps: 120,
    });

    expect(stdout.write.mock.lastCall![0]).toBe("0");

    await clock.tickAsync(25);

    expect(Number.parseInt(stdout.write.mock.lastCall![0], 10) >= 1).toBe(true);

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("newly mounted animations do not inherit elapsed time", async () => {
  function AnimatedValue({ interval }: { readonly interval: number }) {
    const { frame } = useAnimation({ interval });
    return <Text>{String(frame)}</Text>;
  }

  function DelayedDualAnimation() {
    const [showSecond, setShowSecond] = React.useState(false);

    React.useEffect(() => {
      const timer = setTimeout(() => {
        setShowSecond(true);
      }, 20);

      return () => {
        clearTimeout(timer);
      };
    }, []);

    return (
      <>
        <AnimatedValue interval={20} />
        <Text>,</Text>
        {showSecond ? <AnimatedValue interval={20} /> : <Text>-</Text>}
      </>
    );
  }

  const clock = FakeTimers.install();

  try {
    const stdout = createStdout();
    const { unmount } = render(<DelayedDualAnimation />, {
      stdout,
      debug: true,
    });

    const getOutput = () => stdout.write.mock.lastCall![0].replaceAll("\n", "");

    await clock.tickAsync(25);

    expect(getOutput()).toBe("1,0");

    await clock.tickAsync(40);

    const [firstFrame, secondFrame] = getOutput().split(",").map(Number);
    expect(firstFrame >= 2).toBe(true);
    expect(secondFrame >= 1).toBe(true);
    expect(firstFrame - secondFrame).toBe(1);

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("newly activated animations do not inherit elapsed time", async () => {
  function AnimatedValue({
    interval,
    isActive = true,
  }: {
    readonly interval: number;
    readonly isActive?: boolean;
  }) {
    const { frame } = useAnimation({ interval, isActive });
    return <Text>{String(frame)}</Text>;
  }

  function DelayedActivationAnimation() {
    const [isSecondActive, setIsSecondActive] = React.useState(false);

    React.useEffect(() => {
      const timer = setTimeout(() => {
        setIsSecondActive(true);
      }, 20);

      return () => {
        clearTimeout(timer);
      };
    }, []);

    return (
      <>
        <AnimatedValue interval={20} />
        <Text>,</Text>
        <AnimatedValue interval={20} isActive={isSecondActive} />
      </>
    );
  }

  const clock = FakeTimers.install();

  try {
    const stdout = createStdout();
    const { unmount } = render(<DelayedActivationAnimation />, {
      stdout,
      debug: true,
    });

    const getOutput = () => stdout.write.mock.lastCall![0].replaceAll("\n", "");

    await clock.tickAsync(25);

    expect(getOutput()).toBe("1,0");

    await clock.tickAsync(40);

    const [firstFrame, secondFrame] = getOutput().split(",").map(Number);
    expect(firstFrame >= 2).toBe(true);
    expect(secondFrame >= 1).toBe(true);
    expect(firstFrame - secondFrame).toBe(1);

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("rerendering with the same interval does not reset the frame", async () => {
  function DynamicInterval({ interval }: { readonly interval: number }) {
    const { frame } = useAnimation({ interval });
    return <Text>{String(frame)}</Text>;
  }

  const clock = FakeTimers.install();

  try {
    const stdout = createStdout();
    const { rerender, unmount } = render(<DynamicInterval interval={20} />, {
      stdout,
      debug: true,
      maxFps: 120,
    });

    await clock.tickAsync(50);

    const frameBeforeRerender = Number.parseInt(stdout.write.mock.lastCall![0], 10);
    expect(frameBeforeRerender >= 1).toBe(true);

    rerender(<DynamicInterval interval={20} />);

    expect(stdout.write.mock.lastCall![0]).toBe(String(frameBeforeRerender));

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("time increases with each tick", async () => {
  function TimeDisplay() {
    const { time } = useAnimation({ interval: 50 });
    return <Text>{String(Math.round(time))}</Text>;
  }

  const stdout = createStdout();
  const { unmount } = render(<TimeDisplay />, { stdout, debug: true });

  expect(stdout.write.mock.lastCall![0]).toBe("0");

  await delay(80);
  const timeAfterOne = Number.parseInt(stdout.write.mock.lastCall![0], 10);
  expect(timeAfterOne >= 50).toBe(true);

  await delay(80);
  const timeAfterTwo = Number.parseInt(stdout.write.mock.lastCall![0], 10);
  expect(timeAfterTwo > timeAfterOne).toBe(true);

  unmount();
});

test("delta approximates interval on each tick", async () => {
  function DeltaDisplay() {
    const { delta } = useAnimation({ interval: 50 });
    return <Text>{String(Math.round(delta))}</Text>;
  }

  const stdout = createStdout();
  const { unmount } = render(<DeltaDisplay />, { stdout, debug: true });

  expect(stdout.write.mock.lastCall![0]).toBe("0");

  await delay(80);
  const deltaAfterFirst = Number.parseInt(stdout.write.mock.lastCall![0], 10);
  // First delta should approximate the interval (with tolerance for timer jitter)
  expect(deltaAfterFirst >= 40).toBe(true);

  await delay(80);
  const deltaAfterSecond = Number.parseInt(stdout.write.mock.lastCall![0], 10);
  // Subsequent deltas should also approximate the interval (catch-up scheduling
  // can make them slightly shorter than the interval when earlier ticks fired late)
  expect(deltaAfterSecond >= 40).toBe(true);

  unmount();
});

test("reset() resets frame, time, and delta to 0", async () => {
  const clock = FakeTimers.install();

  try {
    let resetAnimation!: () => void;

    function ResettableAnimation() {
      const { frame, time, delta, reset } = useAnimation({ interval: 50 });
      resetAnimation = reset;
      return (
        <Text>
          {String(frame)},{String(Math.round(time))},{String(Math.round(delta))}
        </Text>
      );
    }

    const stdout = createStdout();
    const { unmount } = render(<ResettableAnimation />, {
      stdout,
      debug: true,
      maxFps: 120,
    });

    await clock.tickAsync(200);
    const [frameBefore, timeBefore] = stdout.write.mock.lastCall![0].split(",").map(Number);
    expect(frameBefore >= 1).toBe(true);
    expect(timeBefore >= 100).toBe(true);

    resetAnimation();

    // Let React flush the state update from reset()
    await clock.tickAsync(1);
    expect(stdout.write.mock.lastCall![0]).toBe("0,0,0");

    // Confirm it advances again after reset
    await clock.tickAsync(100);
    const [frameAfter, timeAfter, deltaAfter] = stdout.write.mock
      .lastCall![0].split(",")
      .map(Number);
    expect(frameAfter >= 1).toBe(true);
    expect(timeAfter >= 50).toBe(true);
    expect(deltaAfter >= 50).toBe(true);
    // Time should be much less than before reset
    expect(timeAfter < timeBefore).toBe(true);

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("reset is a stable function reference", () => {
  const resets: Array<() => void> = [];

  function ResettableAnimation() {
    const { reset } = useAnimation({ interval: 50 });
    resets.push(reset);
    return <Text>x</Text>;
  }

  const stdout = createStdout();
  const { rerender, unmount } = render(<ResettableAnimation />, {
    stdout,
    debug: true,
  });

  rerender(<ResettableAnimation />);
  rerender(<ResettableAnimation />);

  expect(resets.length >= 2).toBe(true);
  expect(resets[0]).toBe(resets.at(-1));

  unmount();
});

test("reset() while paused takes effect when animation is resumed", async () => {
  const clock = FakeTimers.install();

  try {
    let resetAnimation!: () => void;

    function PausableAnimation({ isActive }: { readonly isActive: boolean }) {
      const { frame, reset } = useAnimation({ interval: 50, isActive });
      resetAnimation = reset;
      return <Text>{String(frame)}</Text>;
    }

    const stdout = createStdout();
    const { rerender, unmount } = render(<PausableAnimation isActive />, {
      stdout,
      debug: true,
      maxFps: 120,
    });

    // Let a few frames accumulate
    await clock.tickAsync(200);
    const pausedFrame = Number.parseInt(stdout.write.mock.lastCall![0], 10);
    expect(pausedFrame >= 1).toBe(true);

    // Pause the animation
    rerender(<PausableAnimation isActive={false} />);

    // Call reset while paused — it only bumps the reset key; with isActive
    // false the reset path never runs, so the displayed frame stays frozen.
    resetAnimation();
    await clock.tickAsync(1);
    expect(stdout.write.mock.lastCall![0]).toBe(String(pausedFrame));

    // Resume — the pending reset takes effect and frame restarts from 0
    rerender(<PausableAnimation isActive />);
    expect(stdout.write.mock.lastCall![0]).toBe("0");

    // And then advance again to confirm animation restarts cleanly
    await clock.tickAsync(100);
    expect(Number.parseInt(stdout.write.mock.lastCall![0], 10) >= 1).toBe(true);

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("concurrent aborted renders do not suppress interval reset", async () => {
  let resolveSuspense!: () => void;
  const suspendedRender = new Promise<void>((resolve) => {
    resolveSuspense = resolve;
  });

  function MaybeSuspendingAnimation({
    interval,
    shouldSuspend,
  }: {
    readonly interval: number;
    readonly shouldSuspend: boolean;
  }) {
    const { frame } = useAnimation({ interval });

    if (shouldSuspend) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw suspendedRender;
    }

    return <Text>{String(frame)}</Text>;
  }

  const stdout = createStdout();
  let instance: ReturnType<typeof render> | undefined;

  try {
    await act(async () => {
      instance = render(
        <Suspense fallback={<Text>loading</Text>}>
          <MaybeSuspendingAnimation interval={50} shouldSuspend={false} />
        </Suspense>,
        { stdout, debug: true, concurrent: true },
      );
    });

    await delay(130);

    const frameBefore = Number.parseInt(stdout.get(), 10);
    expect(frameBefore >= 1).toBe(true);

    await act(async () => {
      instance!.rerender(
        <Suspense fallback={<Text>loading</Text>}>
          <MaybeSuspendingAnimation shouldSuspend interval={200} />
        </Suspense>,
      );
    });

    expect(stdout.get()).toBe("loading");

    await act(async () => {
      instance!.rerender(
        <Suspense fallback={<Text>loading</Text>}>
          <MaybeSuspendingAnimation interval={200} shouldSuspend={false} />
        </Suspense>,
      );
    });

    expect(stdout.get()).toBe("0");

    await delay(260);
    expect(Number.parseInt(stdout.get(), 10) >= 1).toBe(true);
  } finally {
    resolveSuspense();
    instance?.unmount();
  }
});

test("unmount before first tick cleans up without error", async () => {
  const clock = FakeTimers.install();
  const mocks = mockTimerCalls();

  try {
    const stdout = createStdout();
    const { unmount } = render(<AnimatedCounter interval={50} />, {
      stdout,
      debug: true,
    });

    expect(stdout.write.mock.lastCall![0]).toBe("0");
    expect(mocks.setTimeoutCallCount >= 1).toBe(true);

    // Unmount before any tick fires — exercises the cleanup path where
    // unsubscribe is called while the timer is still pending.
    unmount();
    expect(mocks.clearTimeoutCallCount >= 1).toBe(true);

    // Confirm no animation ticks fire after unmount (Ink may write cursor
    // codes on unmount, so compare call counts rather than output value).
    const writeCountAfterUnmount = stdout.write.mock.calls.length;
    await clock.tickAsync(200);
    expect(stdout.write.mock.calls.length).toBe(writeCountAfterUnmount);
  } finally {
    mocks.restore();
    clock.uninstall();
  }
});

test("frame resets to 0 on each resume across multiple cycles", async () => {
  const clock = FakeTimers.install();

  try {
    const stdout = createStdout();
    const { rerender, unmount } = render(<ConditionalAnimation isActive interval={50} />, {
      stdout,
      debug: true,
      maxFps: 120,
    });

    // Cycle 1
    await clock.tickAsync(120);
    expect(Number.parseInt(stdout.write.mock.lastCall![0], 10) >= 1).toBe(true);
    rerender(<ConditionalAnimation isActive={false} interval={50} />);
    rerender(<ConditionalAnimation isActive interval={50} />);
    expect(stdout.write.mock.lastCall![0]).toBe("0");

    // Cycle 2
    await clock.tickAsync(120);
    expect(Number.parseInt(stdout.write.mock.lastCall![0], 10) >= 1).toBe(true);
    rerender(<ConditionalAnimation isActive={false} interval={50} />);
    rerender(<ConditionalAnimation isActive interval={50} />);
    expect(stdout.write.mock.lastCall![0]).toBe("0");

    // Cycle 3
    await clock.tickAsync(120);
    expect(Number.parseInt(stdout.write.mock.lastCall![0], 10) >= 1).toBe(true);
    rerender(<ConditionalAnimation isActive={false} interval={50} />);
    rerender(<ConditionalAnimation isActive interval={50} />);
    expect(stdout.write.mock.lastCall![0]).toBe("0");

    unmount();
  } finally {
    clock.uninstall();
  }
});

test("isActive false from mount never starts a timer or advances the frame", async () => {
  const clock = FakeTimers.install();
  const mocks = mockTimerCalls();

  try {
    const stdout = createStdout();
    const { unmount } = render(<ConditionalAnimation isActive={false} interval={50} />, {
      stdout,
      debug: true,
    });

    expect(mocks.setTimeoutCallCount).toBe(0);
    expect(stdout.write.mock.lastCall![0]).toBe("0");

    await clock.tickAsync(500);

    expect(mocks.setTimeoutCallCount).toBe(0);
    expect(stdout.write.mock.lastCall![0]).toBe("0");

    unmount();
    expect(mocks.clearTimeoutCallCount).toBe(0);
  } finally {
    mocks.restore();
    clock.uninstall();
  }
});

test("suspended transitions do not reset the committed animation before commit", async () => {
  let resolveSuspense!: () => void;
  const suspendedRender = new Promise<void>((resolve) => {
    resolveSuspense = resolve;
  });
  let suspendWithNewInterval!: () => void;

  function MaybeSuspendingAnimation({
    interval,
    shouldSuspend,
  }: {
    readonly interval: number;
    readonly shouldSuspend: boolean;
  }) {
    const { frame } = useAnimation({ interval });

    if (shouldSuspend) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw suspendedRender;
    }

    return <Text>{String(frame)}</Text>;
  }

  function TestCase() {
    const [interval, setInterval] = React.useState(50);
    const [shouldSuspend, setShouldSuspend] = React.useState(false);

    suspendWithNewInterval = () => {
      startTransition(() => {
        setInterval(200);
        setShouldSuspend(true);
      });
    };

    return (
      <Suspense fallback={<Text>loading</Text>}>
        <MaybeSuspendingAnimation interval={interval} shouldSuspend={shouldSuspend} />
      </Suspense>
    );
  }

  const stdout = createStdout();
  let instance: ReturnType<typeof render> | undefined;

  try {
    instance = render(<TestCase />, {
      stdout,
      debug: true,
      concurrent: true,
    });

    await delay(130);
    const frameBeforeSuspend = Number.parseInt(stdout.get(), 10);
    expect(frameBeforeSuspend >= 1).toBe(true);

    await act(async () => {
      suspendWithNewInterval();
    });

    expect(stdout.get()).toBe(String(frameBeforeSuspend));

    await delay(120);
    expect(Number.parseInt(stdout.get(), 10) > frameBeforeSuspend).toBe(true);
  } finally {
    resolveSuspense();
    instance?.unmount();
  }
});
