import { eastAsianWidth } from "./east-asian-width.ts";
// Visual width of a string: how many terminal columns it occupies.
// Ported from `string-width` (MIT, Sindre Sorhus).
//
// Logic:
// - Segment graphemes to match how terminals render clusters.
// - Width rules:
//   1. Skip non-printing clusters (Default_Ignorable, Control, pure
//      nonspacing/enclosing Mark, lone Surrogates). Tabs are ignored by design.
//   2. RGI emoji clusters (\p{RGI_Emoji}) are double-width.
//   3. Minimally-qualified/unqualified emoji clusters (ZWJ sequences with 2+
//      Extended_Pictographic, or keycap sequences) are double-width.
//   4. Hangul jamo collapse each standard modern Hangul L+V or L+V+T syllable
//      piece to width 2. Unmatched repeated leading/vowel/trailing jamo stay
//      additive because that matches how the terminals we target render them.
//   5. Otherwise use East Asian Width of the cluster's first visible code
//      point, and add widths for trailing spacing marks and Halfwidth/Fullwidth
//      Forms within the same cluster (e.g., dakuten/handakuten).
import { C1_CSI, ESC } from "./escapes.ts";
import stripAnsi from "./strip.ts";

export type StringWidthOptions = {
  readonly ambiguousIsNarrow?: boolean;
  readonly countAnsiEscapeCodes?: boolean;
};

type EastAsianWidthOptions = {
  readonly ambiguousAsWide: boolean;
};

const segmenter = new Intl.Segmenter();

// Whole-cluster zero-width
const zeroWidthClusterRegex =
  /^(?:\p{Default_Ignorable_Code_Point}|\p{Control}|\p{Format}|\p{Nonspacing_Mark}|\p{Enclosing_Mark}|\p{Surrogate})+$/v;

// Pick the base scalar if the cluster starts with Prepend/Format/Marks
const leadingNonPrintingRegex =
  /^[\p{Default_Ignorable_Code_Point}\p{Control}\p{Format}\p{Nonspacing_Mark}\p{Enclosing_Mark}\p{Surrogate}]+/v;
const spacingMarkRegex = /\p{Spacing_Mark}/v;

// RGI emoji sequences
const rgiEmojiRegex = /^\p{RGI_Emoji}$/v;

