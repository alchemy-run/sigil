// Terminal string styling with a chalk-compatible API for the styles Ink uses.
// Ported from `chalk` (MIT, Sindre Sorhus) without the chaining builder —
// Ink only ever applies one style per call.
import { ESC } from "#/ansi/escapes.ts";
import {
  background,
  backgroundColorNames,
  foreground,
  foregroundColorNames,
  hexToRgb,
  modifierNames,
  rgbToAnsi,
  rgbToAnsi256,
  styles,
  type BackgroundColorName,
  type ForegroundColorName,
  type ModifierName,
} from "#/ansi/sgr.ts";
import {
  supportsColor as supportsColorDetection,
  type ColorInfo,
  type ColorSupportLevel,
} from "#/ansi/supports-color.ts";

export type { BackgroundColorName, ForegroundColorName, ModifierName };

export type StyleFunction = (text: string) => string;

const { stdout: stdoutColor } = supportsColorDetection;

// `level` → color model for hex/rgb downsampling
const levelMapping = ["ansi", "ansi", "ansi256", "ansi16m"] as const;
type ColorModel = (typeof levelMapping)[number];

const state = {
  level: stdoutColor ? stdoutColor.level : 0,
};

// Replace every occurrence of `substring` with `substring + replacer`,
// re-opening a style after a nested close code would have ended it.
const applyStyle = (open: string, close: string, text: string): string => {
  if (state.level <= 0 || !text) {
    return text;
  }

  let string = text;

  if (string.includes(ESC)) {
    // Re-open the style wherever the text already contains its close code,
    // otherwise only the part before that code would stay styled.
    string = string.replaceAll(close, close + open);
  }

  if (string.includes("\n")) {
    // Close the style before every line break and reopen it after, to prevent
    // background bleed across lines (https://github.com/chalk/chalk/pull/92).
    string = string.replaceAll(/\r?\n/g, `${close}$&${open}`);
  }

  return open + string + close;
};

const styleFunction = (open: string, close: string): StyleFunction => {
  return (text) => applyStyle(open, close, text);
};

const foregroundOpen = (model: ColorModel, args: number[] | [string]): string => {
  return colorOpen(model, args, foreground, rgbToAnsi256, rgbToAnsi);
};

const backgroundOpen = (model: ColorModel, args: number[] | [string]): string => {
  return colorOpen(model, args, background, rgbToAnsi256, rgbToAnsi);
};

const colorOpen = (
  model: ColorModel,
  args: number[] | [string],
  space: typeof foreground,
  toAnsi256: typeof rgbToAnsi256,
  toAnsi: typeof rgbToAnsi,
): string => {
  const rgb = (typeof args[0] === "string" ? hexToRgb(args[0]) : args) as [number, number, number];

  if (model === "ansi16m") {
    return space.ansi16m(...rgb);
  }

  if (model === "ansi256") {
    return space.ansi256(toAnsi256(...rgb));
  }

  return space.ansi(toAnsi(...rgb));
};

type NamedStyles = Record<ModifierName | ForegroundColorName | BackgroundColorName, StyleFunction>;

export type Chalk = NamedStyles & {
  level: ColorSupportLevel;
  hex: (color: string) => StyleFunction;
  bgHex: (color: string) => StyleFunction;
  rgb: (red: number, green: number, blue: number) => StyleFunction;
  bgRgb: (red: number, green: number, blue: number) => StyleFunction;
  ansi256: (code: number) => StyleFunction;
  bgAnsi256: (code: number) => StyleFunction;
};

const named = {} as NamedStyles;

for (const name of [...modifierNames, ...foregroundColorNames, ...backgroundColorNames]) {
  named[name] = styleFunction(styles[name].open, styles[name].close);
}

export const chalk: Chalk = {
  ...named,

  get level(): ColorSupportLevel {
    return state.level;
  },
  set level(level: ColorSupportLevel) {
    state.level = level;
  },

  hex: (color) =>
    styleFunction(foregroundOpen(levelMapping[state.level], [color]), foreground.close),
  bgHex: (color) =>
    styleFunction(backgroundOpen(levelMapping[state.level], [color]), background.close),
  rgb: (red, green, blue) =>
    styleFunction(foregroundOpen(levelMapping[state.level], [red, green, blue]), foreground.close),
  bgRgb: (red, green, blue) =>
    styleFunction(backgroundOpen(levelMapping[state.level], [red, green, blue]), background.close),
  // Like chalk, 256-color styles always emit 8-bit codes (level only gates level 0).
  ansi256: (code) => styleFunction(foreground.ansi256(code), foreground.close),
  bgAnsi256: (code) => styleFunction(background.ansi256(code), background.close),
};

export const supportsColor: ColorInfo = stdoutColor;
