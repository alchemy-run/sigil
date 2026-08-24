import {
  getEndCode,
  styledCharsToString,
  type AnsiCode,
  type StyledChar,
} from "#/ansi/tokenize.ts";
import { cellAttributes, type Cell, type Color, type Hyperlink } from "#/screen/cell.ts";
import { quantizeColor, type ColorProfile } from "#/screen/color-profile.ts";
import type { Line, Screen } from "#/screen/screen.ts";

const ESC = "\u001B";
const BEL = "\u0007";

export type SerializeOptions = {
  readonly colorProfile: ColorProfile;
  readonly trimEnd?: boolean;
  readonly styles?: boolean;
};

/** Serializes one structured cell run with minimal style transitions. */
export function serializeLine(line: Line, options: SerializeOptions): string {
  const characters = line.map((cell) =>
    styledCharFromCell(cell, options.colorProfile, options.styles ?? true),
  );
  const output = styledCharsToString(characters);
  return options.trimEnd === false ? output : output.trimEnd();
}

export function serializeScreen(screen: Screen, options: SerializeOptions): string {
  return screen
    .toRows()
    .map((line) => serializeLine(line, options))
    .join("\n");
}

/** Converts a semantic cell to the canonical ANSI compatibility style state. */
export function styledCharFromCell(cell: Cell, profile: ColorProfile, styles = true): StyledChar {
  return {
    type: "char",
    value: cell.grapheme,
    fullWidth: cell.width > 1,
    styles: styles ? ansiCodesFromCell(cell, profile) : [],
  };
}

function ansiCodesFromCell(cell: Cell, profile: ColorProfile): AnsiCode[] {
  const result: AnsiCode[] = [];
  const { style } = cell;

  if (cell.hyperlink) {
    result.push(codePair(hyperlinkStart(cell.hyperlink)));
  }

  // This order mirrors the nesting produced by the Ink-compatible Text API,
  // while remaining deterministic for cells produced by custom drawables.
  addAttribute(result, style.attributes, cellAttributes.inverse, 7);
  addAttribute(result, style.attributes, cellAttributes.hidden, 8);
  addAttribute(result, style.attributes, cellAttributes.strikethrough, 9);

  if (style.underline !== "none") {
    const variant = {
      single: "4",
      double: "4:2",
      curly: "4:3",
      dotted: "4:4",
      dashed: "4:5",
    }[style.underline];
    result.push(codePair(`${ESC}[${variant}m`));
  }

  addAttribute(result, style.attributes, cellAttributes.italic, 3);
  addAttribute(result, style.attributes, cellAttributes.bold, 1);
  addAttribute(result, style.attributes, cellAttributes.rapidBlink, 6);
  addAttribute(result, style.attributes, cellAttributes.blink, 5);

  const background = quantizeColor(style.background, profile);
  if (background) {
    result.push(codePair(colorCode(background, "background")));
  }

  const foreground = quantizeColor(style.foreground, profile);
  if (foreground) {
    result.push(codePair(colorCode(foreground, "foreground")));
  }

  addAttribute(result, style.attributes, cellAttributes.faint, 2);

  const underlineColor = quantizeColor(style.underlineColor, profile);
  if (underlineColor) {
    result.push(codePair(colorCode(underlineColor, "underline")));
  }

  return result;
}

function addAttribute(
  result: AnsiCode[],
  attributes: number,
  attribute: number,
  sgr: number,
): void {
  if (Math.floor(attributes / attribute) % 2 === 1) {
    result.push(codePair(`${ESC}[${sgr}m`));
  }
}

function colorCode(color: Color, channel: "foreground" | "background" | "underline"): string {
  const prefix = { foreground: 38, background: 48, underline: 58 }[channel];

  if (color.model === "rgb") {
    return `${ESC}[${prefix};2;${color.red};${color.green};${color.blue}m`;
  }

  if (channel === "underline" || color.index >= 16 || color.encoding === "ansi256") {
    return `${ESC}[${prefix};5;${color.index}m`;
  }

  const basic = color.index < 8 ? color.index : color.index - 8 + 60;
  const channelOffset = channel === "background" ? 40 : 30;
  return `${ESC}[${channelOffset + basic}m`;
}

function hyperlinkStart(hyperlink: Hyperlink): string {
  return `${ESC}]8;${hyperlink.parameters ?? ""};${hyperlink.url}${BEL}`;
}

function codePair(code: string): AnsiCode {
  return { code, endCode: getEndCode(code) };
}
