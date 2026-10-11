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

export type ProgramStatusState = "idle" | "working" | "done" | "blocked" | "error";
export type ProgramStatusKind = "permission" | "question" | "auth";

/** One OSC 7501 record. Every report replaces the whole record for its `id`. */
export type ProgramStatus = {
  readonly state: ProgramStatusState;
  /** Slash-separated record path (`deploy/us-east`). Omit for the root record. */
  readonly id?: string;
  /** Why the program is waiting; only sent with `blocked`. */
  readonly kind?: ProgramStatusKind;
  /** Percentage (0-100); only sent with `working` or `blocked`. */
  readonly progress?: number;
  /** Stable machine-readable program name; children inherit it. */
  readonly app?: string;
  /** Short label, mostly useful when reporting several records. */
  readonly title?: string;
  /** One human-readable line describing the activity or reason. */
  readonly msg?: string;
};

const statusSegment = /^[A-Za-z0-9_.+-]{1,32}$/;
const statusTitleBytes = 192;
const statusMsgBytes = 2048;

const assertStatusId = (id: string): void => {
  const segments = id.split("/");
  if (id.length > 128 || segments.length > 8 || !segments.every((s) => statusSegment.test(s)))
    throw new Error(`Invalid program status id: ${JSON.stringify(id)}`);
};

// Terminals discard reports with control characters, so runs of them become
// one space; the result is cut at a code point to `limit` UTF-8 bytes.
const statusText = (value: string, limit: number): string => {
  let text = "";
  let size = 0;
  for (const char of value.replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ").trim()) {
    size += Buffer.byteLength(char);
    if (size > limit) break;
    text += char;
  }
  return Buffer.from(text.trimEnd()).toString("base64");
};

const statusCommand = (pairs: readonly (readonly [string, string | number | undefined])[]) =>
  command(
    7501,
    pairs
      .filter(([, value]) => value !== undefined && value !== "")
      .map(([key, value]) => `${key}=${value}`)
      .join(":"),
  );

/**
Report program status using OSC 7501. `kind` is only sent while `blocked`
and `progress` only while `working` or `blocked`; an invalid `app` is
omitted, and text is sanitized and truncated to the protocol limits. Throws
on a malformed `id`, which terminals would otherwise drop rather than apply
to the root record.
*/
export const setProgramStatus = (status: ProgramStatus): string => {
  if (status.id !== undefined) assertStatusId(status.id);
  const progress =
    status.progress === undefined ||
    !Number.isFinite(status.progress) ||
    (status.state !== "working" && status.state !== "blocked")
      ? undefined
      : Math.max(0, Math.min(100, Math.round(status.progress)));
  return statusCommand([
    ["state", status.state],
    ["id", status.id],
    ["kind", status.state === "blocked" ? status.kind : undefined],
    ["progress", progress],
    ["app", status.app !== undefined && statusSegment.test(status.app) ? status.app : undefined],
    ["title", status.title === undefined ? undefined : statusText(status.title, statusTitleBytes)],
    ["msg", status.msg === undefined ? undefined : statusText(status.msg, statusMsgBytes)],
  ]);
};

/** Remove an OSC 7501 record and its children; without an `id`, every record. */
export const clearProgramStatus = (id?: string): string => {
  if (id !== undefined) assertStatusId(id);
  return statusCommand([
    ["state", "clear"],
    ["id", id],
  ]);
};

/** Ask whether the terminal supports OSC 7501; supporting terminals echo it back. */
export const queryProgramStatus = (): string => command(7501, "?");

/** Wrap a sequence for transport through tmux's DCS passthrough. */
export const tmuxPassthrough = (sequence: string): string =>
  `${ESC}Ptmux;${sequence.replaceAll(ESC, `${ESC}${ESC}`)}${ST}`;
