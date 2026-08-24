import { styledCharsFromTokens, type StyledChar, tokenize } from "#/ansi/tokenize.ts";

export type AnsiTransformer = (text: string, line: number) => string;

/** The single ANSI compatibility boundary used by Transform and external styled strings. */
export function transformAnsiLine(
  serializedSubtree: string,
  lineIndex: number,
  transformers: readonly AnsiTransformer[],
): readonly StyledChar[] {
  let transformed = serializedSubtree;
  for (const transformer of transformers) transformed = transformer(transformed, lineIndex);
  return styledCharsFromTokens(tokenize(transformed));
}
