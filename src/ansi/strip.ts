// ANSI escape sequence matching and removal.
// Ported from `ansi-regex` and `strip-ansi` (MIT, Sindre Sorhus).
import { BEL, C1_CSI, C1_ST, ESC } from "./escapes.ts";

export function ansiRegex({ onlyFirst = false }: { onlyFirst?: boolean } = {}): RegExp {
  // Valid string terminator sequences are BEL, ESC\, and C1 ST
  const st = `(?:${BEL}|${ESC}\\\\|${C1_ST})`;

  // OSC sequences only: ESC ] ... ST
  // The payload stops at the first terminator character rather than scanning
  // ahead for one, so an unterminated `ESC ]` cannot rescan the rest of the
  // input. Terminals likewise abort a control string on an unexpected ESC.
  const osc = `(?:${ESC}\\][^${BEL}${ESC}${C1_ST}]*${st})`;

  // CSI and related: ESC/C1, optional intermediates, optional params
  // (supports ; and :) then final byte
  const csi = `[${ESC}${C1_CSI}][[\\]()#;?]*(?:\\d{1,4}(?:[;:]\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]`;

  return new RegExp(`${osc}|${csi}`, onlyFirst ? undefined : "g");
}

const regex = ansiRegex();

export default function stripAnsi(string: string): string {
  // Fast path: ANSI codes require ESC (7-bit) or CSI (8-bit) introducer
  if (!string.includes(ESC) && !string.includes(C1_CSI)) {
    return string;
  }

  // Even though the regex is global, we don't need to reset `.lastIndex`
  // because `.replace()` does it automatically.
  return string.replace(regex, "");
}
