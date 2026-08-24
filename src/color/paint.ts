import type { TerminalAppearance } from "#/capabilities/detect.ts";
import type { Color, RgbColor } from "#/screen/cell.ts";
import type { ColorProfile } from "#/screen/color-profile.ts";

export type ColorInput = Color | string;
export type InterpolationSpace = "oklab" | "lab" | "rgb" | "hsv";

export type GradientStop = {
  readonly offset?: number;
  readonly color: ColorInput;
};

export type LinearGradient = {
  readonly type: "linear-gradient";
  readonly stops: readonly GradientStop[];
  /** Degrees clockwise: 0 points left-to-right, 90 top-to-bottom. */
  readonly angle: number;
  readonly space: InterpolationSpace;
};

/** A one-dimensional gradient wrapped clockwise around a rectangle's edge. */
export type PerimeterGradient = {
  readonly type: "perimeter-gradient";
  readonly stops: readonly GradientStop[];
  /** Rotation in terminal cells, starting at the top-left corner. */
  readonly offset: number;
  readonly space: InterpolationSpace;
};

export type AdaptiveColor = {
  readonly type: "adaptive-color";
  readonly light: ColorInput;
  readonly dark: ColorInput;
};

export type ProfileColor = {
  readonly type: "profile-color";
  readonly colors: Partial<Record<ColorProfile, ColorInput>>;
  readonly fallback: ColorInput;
};

export type Paint = ColorInput | LinearGradient | PerimeterGradient | AdaptiveColor | ProfileColor;

export type PaintContext = {
  readonly appearance?: TerminalAppearance;
  readonly profile?: ColorProfile;
  readonly palette?: readonly { r: number; g: number; b: number }[];
};

export const rgb = (red: number, green: number, blue: number, alpha = 255): RgbColor => ({
  model: "rgb",
  red: channel(red),
  green: channel(green),
  blue: channel(blue),
  alpha: channel(alpha),
});

export const ansi = (index: number): Color => ({
  model: "indexed",
  index: Math.max(0, Math.min(15, Math.round(index))),
  encoding: "ansi16",
});

export const ansi256 = (index: number): Color => ({
  model: "indexed",
  index: Math.max(0, Math.min(255, Math.round(index))),
  encoding: "ansi256",
});

const namedIndexes = {
  black: 0,
  red: 1,
  green: 2,
  yellow: 3,
  blue: 4,
  magenta: 5,
  cyan: 6,
  white: 7,
  blackBright: 8,
  gray: 8,
  grey: 8,
  redBright: 9,
  greenBright: 10,
  yellowBright: 11,
  blueBright: 12,
  magentaBright: 13,
  cyanBright: 14,
  whiteBright: 15,
} as const;

export type NamedColor = keyof typeof namedIndexes;
export const named = (color: NamedColor): Color => ansi(namedIndexes[color]);

export const adaptive = (light: ColorInput, dark: ColorInput): AdaptiveColor => ({
  type: "adaptive-color",
  light,
  dark,
});

export const perProfile = (
  colors: Partial<Record<ColorProfile, ColorInput>>,
  fallback: ColorInput,
): ProfileColor => ({ type: "profile-color", colors, fallback });

export const linearGradient = (
  stops: readonly (GradientStop | ColorInput)[],
  options: { angle?: number; space?: InterpolationSpace } = {},
): LinearGradient => {
  if (stops.length < 2) {
    throw new Error("A linear gradient requires at least two color stops");
  }

  return {
    type: "linear-gradient",
    stops: normalizeStops(stops.map((stop) => (isGradientStop(stop) ? stop : { color: stop }))),
    angle: options.angle ?? 0,
    space: options.space ?? "oklab",
  };
};

export const perimeterGradient = (
  stops: readonly ColorInput[],
  options: { offset?: number; space?: InterpolationSpace } = {},
): PerimeterGradient => {
  if (stops.length < 2) {
    throw new Error("A perimeter gradient requires at least two color stops");
  }

  return {
    type: "perimeter-gradient",
    stops: normalizeStops(stops.map((color) => ({ color }))),
    offset: Math.round(options.offset ?? 0),
    space: options.space ?? "lab",
  };
};

function normalizeStops(stops: readonly GradientStop[]): GradientStop[] {
  const output = stops.map((stop) => ({ ...stop }));
  output[0] = { ...output[0]!, offset: output[0]!.offset ?? 0 };
  output[output.length - 1] = {
    ...output.at(-1)!,
    offset: output.at(-1)!.offset ?? 1,
  };

  let anchor = 0;
  while (anchor < output.length - 1) {
    let next = anchor + 1;
    while (next < output.length && output[next]!.offset === undefined) next++;
    const start = output[anchor]!.offset!;
    const end = output[next]!.offset!;
    for (let index = anchor + 1; index < next; index++) {
      output[index] = {
        ...output[index]!,
        offset: start + ((end - start) * (index - anchor)) / (next - anchor),
      };
    }
    anchor = next;
  }

  return output.map((stop) => ({ ...stop, offset: Math.max(0, Math.min(1, stop.offset!)) }));
}

function isGradientStop(value: GradientStop | ColorInput): value is GradientStop {
  return typeof value === "object" && value !== null && "color" in value;
}

function channel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
