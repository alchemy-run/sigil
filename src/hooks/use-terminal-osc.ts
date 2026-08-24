import { useCallback, useContext, useEffect, useRef } from "react";

import type { ClipboardSelection, TerminalProgressState } from "#/ansi/osc.ts";
import { TerminalOscContext } from "#/components/TerminalOscContext.ts";

export type ProgressOptions = {
  readonly state: TerminalProgressState;
  readonly value?: number;
};

export const useProgress = ({ state, value }: ProgressOptions): void => {
  const terminal = useContext(TerminalOscContext);
  const owner = useRef<symbol>(undefined);
  owner.current ??= Symbol("terminal-progress");

  useEffect(() => {
    terminal.publishProgress(owner.current!, state, value);
  }, [state, terminal, value]);

  useEffect(() => {
    return () => {
      terminal.publishProgress(owner.current!, "inactive");
    };
  }, [terminal]);
};

export const useClipboard = (): ((text: string, selection?: ClipboardSelection) => void) => {
  const terminal = useContext(TerminalOscContext);
  return useCallback((text, selection) => terminal.copyToClipboard(text, selection), [terminal]);
};

export const useTitle = (title?: string): void => {
  const terminal = useContext(TerminalOscContext);
  const owner = useRef<symbol>(undefined);
  owner.current ??= Symbol("terminal-title");
  useEffect(() => {
    terminal.publishTitle(owner.current!, title);
  }, [terminal, title]);
  useEffect(() => () => terminal.publishTitle(owner.current!, undefined), [terminal]);
};

export const useWorkingDirectory = (directory: URL | string): void => {
  const terminal = useContext(TerminalOscContext);
  useEffect(() => {
    terminal.setWorkingDirectory(directory);
  }, [directory, terminal]);
};

export const useNotification = (): ((title: string) => void) => {
  const terminal = useContext(TerminalOscContext);
  return useCallback((title) => terminal.notify(title), [terminal]);
};

export const usePointerShape = (shape: string): void => {
  const terminal = useContext(TerminalOscContext);
  useEffect(() => {
    terminal.setPointerShape(shape);
  }, [shape, terminal]);
};
