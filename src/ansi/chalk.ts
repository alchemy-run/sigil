import { isatty } from "node:tty";

// Terminal string styling with a chalk-compatible API for the styles Ink uses.
// Ported from `chalk` (MIT, Sindre Sorhus), including chaining
// (`chalk.bold.red`) and independent instances via `createChalk`.
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
  createSupportsColor,
  detectColorLevel,
  type ColorInfo,
  type ColorSupportLevel,
} from "#/capabilities/detect.ts";
import type { ColorProfile } from "#/screen/color-profile.ts";

export type { BackgroundColorName, ForegroundColorName, ModifierName };

export type StyleFunction = (text: string) => string;

// `level` → color model for hex/rgb downsampling
const levelMapping = ["ansi", "ansi", "ansi256", "ansi16m"] as const;
type ColorModel = (typeof levelMapping)[number];

// Replace every occurrence of `substring` with `substring + replacer`,
// re-opening a style after a nested close code would have ended it.
const applyStyle = (open: string, close: string, text: string): string => {
  if (!text) {
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

const colorOpen = (
  model: ColorModel,
  args: number[] | [string],
  space: typeof foreground,
): string => {
  const rgb = (typeof args[0] === "string" ? hexToRgb(args[0]) : args) as [number, number, number];

  if (model === "ansi16m") {
    return space.ansi16m(...rgb);
  }

  if (model === "ansi256") {
    return space.ansi256(rgbToAnsi256(...rgb));
  }

  return space.ansi(rgbToAnsi(...rgb));
};

type NamedStyle = ModifierName | ForegroundColorName | BackgroundColorName;

/**
A chainable style: call it to style text, or read another style off it to
combine them, e.g. `chalk.bold.hex("#e28a5b")("hi")`.
*/
export type ChalkInstance = StyleFunction & {
  readonly [Name in NamedStyle]: ChalkInstance;
} & {
  /** Color support level for this instance; 0 disables styling. Shared by every style chained off it. */
  level: ColorSupportLevel;
  hex: (color: string) => ChalkInstance;
  bgHex: (color: string) => ChalkInstance;
  rgb: (red: number, green: number, blue: number) => ChalkInstance;
  bgRgb: (red: number, green: number, blue: number) => ChalkInstance;
  ansi256: (code: number) => ChalkInstance;
  bgAnsi256: (code: number) => ChalkInstance;
};

/** @deprecated Use {@link ChalkInstance}. */
export type Chalk = ChalkInstance;

export type ChalkOptions = {
  /**
	Color support level (`0`–`3`) or color profile. Defaults to the level
	detected for `stream`.
	*/
  readonly level?: ColorSupportLevel | ColorProfile;
  /**
	Stream to detect color support for (honors `FORCE_COLOR`, `NO_COLOR`,
	CI, and `isTTY`).

	@default process.stdout
	*/
  readonly stream?: { readonly isTTY?: boolean };
};

const profileLevels: Record<ColorProfile, ColorSupportLevel> = {
  none: 0,
  ansi16: 1,
  ansi256: 2,
  truecolor: 3,
};

type Styler = { readonly open: (model: ColorModel) => string; readonly close: string };

const stylersKey = Symbol("stylers");

/**
Creates a chalk with its own color level, so separate outputs (stdout, a
piped log, a file) can style independently instead of sharing one global.
*/
export function createChalk(options: ChalkOptions = {}): ChalkInstance {
  const state = {
    level:
      typeof options.level === "string"
        ? profileLevels[options.level]
        : (options.level ?? detectColorLevel(options.stream ?? { isTTY: isatty(1) })),
  };

  type Node = ChalkInstance & { [stylersKey]: readonly Styler[] };

  // Styles share one prototype (itself a function, so chained styles keep
  // Function.prototype); each node only carries its own styler list.
  const proto = (() => {}) as unknown as Node;
  const build = (stylers: readonly Styler[]): ChalkInstance => {
    const node = ((text: string) => {
      if (state.level <= 0) return text;
      const model = levelMapping[state.level];
      let styled = text;
      // Innermost first, so `bold.red` nests as `bold(red(text))`.
      for (let index = stylers.length - 1; index >= 0; index--) {
        const styler = stylers[index]!;
        styled = applyStyle(styler.open(model), styler.close, styled);
      }
      return styled;
    }) as Node;
    Object.setPrototypeOf(node, proto);
    node[stylersKey] = stylers;
    return node;
  };
  const chain = (self: Node, styler: Styler) => build([...self[stylersKey], styler]);

  const descriptors: PropertyDescriptorMap = {
    level: {
      get: () => state.level,
      set: (level: ColorSupportLevel) => {
        state.level = level;
      },
    },
  };
  for (const name of [...modifierNames, ...foregroundColorNames, ...backgroundColorNames]) {
    const { open, close } = styles[name];
    descriptors[name] = {
      get(this: Node) {
        return chain(this, { open: () => open, close });
      },
    };
  }
  const method = (make: (...args: never[]) => Styler): PropertyDescriptor => ({
    value(this: Node, ...args: never[]) {
      return chain(this, make(...args));
    },
  });
  Object.assign(descriptors, {
    hex: method((color: string) => ({
      open: (model) => colorOpen(model, [color], foreground),
      close: foreground.close,
    })),
    bgHex: method((color: string) => ({
      open: (model) => colorOpen(model, [color], background),
      close: background.close,
    })),
    rgb: method((red: number, green: number, blue: number) => ({
      open: (model) => colorOpen(model, [red, green, blue], foreground),
      close: foreground.close,
    })),
    bgRgb: method((red: number, green: number, blue: number) => ({
      open: (model) => colorOpen(model, [red, green, blue], background),
      close: background.close,
    })),
    // Like chalk, 256-color styles always emit 8-bit codes (level only gates level 0).
    ansi256: method((code: number) => ({
      open: () => foreground.ansi256(code),
      close: foreground.close,
    })),
    bgAnsi256: method((code: number) => ({
      open: () => background.ansi256(code),
      close: background.close,
    })),
  });
  Object.defineProperties(proto, descriptors);

  return build([]);
}

const stdoutColor = createSupportsColor({ isTTY: isatty(1) });

/** The default chalk, detected for stdout. Use {@link createChalk} for an independent level. */
export const chalk: ChalkInstance = createChalk({ level: stdoutColor ? stdoutColor.level : 0 });

export const supportsColor: ColorInfo = stdoutColor;
