import { isTty } from "#/env.ts";

export type OutputStream = NodeJS.WritableStream & {
  isTTY?: boolean;
  columns?: number;
  rows?: number;
  destroyed?: boolean;
  writableEnded?: boolean;
};

type RawModeStream = NodeJS.ReadableStream & {
  isTTY: true;
  setRawMode: (mode: boolean) => void;
  ref?: () => void;
  unref?: () => void;
};

const isRawModeStream = (stdin: NodeJS.ReadableStream): stdin is RawModeStream => {
  return isTty(stdin) && "setRawMode" in stdin && typeof stdin.setRawMode === "function";
};

export const getRawModeStream = (stdin: NodeJS.ReadableStream): RawModeStream | undefined => {
  if (!isRawModeStream(stdin)) {
    return;
  }

  return stdin;
};
