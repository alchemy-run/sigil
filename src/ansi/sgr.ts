// ANSI SGR style tables and color-space conversions.
// Ported from `ansi-styles` (MIT, Sindre Sorhus).

const ANSI_BACKGROUND_OFFSET = 10;

export type StylePair = {
  readonly open: string;
  readonly close: string;
};

const wrapAnsi16 =
  (offset = 0) =>
  (code: number): string =>
    `\u001B[${code + offset}m`;

const wrapAnsi256 =
  (offset = 0) =>
  (code: number): string =>
    `\u001B[${38 + offset};5;${code}m`;

const wrapAnsi16m =
  (offset = 0) =>
  (red: number, green: number, blue: number): string =>
    `\u001B[${38 + offset};2;${red};${green};${blue}m`;

const modifierCodes = {
  reset: [0, 0],
  // 21 isn't widely supported and 22 does the same thing
  bold: [1, 22],
  dim: [2, 22],
  italic: [3, 23],
  underline: [4, 24],
  overline: [53, 55],
  inverse: [7, 27],
  hidden: [8, 28],
  strikethrough: [9, 29],
} as const;

const colorCodes = {
  black: [30, 39],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  blue: [34, 39],
  magenta: [35, 39],
  cyan: [36, 39],
  white: [37, 39],

  // Bright colors
  blackBright: [90, 39],
  gray: [90, 39], // Alias of `blackBright`
  grey: [90, 39], // Alias of `blackBright`
  redBright: [91, 39],
  greenBright: [92, 39],
  yellowBright: [93, 39],
  blueBright: [94, 39],
  magentaBright: [95, 39],
  cyanBright: [96, 39],
  whiteBright: [97, 39],
} as const;

const bgColorCodes = {
  bgBlack: [40, 49],
  bgRed: [41, 49],
  bgGreen: [42, 49],
  bgYellow: [43, 49],
  bgBlue: [44, 49],
  bgMagenta: [45, 49],
  bgCyan: [46, 49],
  bgWhite: [47, 49],

  // Bright colors
  bgBlackBright: [100, 49],
  bgGray: [100, 49], // Alias of `bgBlackBright`
  bgGrey: [100, 49], // Alias of `bgBlackBright`
  bgRedBright: [101, 49],
  bgGreenBright: [102, 49],
  bgYellowBright: [103, 49],
  bgBlueBright: [104, 49],
  bgMagentaBright: [105, 49],
  bgCyanBright: [106, 49],
  bgWhiteBright: [107, 49],
} as const;

export type ModifierName = keyof typeof modifierCodes;
export type ForegroundColorName = keyof typeof colorCodes;
export type BackgroundColorName = keyof typeof bgColorCodes;
export type StyleName = ModifierName | ForegroundColorName | BackgroundColorName;

export const modifierNames = Object.keys(modifierCodes) as ModifierName[];
export const foregroundColorNames = Object.keys(colorCodes) as ForegroundColorName[];
export const backgroundColorNames = Object.keys(bgColorCodes) as BackgroundColorName[];

const toPairs = <Name extends string>(
  codes: Record<Name, readonly [number, number]>,
): Record<Name, StylePair> => {
  const result = {} as Record<Name, StylePair>;

  for (const [name, [open, close]] of Object.entries(codes) as Array<
    [Name, readonly [number, number]]
  >) {
    result[name] = { open: `\u001B[${open}m`, close: `\u001B[${close}m` };
  }

  return result;
};

/**
Named SGR styles as `{open, close}` escape sequence pairs.
*/
export const styles: Record<StyleName, StylePair> = {
  ...toPairs(modifierCodes),
  ...toPairs(colorCodes),
  ...toPairs(bgColorCodes),
};

/**
Raw SGR code numbers: open code → close code.
*/
export const codes: ReadonlyMap<number, number> = new Map(
  [
    ...Object.values<readonly [number, number]>(modifierCodes),
    ...Object.values<readonly [number, number]>(colorCodes),
    ...Object.values<readonly [number, number]>(bgColorCodes),
  ].map(([open, close]) => [open, close]),
);

export const foreground = {
  close: "\u001B[39m",
  ansi: wrapAnsi16(),
  ansi256: wrapAnsi256(),
  ansi16m: wrapAnsi16m(),
};

export const background = {
  close: "\u001B[49m",
  ansi: wrapAnsi16(ANSI_BACKGROUND_OFFSET),
  ansi256: wrapAnsi256(ANSI_BACKGROUND_OFFSET),
  ansi16m: wrapAnsi16m(ANSI_BACKGROUND_OFFSET),
};

// Conversions from https://github.com/Qix-/color-convert
export const rgbToAnsi256 = (red: number, green: number, blue: number): number => {
  // We use the extended greyscale palette here, with the exception of
  // black and white. The normal palette only has 4 greyscale shades.
  if (red === green && green === blue) {
    if (red < 8) {
      return 16;
    }

    if (red > 248) {
      return 231;
    }

    return Math.round(((red - 8) / 247) * 24) + 232;
  }

  return (
    16 +
    36 * Math.round((red / 255) * 5) +
    6 * Math.round((green / 255) * 5) +
    Math.round((blue / 255) * 5)
  );
};

export const hexToRgb = (hex: string): [number, number, number] => {
  const matches = /[a-f\d]{6}|[a-f\d]{3}/i.exec(hex);
  if (!matches) {
    return [0, 0, 0];
  }

  let [colorString] = matches;

  if (colorString.length === 3) {
    colorString = colorString
      .split("")
      .map((character) => character + character)
      .join("");
  }

  const integer = Number.parseInt(colorString, 16);

  /* eslint-disable no-bitwise */
  return [(integer >> 16) & 0xff, (integer >> 8) & 0xff, integer & 0xff];
  /* eslint-enable no-bitwise */
};

export const hexToAnsi256 = (hex: string): number => rgbToAnsi256(...hexToRgb(hex));

export const ansi256ToAnsi = (code: number): number => {
  if (code < 8) {
    return 30 + code;
  }

  if (code < 16) {
    return 90 + (code - 8);
  }

  let red;
  let green;
  let blue;

  if (code >= 232) {
    red = ((code - 232) * 10 + 8) / 255;
    green = red;
    blue = red;
  } else {
    code -= 16;

    const remainder = code % 36;

    red = Math.floor(code / 36) / 5;
    green = Math.floor(remainder / 6) / 5;
    blue = (remainder % 6) / 5;
  }

  const value = Math.max(red, green, blue) * 2;

  if (value === 0) {
    return 30;
  }

  // eslint-disable-next-line no-bitwise
  let result = 30 + ((Math.round(blue) << 2) | (Math.round(green) << 1) | Math.round(red));

  if (value === 2) {
    result += 60;
  }

  return result;
};

export const rgbToAnsi = (red: number, green: number, blue: number): number =>
  ansi256ToAnsi(rgbToAnsi256(red, green, blue));

export const hexToAnsi = (hex: string): number => ansi256ToAnsi(hexToAnsi256(hex));
