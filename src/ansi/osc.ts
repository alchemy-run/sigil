import { pathToFileURL } from "node:url";

import { ESC, OSC, ST } from "#/ansi/escapes.ts";

export type ClipboardSelection = "clipboard" | "primary" | "selection";
export type TerminalProgressState = "inactive" | "normal" | "error" | "indeterminate" | "paused";

const clipboardCode: Record<ClipboardSelection, string> = {
  clipboard: "c",
  primary: "p",
  selection: "s",
};

const progressCode: Record<TerminalProgressState, number> = {
  inactive: 0,
  normal: 1,
  error: 2,
  indeterminate: 3,
  paused: 4,
};

const field = (value: string): string => value.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

const command = (code: number, payload: string): string => `${OSC}${code};${payload}${ST}`;

/** Change the terminal window title (OSC 2). */
export const setWindowTitle = (title: string): string => command(2, field(title));

/** Announce the current directory as a file URI (OSC 7). */
export const setWorkingDirectory = (directory: URL | string): string => {
  const uri =
    directory instanceof URL
      ? directory
      : directory.startsWith("file:")
        ? new URL(directory)
        : pathToFileURL(directory);
  if (uri.protocol !== "file:") throw new Error("Terminal working directory must be a file URI");
  return command(7, uri.href);
};

/** Show a desktop notification (OSC 9). */
export const notify = (title: string): string => {
  const safe = field(title);
  return command(9, /^\d+;/.test(safe) ? ` ${safe}` : safe);
};

/** Change the terminal pointer shape (OSC 22; terminal support varies). */
export const setPointerShape = (shape: string): string => command(22, field(shape));

/** Write UTF-8 text to a terminal clipboard using OSC 52. */
export const setClipboard = (text: string, selection: ClipboardSelection = "clipboard"): string =>
  command(52, `${clipboardCode[selection]};${Buffer.from(text).toString("base64")}`);

/** Request clipboard contents. The response is another OSC 52 sequence. */
export const queryClipboard = (selection: ClipboardSelection = "clipboard"): string =>
  command(52, `${clipboardCode[selection]};?`);

/** Clear a terminal clipboard. */
export const clearClipboard = (selection: ClipboardSelection = "clipboard"): string =>
  command(52, `${clipboardCode[selection]};`);

/** Report terminal-native progress using OSC 9;4. */
export const setTerminalProgress = (state: TerminalProgressState, value?: number): string => {
  const code = progressCode[state];
  if (state === "inactive" || state === "indeterminate") {
    return command(9, `4;${code}`);
  }
  if (value === undefined && (state === "error" || state === "paused")) {
    return command(9, `4;${code}`);
  }
  const percentage = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  return command(9, `4;${code};${percentage}`);
};

/** Wrap a sequence for transport through tmux's DCS passthrough. */
export const tmuxPassthrough = (sequence: string): string =>
  `${ESC}Ptmux;${sequence.replaceAll(ESC, `${ESC}${ESC}`)}${ST}`;
