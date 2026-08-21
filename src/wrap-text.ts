import cliTruncate from "./ansi/truncate.ts";
import wrapAnsi from "./ansi/wrap.ts";
import QuickLRU from "./quick-lru.ts";
import { type Styles } from "./styles.ts";

export const wrapTextCache = new QuickLRU<string, string>({ maxSize: 4096 });

const wrapText = (text: string, maxWidth: number, wrapType: Styles["textWrap"]): string => {
  const cacheKey = text + String(maxWidth) + String(wrapType);
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

    wrappedText = cliTruncate(text, maxWidth, { position });
  }

  wrapTextCache.set(cacheKey, wrappedText);

  return wrappedText;
};

export default wrapText;
