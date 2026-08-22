import { act as reactAct } from "react";

declare global {
  // React looks this up on globalThis to decide whether act() is supported.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

/**
React's `act()` refuses to run unless the environment opts in via
`IS_REACT_ACT_ENVIRONMENT`. Enable it only for the duration of the call: most
of this suite renders outside `act()` on purpose (real timers, PTYs, stdin
events), and a permanent opt-in would make React warn about every one of
those updates instead.
*/
export const act = async (callback: () => Promise<void> | void): Promise<void> => {
  const previous = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await reactAct(callback);
  } finally {
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous;
  }
};
