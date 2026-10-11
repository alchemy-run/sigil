import { useCallback, useContext, useEffect, useRef } from "react";

import type { ClipboardSelection, ProgramStatus, TerminalProgressState } from "#/ansi/osc.ts";
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

/**
Report this component's program status (OSC 7501) while it is mounted. Pass
`undefined` to withdraw it. On unmount the record is cleared unless it last
reported `done` or `error`, which stay for the user to find.
*/
export const useProgramStatus = (status: ProgramStatus | undefined): void => {
  const terminal = useContext(TerminalOscContext);
  const owner = useRef<symbol>(undefined);
  owner.current ??= Symbol("program-status");
  const { state, id, kind, progress, app, title, msg } = status ?? {};

  useEffect(() => {
    terminal.publishStatus(
      owner.current!,
      state === undefined ? undefined : { state, id, kind, progress, app, title, msg },
    );
  }, [terminal, state, id, kind, progress, app, title, msg]);

  useEffect(() => () => terminal.publishStatus(owner.current!, undefined), [terminal]);
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
