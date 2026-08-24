import { ansi256ToAnsi, rgbToAnsi, rgbToAnsi256 } from "#/ansi/sgr.ts";
import type { ColorSupportLevel } from "#/capabilities/detect.ts";
import type { Color } from "#/screen/cell.ts";

/** The color model emitted by a terminal serializer. */
export type ColorProfile = "none" | "ansi16" | "ansi256" | "truecolor";

export function colorProfileFromLevel(level: ColorSupportLevel): ColorProfile {
  return (["none", "ansi16", "ansi256", "truecolor"] as const)[level];
}

/**
Quantizes a semantic color for an output profile. `undefined` means the
terminal default and is also the result for the no-color profile.
*/
export function quantizeColor(color: Color | undefined, profile: ColorProfile): Color | undefined {
  if (!color || profile === "none") {
    return undefined;
  }

  if (profile === "truecolor") {
    return color;
  }

  if (profile === "ansi256") {
    if (color.model === "indexed") {
      return color;
    }

    return {
      model: "indexed",
      index: rgbToAnsi256(color.red, color.green, color.blue),
      encoding: "ansi256",
    };
  }

  const ansiCode =
    color.model === "indexed"
      ? ansi256ToAnsi(color.index)
      : rgbToAnsi(color.red, color.green, color.blue);

  return { model: "indexed", index: ansiCodeToPaletteIndex(ansiCode), encoding: "ansi16" };
}

function ansiCodeToPaletteIndex(code: number): number {
  return code >= 90 ? code - 90 + 8 : code - 30;
}
