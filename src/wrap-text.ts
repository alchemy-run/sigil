import { styledCharsFromTokens, styledCharsToString, tokenize } from "#/ansi/tokenize.ts";
import { cliTruncate } from "#/ansi/truncate.ts";
import { wrapAnsi } from "#/ansi/wrap.ts";
import { SizedCache } from "#/sized-cache.ts";
import { type Styles } from "#/styles.ts";

// Sized by UTF-16 code units of the key and the wrapped text.
export const wrapTextCache = new SizedCache<string, string>(2 ** 20);

export const wrapText = (text: string, maxWidth: number, wrapType: Styles["textWrap"]): string => {
  if (wrapType === "none") {
    return text;
  }

  // Wrapping into zero columns would put every character on its own row.
  // Text with no room keeps its natural width instead; truncation cuts to nothing.
  if (maxWidth <= 0 && (wrapType === "wrap" || wrapType === "hard")) {
    return text;
  }

  // Yoga rounds a text node's width up to a whole column.
  if (maxWidth > 0 && maxWidth < 1) {
    maxWidth = 1;
  }

  // `text` goes last because it's the only part of the key that can contain
  // arbitrary characters, so ("ab", 12) and ("ab1", 2) can't collide.
  const cacheKey = `${maxWidth}\u0000${String(wrapType)}\u0000${text}`;
  const cachedText = wrapTextCache.get(cacheKey);

  if (cachedText !== undefined) {
    return cachedText;
  }

  let wrappedText = text;

  if (wrapType === "wrap") {
    wrappedText = wrapAnsi(text, maxWidth, {
      trim: false,
      hard: true,
    });
  }

  if (wrapType === "hard") {
    wrappedText = wrapAnsi(text, maxWidth, {
      trim: false,
      hard: true,
      wordWrap: false,
    });
  }

  if (wrapType!.startsWith("truncate")) {
    let position: "end" | "middle" | "start" = "end";

    if (wrapType === "truncate-middle") {
      position = "middle";
    }

    if (wrapType === "truncate-start") {
      position = "start";
    }

    // `cliTruncate` treats its input as one line, so truncate each line on its
    // own. Splitting styled characters reopens styles that span a newline.
    let lines = [text];

    if (text.includes("\n")) {
      const styledLines: ReturnType<typeof styledCharsFromTokens>[] = [[]];
      for (const character of styledCharsFromTokens(tokenize(text))) {
        if (character.value === "\n") {
          styledLines.push([]);
        } else {
          styledLines.at(-1)!.push(character);
        }
      }

      lines = styledLines.map((line) => styledCharsToString(line));
    }

    wrappedText = lines.map((line) => cliTruncate(line, maxWidth, { position })).join("\n");
  }

  wrapTextCache.set(cacheKey, wrappedText, cacheKey.length + wrappedText.length);

  return wrappedText;
};
