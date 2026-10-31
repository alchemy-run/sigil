// Copying to the user's clipboard, as reliably as a terminal app can.
//
// OSC 52 is the only route that crosses SSH, but terminals and multiplexers
// drop it in common setups: tmux ignores it from apps by default
// (`set-clipboard external`) and drops passthrough since 3.3a
// (`allow-passthrough off`), GNU screen needs its own chunked wrapper, and
// some terminals don't implement it at all. So the copy also goes through
// tmux itself when inside tmux, and through the system clipboard tool when
// the session is local.

import { spawnSync } from "node:child_process";

import { BEL, ESC, ST } from "#/ansi/escapes.ts";
import { setClipboard, tmuxPassthrough, type ClipboardSelection } from "#/ansi/osc.ts";

/** How a copy reached the clipboard. */
export type ClipboardMethod = "osc52" | "tmux" | "native";

export type CopyToClipboardOptions = {
  /** @default "clipboard" */
  readonly selection?: ClipboardSelection;
  /**
	Stream the OSC 52 sequence is written to.

	@default process.stdout
	*/
  readonly stream?: { write(data: string): boolean };
  /**
	Environment used to detect SSH and multiplexers.

	@default process.env
	*/
  readonly env?: NodeJS.ProcessEnv;
};

/**
Longest OSC 52 sequence to send. Terminals cap OSC strings (hterm and others
at 100,000 characters) and silently drop longer ones.
*/
export const maxClipboardSequenceLength = 100_000;

// GNU screen limits DCS strings to 768 bytes (since 4.2.1); leave room for
// the 4 bytes of framing around each chunk.
const screenChunkLength = 768 - 4;

/**
Wraps a sequence for GNU screen, which forwards DCS strings to the outer
terminal. The sequence must end in BEL, since an ST would end the DCS early.
*/
export const screenPassthrough = (sequence: string): string => {
  let wrapped = "";
  for (let index = 0; index < sequence.length; index += screenChunkLength) {
    wrapped += `${ESC}P${sequence.slice(index, index + screenChunkLength)}${ST}`;
  }
  return wrapped;
};

const runWithInput = (
  command: string,
  args: readonly string[],
  input: string | Buffer,
): boolean => {
  try {
    // Ignore output: xclip and wl-copy fork a child that keeps serving the
    // selection, and an inherited pipe would hold spawnSync open.
    const result = spawnSync(command, args, {
      input,
      stdio: ["pipe", "ignore", "ignore"],
      timeout: 2000,
      windowsHide: true,
    });
    return result.status === 0;
  } catch {
    return false;
  }
};

const copyNative = (text: string, env: NodeJS.ProcessEnv): boolean => {
  if (process.platform === "darwin") return runWithInput("pbcopy", [], text);
  if (process.platform === "win32" || env["WSL_DISTRO_NAME"] !== undefined) {
    // clip.exe reads UTF-16LE when it starts with a byte order mark.
    return runWithInput("clip.exe", [], Buffer.from(`﻿${text}`, "utf16le"));
  }
  if (env["WAYLAND_DISPLAY"] !== undefined && runWithInput("wl-copy", [], text)) return true;
  if (env["DISPLAY"] !== undefined) {
    return (
      runWithInput("xclip", ["-selection", "clipboard"], text) ||
      runWithInput("xsel", ["--clipboard", "--input"], text)
    );
  }
  return false;
};

const isSsh = (env: NodeJS.ProcessEnv): boolean =>
  env["SSH_CONNECTION"] !== undefined ||
  env["SSH_CLIENT"] !== undefined ||
  env["SSH_TTY"] !== undefined;

/**
Copies text to the user's clipboard and returns the routes that accepted it
(empty when none did).

- OSC 52, wrapped for tmux or GNU screen when running inside one. Skipped
  when the sequence is too long for terminals to accept. A written OSC 52
  is not a confirmation: the terminal may still ignore it.
- `tmux load-buffer -w`, which works with tmux's default settings and
  reaches the outer terminal's clipboard even over SSH.
- The system clipboard tool (`pbcopy`, `wl-copy`, `xclip`/`xsel`,
  `clip.exe`) when the session is local, for terminals without OSC 52. Never
  over SSH, where it would fill the remote machine's clipboard.

Set `SIGIL_CLIPBOARD=osc52` to only ever use OSC 52.
*/
export function copyToClipboard(
  text: string,
  options: CopyToClipboardOptions = {},
): ClipboardMethod[] {
  const selection = options.selection ?? "clipboard";
  const stream = options.stream ?? process.stdout;
  const env = options.env ?? process.env;
  const methods: ClipboardMethod[] = [];

  const inTmux = env["TMUX"] !== undefined;
  const inScreen = !inTmux && env["STY"] !== undefined;

  const sequence = setClipboard(text, selection);
  if (sequence.length <= maxClipboardSequenceLength) {
    let output = sequence;
    // Plain for `set-clipboard on`, wrapped for `allow-passthrough on`.
    if (inTmux) output += tmuxPassthrough(sequence);
    if (inScreen) output = screenPassthrough(`${sequence.slice(0, -ST.length)}${BEL}`);
    try {
      // `false` only means backpressure; the write is still queued.
      stream.write(output);
      methods.push("osc52");
    } catch {}
  }

  // Only the clipboard selection has a tmux or system equivalent.
  // `SIGIL_CLIPBOARD=osc52` opts out of the side routes (and keeps tests off
  // the real clipboard).
  if (selection !== "clipboard" || env["SIGIL_CLIPBOARD"] === "osc52") return methods;

  if (inTmux && runWithInput("tmux", ["load-buffer", "-w", "-"], text)) methods.push("tmux");
  if (!isSsh(env) && copyNative(text, env)) methods.push("native");

  return methods;
}
