// Derived from `fast-string-truncated-width` (MIT, Fabio Spampinato),
// reduced to plain width measurement: Sigil truncates via `truncate.ts`, and
// no caller customizes per-class widths, so those are constants here.
// Width tables live in east-asian-width.ts, the single width-data module.

import { isFullWidth, isWideNotCJKTNotEmoji } from "#/ansi/east-asian-width.ts";

const getCodePointsLength = (input: string): number => {
  let length = 0;

  for (const _ of input) {
    length += 1;
  }

  return length;
};

// Unlike the original port, CSI parameters also allow `:` so ITU T.416
// colon-parameter SGR sequences (which Sigil preserves) measure as width 0.
const ANSI_RE =
  /[\u001b\u009b][[()#;?]*[0-9;:]*[0-9A-ORZcf-nqry=><]|\u001b\]8;[^;]*;.*?(?:\u0007|\u001b\u005c)/y;
const CONTROL_RE = /[\x00-\x08\x0A-\x1F\x7F-\x9F]{1,1000}/y;
const CJKT_WIDE_RE =
  /(?:(?![\uFF61-\uFF9F\uFF00-\uFFEF])[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Tangut}]){1,1000}/uy;
const TAB_RE = /\t{1,1000}/y;
const EMOJI_RE =
  /[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F3F4}[\u{E0061}-\u{E007A}]{2}[\u{E0030}-\u{E0039}\u{E0061}-\u{E007A}]{1,3}\u{E007F}|(?:\p{Emoji}\uFE0F\u20E3?|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation})(?:\u200D(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F\u20E3?))*/uy;
const LATIN_RE = /(?:[\x20-\x7E\xA0-\xFF](?!\uFE0F)){1,1000}/y;
const MODIFIER_RE = /\p{M}+/gu;

const ANSI_WIDTH = 0;
const CONTROL_WIDTH = 0;
const TAB_WIDTH = 8;
const EMOJI_WIDTH = 2;
const FULL_WIDTH_WIDTH = 2;
const REGULAR_WIDTH = 1;
const WIDE_WIDTH = 2;

const PARSE_BLOCKS: [RegExp, number][] = [
  [LATIN_RE, REGULAR_WIDTH],
  [ANSI_RE, ANSI_WIDTH],
  [CONTROL_RE, CONTROL_WIDTH],
  [TAB_RE, TAB_WIDTH],
  [EMOJI_RE, EMOJI_WIDTH],
  [CJKT_WIDE_RE, WIDE_WIDTH],
];

export const stringWidth = (input: string): number => {
  let indexPrev = 0;
  let index = 0;
  const length = input.length;
  let unmatchedStart = 0;
  let unmatchedEnd = 0;
  let width = 0;

  outer: while (true) {
    /* UNMATCHED */

    if (unmatchedEnd > unmatchedStart || (index >= length && index > indexPrev)) {
      const unmatched = input.slice(unmatchedStart, unmatchedEnd) || input.slice(indexPrev, index);

      for (const char of unmatched.replaceAll(MODIFIER_RE, "")) {
        const codePoint = char.codePointAt(0) || 0;

        width += isFullWidth(codePoint)
          ? FULL_WIDTH_WIDTH
          : isWideNotCJKTNotEmoji(codePoint)
            ? WIDE_WIDTH
            : REGULAR_WIDTH;
      }

      unmatchedStart = unmatchedEnd = 0;
    }

    /* EXITING */

    if (index >= length) {
      break;
    }

    /* PARSE BLOCKS */

    for (let i = 0, l = PARSE_BLOCKS.length; i < l; i++) {
      const [BLOCK_RE, BLOCK_WIDTH] = PARSE_BLOCKS[i]!;

      BLOCK_RE.lastIndex = index;

      if (BLOCK_RE.test(input)) {
        const lengthExtra =
          BLOCK_RE === CJKT_WIDE_RE
            ? getCodePointsLength(input.slice(index, BLOCK_RE.lastIndex))
            : BLOCK_RE === EMOJI_RE
              ? 1
              : BLOCK_RE.lastIndex - index;

        width += lengthExtra * BLOCK_WIDTH;
        unmatchedStart = indexPrev;
        unmatchedEnd = index;
        index = indexPrev = BLOCK_RE.lastIndex;

        continue outer;
      }
    }

    /* UNMATCHED INDEX */

    index += 1;
  }

  return width;
};

export const widestLine = (text: string): number => {
  let lineWidth = 0;

  for (const line of text.split("\n")) {
    lineWidth = Math.max(lineWidth, stringWidth(line));
  }

  return lineWidth;
};
