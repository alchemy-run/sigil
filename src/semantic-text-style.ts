import { hexToRgb } from "#/ansi/sgr.ts";
import type { Paint } from "#/color/paint.ts";
import { cellAttributes, type CellStyle, type Color } from "#/screen/cell.ts";

export type SemanticTextStyle = {
  readonly foreground?: Paint;
  readonly background?: Paint;
  readonly resetForeground?: boolean;
  readonly resetBackground?: boolean;
  readonly underline?: CellStyle["underline"];
  readonly attributes: number;
};

export const emptySemanticTextStyle: SemanticTextStyle = {
  attributes: cellAttributes.none,
};

const namedColors: Record<string, number> = {
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
};

const rgbPattern = /^rgb\(\s?(\d+),\s?(\d+),\s?(\d+)\s?\)$/;
const ansi256Pattern = /^ansi256\(\s?(\d+)\s?\)$/;

export function parseSemanticColor(value: string | Color | undefined): Color | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value !== "string") return value;

  const named = namedColors[value];
  if (named !== undefined) {
    return { model: "indexed", index: named, encoding: "ansi16" };
  }

  if (value.startsWith("#")) {
    const [red, green, blue] = hexToRgb(value);
    return { model: "rgb", red, green, blue, alpha: 255 };
  }

  const rgb = rgbPattern.exec(value);
  if (rgb) {
    return {
      model: "rgb",
      red: Number(rgb[1]),
      green: Number(rgb[2]),
      blue: Number(rgb[3]),
      alpha: 255,
    };
  }

  const ansi256 = ansi256Pattern.exec(value);
  if (ansi256) {
    return { model: "indexed", index: Number(ansi256[1]), encoding: "ansi256" };
  }

  return undefined;
}

export function mergeSemanticTextStyles(
  parent: SemanticTextStyle,
  child: SemanticTextStyle | undefined,
): SemanticTextStyle {
  if (!child) {
    return parent;
  }

  // Attribute flags are intentionally additive across nested Text nodes.
  // eslint-disable-next-line no-bitwise
  const attributes = parent.attributes | child.attributes;
  const foreground = child.resetForeground ? undefined : (child.foreground ?? parent.foreground);
  const background = child.resetBackground ? undefined : (child.background ?? parent.background);
  return {
    ...(foreground ? { foreground } : {}),
    ...(background ? { background } : {}),
    ...(child.resetForeground ? { resetForeground: true } : {}),
    ...(child.resetBackground ? { resetBackground: true } : {}),
    ...((child.underline ?? parent.underline)
      ? { underline: child.underline ?? parent.underline }
      : {}),
    attributes,
  };
}

export function semanticTextStyleToCellStyle(style: SemanticTextStyle): CellStyle {
  const foreground = solidColor(style.foreground);
  const background = solidColor(style.background);
  return {
    ...(foreground ? { foreground } : {}),
    ...(background ? { background } : {}),
    underline: style.underline ?? "none",
    attributes: style.attributes,
  };
}

function solidColor(paint: Paint | undefined): Color | undefined {
  if (!paint) return undefined;
  if (typeof paint === "string") return parseSemanticColor(paint);
  return "model" in paint ? paint : undefined;
}
