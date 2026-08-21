// Truncate a string to a visible width, ANSI-aware.
// Ported from `cli-truncate` (MIT, Sindre Sorhus) on top of the shared
// slice and width modules.
import sliceAnsi from "./slice.ts";
import stringWidth from "./string-width.ts";

export type TruncateOptions = {
  readonly position?: "start" | "middle" | "end";
  readonly space?: boolean;
  readonly preferTruncationOnSpace?: boolean;
  readonly truncationCharacter?: string;
};

function getIndexOfNearestSpace(
  string: string,
  wantedIndex: number,
  shouldSearchRight = false,
): number {
  if (string.charAt(wantedIndex) === " ") {
    return wantedIndex;
  }

  const direction = shouldSearchRight ? 1 : -1;

  for (let index = 0; index <= 3; index++) {
    const finalIndex = wantedIndex + index * direction;
    if (string.charAt(finalIndex) === " ") {
      return finalIndex;
    }
  }

  return wantedIndex;
}

const ANSI_ESC = 27;
const ANSI_LEFT_BRACKET = 91;
const ANSI_LETTER_M = 109;

const isSgrParameter = (code: number): boolean => (code >= 48 && code <= 57) || code === 59; // 0-9 or ;

function leadingSgrSpanEndIndex(string: string): number {
  let index = 0;
  while (
    index + 2 < string.length &&
    string.codePointAt(index) === ANSI_ESC &&
    string.codePointAt(index + 1) === ANSI_LEFT_BRACKET
  ) {
    let scan = index + 2;
    while (scan < string.length && isSgrParameter(string.codePointAt(scan)!)) {
      scan++;
    }

    if (scan < string.length && string.codePointAt(scan) === ANSI_LETTER_M) {
      index = scan + 1;
      continue;
    }

    break;
  }

  return index;
}

function trailingSgrSpanStartIndex(string: string): number {
  let start = string.length;
  while (start > 1 && string.codePointAt(start - 1) === ANSI_LETTER_M) {
    let scan = start - 2;
    while (scan >= 0 && isSgrParameter(string.codePointAt(scan)!)) {
      scan--;
    }

    if (
      scan >= 1 &&
      string.codePointAt(scan - 1) === ANSI_ESC &&
      string.codePointAt(scan) === ANSI_LEFT_BRACKET
    ) {
      start = scan - 1;
      continue;
    }

    break;
  }

  return start;
}

// Insert the truncation character before the trailing SGR close codes, so the
// visible truncation character inherits the styling of the truncated text.
function appendWithInheritedStyleFromEnd(visible: string, suffix: string): string {
  const start = trailingSgrSpanStartIndex(visible);
  if (start === visible.length) {
    return visible + suffix;
  }

  return visible.slice(0, start) + suffix + visible.slice(start);
}

function prependWithInheritedStyleFromStart(prefix: string, visible: string): string {
  const end = leadingSgrSpanEndIndex(visible);
  if (end === 0) {
    return prefix + visible;
  }

  return visible.slice(0, end) + prefix + visible.slice(end);
}

export default function cliTruncate(
  text: string,
  columns: number,
  options: TruncateOptions = {},
): string {
  const { position = "end", space = false, preferTruncationOnSpace = false } = options;

  let { truncationCharacter = "…" } = options;

  if (columns < 1) {
    return "";
  }

  const length = stringWidth(text);

  if (length <= columns) {
    return text;
  }

  if (columns === 1) {
    return truncationCharacter;
  }

  if (position === "start") {
    if (preferTruncationOnSpace) {
      const nearestSpace = getIndexOfNearestSpace(
        text,
        length - columns + stringWidth(truncationCharacter),
        true,
      );
      const right = sliceAnsi(text, nearestSpace, length).trim();
      return prependWithInheritedStyleFromStart(truncationCharacter, right);
    }

    if (space) {
      truncationCharacter += " ";
    }

    const right = sliceAnsi(text, length - columns + stringWidth(truncationCharacter), length);
    return prependWithInheritedStyleFromStart(truncationCharacter, right);
  }

  if (position === "middle") {
    if (space) {
      truncationCharacter = ` ${truncationCharacter} `;

      // Drop the padding spaces if the padded character does not fit, so the
      // truncation character itself never exceeds the budget.
      if (stringWidth(truncationCharacter) >= columns) {
        truncationCharacter = truncationCharacter.trim();
      }
    }

    const truncationWidth = stringWidth(truncationCharacter);
    // Reserve room for the truncation character before splitting the budget
    // between the two sides, otherwise small budgets overflow.
    const half = Math.min(Math.floor(columns / 2), Math.max(0, columns - truncationWidth));

    if (preferTruncationOnSpace) {
      const spaceNearFirstBreakPoint = getIndexOfNearestSpace(text, half);
      const spaceNearSecondBreakPoint = getIndexOfNearestSpace(
        text,
        length - (columns - half) + truncationWidth,
        true,
      );
      return (
        sliceAnsi(text, 0, spaceNearFirstBreakPoint) +
        truncationCharacter +
        sliceAnsi(text, spaceNearSecondBreakPoint, length).trim()
      );
    }

    return (
      sliceAnsi(text, 0, half) +
      truncationCharacter +
      sliceAnsi(text, length - (columns - half) + truncationWidth, length)
    );
  }

  if (preferTruncationOnSpace) {
    const nearestSpace = getIndexOfNearestSpace(text, columns - stringWidth(truncationCharacter));
    const left = sliceAnsi(text, 0, nearestSpace);
    return appendWithInheritedStyleFromEnd(left, truncationCharacter);
  }

  if (space) {
    truncationCharacter = ` ${truncationCharacter}`;
  }

  const left = sliceAnsi(text, 0, columns - stringWidth(truncationCharacter));
  return appendWithInheritedStyleFromEnd(left, truncationCharacter);
}
