import widestLine from "./ansi/widest-line.ts";
import QuickLRU from "./quick-lru.ts";

const cache = new QuickLRU<string, Output>({ maxSize: 4096 });

type Output = {
  width: number;
  height: number;
};

const measureText = (text: string): Output => {
  if (text.length === 0) {
    return {
      width: 0,
      height: 0,
    };
  }

  const cachedDimensions = cache.get(text);

  if (cachedDimensions) {
    return cachedDimensions;
  }

  const width = widestLine(text);
  const height = text.split("\n").length;
  const dimensions = { width, height };
  cache.set(text, dimensions);

  return dimensions;
};

export default measureText;
