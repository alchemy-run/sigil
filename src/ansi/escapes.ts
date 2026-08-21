import os from "node:os";
// Derived from `ansi-escapes` (MIT, Sindre Sorhus), reduced to the escapes Ink uses.
import process from "node:process";

const csi = "\u001B[";
const sep = ";";

export const cursorTo = (x: number, y?: number): string => {
  if (typeof y !== "number") {
    return csi + (x + 1) + "G";
  }

  return csi + (y + 1) + sep + (x + 1) + "H";
};

export const cursorUp = (count = 1): string => csi + count + "A";
export const cursorDown = (count = 1): string => csi + count + "B";
export const cursorLeft = csi + "G";
export const cursorNextLine = csi + "E";

export const eraseEndLine = csi + "K";
export const eraseLine = csi + "2K";
export const eraseScreen = csi + "2J";

export const eraseLines = (count: number): string => {
  let clear = "";

  for (let i = 0; i < count; i++) {
    clear += eraseLine + (i < count - 1 ? cursorUp() : "");
  }

  if (count) {
    clear += cursorLeft;
  }

  return clear;
};

// Windows 10 builds before 10586 don't support the `3J` escape.
const isOldWindows = (): boolean => {
  if (process.platform !== "win32") {
    return false;
  }

  const parts = os.release().split(".");
  const major = Number(parts[0]);
  const build = Number(parts[2] ?? 0);

  if (major < 10) {
    return true;
  }

  return major === 10 && build < 10_586;
};

export const clearTerminal = isOldWindows()
  ? `${eraseScreen}${csi}0f`
  : // 1. Erases the screen (only done in case `2` is not supported)
    // 2. Erases the whole screen including scrollback buffer
    // 3. Moves cursor to the top-left position
    `${eraseScreen}${csi}3J${csi}H`;

export const enterAlternativeScreen = csi + "?1049h";
export const exitAlternativeScreen = csi + "?1049l";

export const cursorShow = csi + "?25h";
export const cursorHide = csi + "?25l";

const osc = "\u001B]";
const bel = "\u0007";

export const link = (text: string, url: string): string =>
  [osc, "8", sep, sep, url, bel, text, osc, "8", sep, sep, bel].join("");

const ansiEscapes = {
  cursorTo,
  cursorUp,
  cursorDown,
  cursorLeft,
  cursorNextLine,
  eraseEndLine,
  eraseLine,
  eraseScreen,
  eraseLines,
  clearTerminal,
  enterAlternativeScreen,
  exitAlternativeScreen,
  cursorShow,
  cursorHide,
  link,
};

export default ansiEscapes;
