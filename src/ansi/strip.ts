// ANSI escape sequence matching and removal.
// Ported from `ansi-regex` and `strip-ansi` (MIT, Sindre Sorhus).

export function ansiRegex({ onlyFirst = false }: { onlyFirst?: boolean } = {}): RegExp {
  // Valid string terminator sequences are BEL, ESC\, and 0x9c
  const ST = "(?:\\u0007|\\u001B\\u005C|\\u009C)";

  // OSC sequences only: ESC ] ... ST
  // The payload stops at the first terminator character rather than scanning
  // ahead for one, so an unterminated `ESC ]` cannot rescan the rest of the
  // input. Terminals likewise abort a control string on an unexpected ESC.
  const osc = `(?:\\u001B\\][^\\u0007\\u001B\\u009C]*${ST})`;

  // CSI and related: ESC/C1, optional intermediates, optional params
  // (supports ; and :) then final byte
  const csi = "[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:[;:]\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]";

  return new RegExp(`${osc}|${csi}`, onlyFirst ? undefined : "g");
}

const regex = ansiRegex();

export default function stripAnsi(string: string): string {
  // Fast path: ANSI codes require ESC (7-bit) or CSI (8-bit) introducer
  if (!string.includes("\u001B") && !string.includes("\u009B")) {
    return string;
  }

  // Even though the regex is global, we don't need to reset `.lastIndex`
  // because `.replace()` does it automatically.
  return string.replace(regex, "");
}
