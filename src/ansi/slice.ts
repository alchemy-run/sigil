// Slice a string by visible column positions, preserving active ANSI styles.
// Replaces `slice-ansi`, built on the shared tokenizer instead of a second
// escape parser: characters keep their computed style lists, and the result
// is re-emitted with minimal escape codes. A full-width character that would
// be cut in half at either boundary is dropped, like `slice-ansi` does.
import {
  styledCharsFromTokens,
  styledCharsToString,
  tokenize,
  type StyledChar,
} from "./tokenize.ts";

export default function sliceAnsi(string: string, start: number, end?: number): string {
  const sliceEnd = end ?? Number.POSITIVE_INFINITY;

  if (start >= sliceEnd || string === "") {
    return "";
  }

  if (start === 0 && sliceEnd === Number.POSITIVE_INFINITY) {
    return string;
  }

  const chars = styledCharsFromTokens(tokenize(string));
  const included: StyledChar[] = [];
  let column = 0;

  for (const char of chars) {
    const width = char.fullWidth ? 2 : 1;

    if (column + width > sliceEnd) {
      break;
    }

    if (column >= start) {
      included.push(char);
    }

    column += width;
  }

  return styledCharsToString(included);
}