// Detect minimally-qualified/unqualified emoji sequences (missing VS16 but
// still rendering as double-width)
const unqualifiedKeycapRegex = /^[\d#*]\u20E3$/;
const extendedPictographicRegex = /\p{Extended_Pictographic}/gu;

function isDoubleWidthNonRgiEmojiSequence(segment: string): boolean {
  // Real emoji clusters are < 30 chars; guard against pathological input
  if (segment.length > 50) {
    return false;
  }

  if (unqualifiedKeycapRegex.test(segment)) {
    return true;
  }

  // ZWJ sequences with 2+ Extended_Pictographic
  if (segment.includes("\u200D")) {
    const pictographics = segment.match(extendedPictographicRegex);
    return pictographics !== null && pictographics.length >= 2;
  }

  return false;
}

function baseVisible(segment: string): string {
  return segment.replace(leadingNonPrintingRegex, "");
}

function isZeroWidthCluster(segment: string): boolean {
  return zeroWidthClusterRegex.test(segment);
}

function isHangulLeadingJamo(codePoint: number | undefined): boolean {
  return (
    codePoint !== undefined &&
    ((codePoint >= 0x11_00 && codePoint <= 0x11_5f) ||
      (codePoint >= 0xa9_60 && codePoint <= 0xa9_7c))
  );
}

function isHangulVowelJamo(codePoint: number | undefined): boolean {
  return (
    codePoint !== undefined &&
    ((codePoint >= 0x11_60 && codePoint <= 0x11_a7) ||
      (codePoint >= 0xd7_b0 && codePoint <= 0xd7_c6))
  );
}

function isHangulTrailingJamo(codePoint: number | undefined): boolean {
  return (
    codePoint !== undefined &&
    ((codePoint >= 0x11_a8 && codePoint <= 0x11_ff) ||
      (codePoint >= 0xd7_cb && codePoint <= 0xd7_fb))
  );
}

function isHangulJamo(codePoint: number): boolean {
  return (
    isHangulLeadingJamo(codePoint) ||
    isHangulVowelJamo(codePoint) ||
    isHangulTrailingJamo(codePoint)
  );
}

function hangulClusterWidth(
  visibleSegment: string,
  eastAsianWidthOptions: EastAsianWidthOptions,
): number | undefined {
  const codePoints: number[] = [];

  for (const character of visibleSegment) {
    if (zeroWidthClusterRegex.test(character)) {
      continue;
    }

    codePoints.push(character.codePointAt(0)!);
  }

  if (codePoints.length === 0) {
    return;
  }

  let width = 0;

  for (let index = 0; index < codePoints.length; index++) {
    const codePoint = codePoints[index]!;
    if (!isHangulJamo(codePoint)) {
      if (width === 0) {
        return;
      }

      // Mixed cluster (e.g., L + precomposed syllable): use EAW for the
      // non-jamo remainder
      for (let remaining = index; remaining < codePoints.length; remaining++) {
        width += eastAsianWidth(codePoints[remaining]!, eastAsianWidthOptions);
      }

      return width;
    }

    // Modern Hangul L+V(+T) shapes as one syllable block. Unmatched jamo stay
    // additive: U+1100 U+1100 U+1161 => U+1100 + (U+1100 U+1161) => 2 + 2.
    if (isHangulLeadingJamo(codePoint) && isHangulVowelJamo(codePoints[index + 1])) {
      width += 2;
      index += isHangulTrailingJamo(codePoints[index + 2]) ? 2 : 1;
      continue;
    }

    width += eastAsianWidth(codePoint, eastAsianWidthOptions);
  }

  return width;
}

function trailingWidth(
  visibleSegment: string,
  eastAsianWidthOptions: EastAsianWidthOptions,
): number {
  let extra = 0;
  let first = true;

  for (const character of visibleSegment) {
    if (first) {
      first = false;
      continue;
    }

    if (spacingMarkRegex.test(character) || (character >= "\uFF00" && character <= "\uFFEF")) {
      extra += eastAsianWidth(character.codePointAt(0)!, eastAsianWidthOptions);
    }
  }

  return extra;
}

export default function stringWidth(input: string, options: StringWidthOptions = {}): number {
  if (typeof input !== "string" || input.length === 0) {
    return 0;
  }

  const { ambiguousIsNarrow = true, countAnsiEscapeCodes = false } = options;

  let string = input;

  // Avoid calling stripAnsi when there are no ANSI escape sequences
  // (ESC = 0x1B, CSI = 0x9B)
  if (!countAnsiEscapeCodes && (string.includes(ESC) || string.includes(C1_CSI))) {
    string = stripAnsi(string);
  }

  if (string.length === 0) {
    return 0;
  }

  // Fast path: printable ASCII (0x20–0x7E) needs no segmenter, regex, or EAW
  // lookup — width equals length.
  if (/^[ -~]*$/.test(string)) {
    return string.length;
  }

  let width = 0;
  const eastAsianWidthOptions: EastAsianWidthOptions = { ambiguousAsWide: !ambiguousIsNarrow };

  for (const { segment } of segmenter.segment(string)) {
    // Zero-width / non-printing clusters
    if (isZeroWidthCluster(segment)) {
      continue;
    }

    // Emoji width logic
    if (rgiEmojiRegex.test(segment) || isDoubleWidthNonRgiEmojiSequence(segment)) {
      width += 2;
      continue;
    }

    const visibleSegment = baseVisible(segment);
    const hangulWidth = hangulClusterWidth(visibleSegment, eastAsianWidthOptions);
    if (hangulWidth !== undefined) {
      width += hangulWidth;
      continue;
    }

    // Everything else: EAW of the cluster's first visible scalar
    const codePoint = visibleSegment.codePointAt(0)!;
    width += eastAsianWidth(codePoint, eastAsianWidthOptions);

    // Add width for trailing spacing marks and Halfwidth/Fullwidth Forms
    width += trailingWidth(visibleSegment, eastAsianWidthOptions);
  }

  return width;
}
