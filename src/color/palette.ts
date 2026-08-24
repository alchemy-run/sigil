import type { Color, RgbColor } from "#/screen/cell.ts";

/** Canonical xterm-compatible palette used until a terminal reports its own. */
const canonicalChannels = [
  [0, 0, 0],
  [205, 0, 0],
  [0, 205, 0],
  [205, 205, 0],
  [0, 0, 238],
  [205, 0, 205],
  [0, 205, 205],
  [229, 229, 229],
  [127, 127, 127],
  [255, 0, 0],
  [0, 255, 0],
  [255, 255, 0],
  [92, 92, 255],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 255],
] as const;

export const canonicalAnsiPalette: readonly RgbColor[] = canonicalChannels.map(
  ([red, green, blue]) => ({ model: "rgb", red, green, blue, alpha: 255 }),
);

export function colorToRgb(
  color: Color,
  palette?: readonly { r: number; g: number; b: number }[],
): RgbColor {
  if (color.model === "rgb") return color;
  const custom = color.index < 16 ? palette?.[color.index] : undefined;
  if (custom) return { model: "rgb", red: custom.r, green: custom.g, blue: custom.b, alpha: 255 };
  if (color.index < 16) return canonicalAnsiPalette[color.index]!;
  if (color.index >= 232) {
    const value = 8 + (color.index - 232) * 10;
    return { model: "rgb", red: value, green: value, blue: value, alpha: 255 };
  }
  const index = color.index - 16;
  const levels = [0, 95, 135, 175, 215, 255];
  return {
    model: "rgb",
    red: levels[Math.floor(index / 36)]!,
    green: levels[Math.floor((index % 36) / 6)]!,
    blue: levels[index % 6]!,
    alpha: 255,
  };
}
