import os from "node:os";
// Derived from `ansi-escapes` (MIT, Sindre Sorhus), reduced to the escapes Ink uses.
import process from "node:process";

// Control characters and sequence introducers. This module is the single
// home for escape sequences: everything else imports these instead of
// spelling out `\u001B[...` inline.
export const ESC = "\u001B";
export const BEL = "\u0007";
export const DEL = "\u007F";
/** Control Sequence Introducer. */
export const CSI = `${ESC}[`;
/** Operating System Command. */
export const OSC = `${ESC}]`;
/** String Terminator. */
export const ST = `${ESC}\\`;
/** Single-byte C1 forms of CSI and ST. */
export const C1_CSI = "\u009B";
export const C1_ST = "\u009C";

const sep = ";";

export const cursorTo = (x: number, y?: number): string => {
  if (typeof y !== "number") {
    return CSI + (x + 1) + "G";
  }

  return CSI + (y + 1) + sep + (x + 1) + "H";
};

export const cursorUp = (count = 1): string => CSI + count + "A";
export const cursorDown = (count = 1): string => CSI + count + "B";
export const cursorLeft = CSI + "G";
export const cursorNextLine = CSI + "E";

export const eraseEndLine = CSI + "K";
export const eraseLine = CSI + "2K";
export const eraseScreen = CSI + "2J";

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
  ? `${eraseScreen}${CSI}0f`
  : // 1. Erases the screen (only done in case `2` is not supported)
    // 2. Erases the whole screen including scrollback buffer
    // 3. Moves cursor to the top-left position
    `${eraseScreen}${CSI}3J${CSI}H`;

export const enterAlternativeScreen = CSI + "?1049h";
export const exitAlternativeScreen = CSI + "?1049l";

export const cursorShow = CSI + "?25h";
export const cursorHide = CSI + "?25l";

export const enableBracketedPaste = CSI + "?2004h";
export const disableBracketedPaste = CSI + "?2004l";

// Markers the terminal wraps around pasted input while bracketed paste is on.
export const pasteStart = CSI + "200~";
export const pasteEnd = CSI + "201~";

// Synchronized update mode (DEC mode 2026): begin / end synchronized update.
export const bsu = CSI + "?2026h";
export const esu = CSI + "?2026l";

// Kitty keyboard protocol: query support, push a flag set, pop it off.
export const kittyQuery = CSI + "?u";
export const pushKittyKeyboard = (flags: number): string => `${CSI}>${flags}u`;
export const popKittyKeyboard = CSI + "<u";

export const link = (text: string, url: string): string =>
  [OSC, "8", sep, sep, url, BEL, text, OSC, "8", sep, sep, BEL].join("");

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
  enableBracketedPaste,
  disableBracketedPaste,
  pasteStart,
  pasteEnd,
  bsu,
  esu,
  kittyQuery,
  pushKittyKeyboard,
  popKittyKeyboard,
  link,
};

export default ansiEscapes;
