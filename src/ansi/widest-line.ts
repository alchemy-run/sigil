// Derived from `widest-line` (MIT, Sindre Sorhus).
import stringWidth from "./string-width.ts";

const widestLine = (string: string): number => {
  let lineWidth = 0;

  for (const line of string.split("\n")) {
    lineWidth = Math.max(lineWidth, stringWidth(line));
  }

  return lineWidth;
};

export default widestLine;
