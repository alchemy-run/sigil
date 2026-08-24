import { createContext } from "react";

import type { ClipboardSelection, TerminalProgressState } from "#/ansi/osc.ts";

export type TerminalOsc = {
  readonly publishProgress: (owner: symbol, state: TerminalProgressState, value?: number) => void;
  readonly copyToClipboard: (text: string, selection?: ClipboardSelection) => void;
  readonly publishTitle: (owner: symbol, title?: string) => void;
  readonly setWorkingDirectory: (directory: URL | string) => void;
  readonly notify: (title: string) => void;
  readonly setPointerShape: (shape: string) => void;
};

const noop = () => {};

export const TerminalOscContext = createContext<TerminalOsc>({
  publishProgress: noop,
  copyToClipboard: noop,
  publishTitle: noop,
  setWorkingDirectory: noop,
  notify: noop,
  setPointerShape: noop,
});

TerminalOscContext.displayName = "InternalTerminalOscContext";
