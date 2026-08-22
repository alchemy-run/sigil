import { stripVTControlCharacters } from "node:util";

// Node's stripVTControlCharacters only understands semicolon-separated CSI
// parameters, so an ITU T.416 colon-parameter SGR sequence like
// `\u001B[38:2::255:100:0m` — which Sigil deliberately preserves in output
// (see sanitize-ansi.ts) — would leave `:2::255:100:0m` behind. Remove those
// first, then let Node handle everything else.
// https://github.com/nodejs/node/pull/65379 fixes this upstream; this wrapper
// can go once the minimum supported Node version ships it.
const colonSgrRegex = /(?:\u001B\[|\u009B)[\d;]*:[\d;:]*m/g;

export const stripAnsi = (input: string): string =>
  stripVTControlCharacters(input.replaceAll(colonSgrRegex, ""));
