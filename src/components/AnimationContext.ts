import { createContext } from "react";

type AnimationContextValue = {
  readonly renderThrottleMs: number;
  readonly subscribe: (
    callback: (currentTime: number) => void,
    interval: number,
  ) => {
    readonly startTime: number;
    readonly unsubscribe: () => void;
  };
};

export const animationContext = createContext<AnimationContextValue>({
  renderThrottleMs: 0,
  subscribe() {
    return {
      startTime: 0,
      unsubscribe() {},
    };
  },
});

animationContext.displayName = "InternalAnimationContext";
