import { stringWidth } from "#/ansi/string-width.ts";
import {
  type AnsiCode,
  type StyledChar,
  styledCharsFromTokens,
  tokenize,
} from "#/ansi/tokenize.ts";
import {
  cellAttributes,
  createCell,
  type Cell,
  type CellStyle,
  type Color,
  type Hyperlink,
  type UnderlineStyle,
} from "#/screen/cell.ts";

const ESC = "\u001B";
const BEL = "\u0007";
const C1_ST = "\u009C";
const LINK_PREFIX = `${ESC}]8;`;

type ParsedStyle = {
  foreground?: Color;
  background?: Color;
  underlineColor?: Color;
  underline: UnderlineStyle;
  attributes: number;
  hyperlink?: Hyperlink;
};

/** Converts the renderer's canonical ANSI state into backend-neutral cells. */
export function cellsFromAnsi(text: string): Cell[] {
  return styledCharsFromTokens(tokenize(text)).map((character) => cellFromStyledChar(character));
}

export function cellFromStyledChar(
  character: StyledChar,
  width = stringWidth(character.value),
): Cell {
  const parsed = parseStyles(character.styles);
  const style: CellStyle = {
    ...(parsed.foreground ? { foreground: parsed.foreground } : {}),
    ...(parsed.background ? { background: parsed.background } : {}),
    ...(parsed.underlineColor ? { underlineColor: parsed.underlineColor } : {}),
    underline: parsed.underline,
    attributes: parsed.attributes,
  };

  return createCell(character.value, Math.max(1, width), style, parsed.hyperlink);
}

function parseStyles(codes: readonly AnsiCode[]): ParsedStyle {
  let foreground: Color | undefined;
  let background: Color | undefined;
  let underlineColor: Color | undefined;
  let underline: UnderlineStyle = "none";
  let attributes = cellAttributes.none;
  let hyperlink: Hyperlink | undefined;

  for (const { code } of codes) {
    if (code.startsWith(LINK_PREFIX)) {
      hyperlink = parseHyperlink(code);
      continue;
    }

    if (!code.startsWith(`${ESC}[`) || !code.endsWith("m")) {
      continue;
    }

    const parameters = code.slice(2, -1);
    const primary = Number.parseInt(parameters, 10);

    if (primary >= 30 && primary <= 37) {
      foreground = { model: "indexed", index: primary - 30, encoding: "ansi16" };
    } else if (primary >= 90 && primary <= 97) {
      foreground = { model: "indexed", index: primary - 90 + 8, encoding: "ansi16" };
    } else if (primary >= 40 && primary <= 47) {
      background = { model: "indexed", index: primary - 40, encoding: "ansi16" };
    } else if (primary >= 100 && primary <= 107) {
      background = { model: "indexed", index: primary - 100 + 8, encoding: "ansi16" };
    } else if (primary === 38) {
      foreground = parseExtendedColor(parameters);
    } else if (primary === 48) {
      background = parseExtendedColor(parameters);
    } else if (primary === 58) {
      underlineColor = parseExtendedColor(parameters);
    } else if (primary === 1) {
      attributes += cellAttributes.bold;
    } else if (primary === 2) {
      attributes += cellAttributes.faint;
    } else if (primary === 3) {
      attributes += cellAttributes.italic;
    } else if (primary === 5) {
      attributes += cellAttributes.blink;
    } else if (primary === 6) {
      attributes += cellAttributes.rapidBlink;
    } else if (primary === 7) {
      attributes += cellAttributes.inverse;
    } else if (primary === 8) {
      attributes += cellAttributes.hidden;
    } else if (primary === 9) {
      attributes += cellAttributes.strikethrough;
    } else if (primary === 4) {
      underline = parseUnderline(parameters);
    }
  }

  return {
    ...(foreground ? { foreground } : {}),
    ...(background ? { background } : {}),
    ...(underlineColor ? { underlineColor } : {}),
    underline,
    attributes,
    ...(hyperlink ? { hyperlink } : {}),
  };
}

function parseExtendedColor(parameters: string): Color | undefined {
  const parts = parameters.split(parameters.includes(":") ? ":" : ";");
  const model = parts[1];

  if (model === "5") {
    const index = Number(parts[2]);
    return Number.isInteger(index) && index >= 0 && index <= 255
      ? { model: "indexed", index, encoding: "ansi256" }
      : undefined;
  }

  if (model !== "2") {
    return undefined;
  }

  const channels = parts.slice(-3).map(Number);
  if (channels.length !== 3 || channels.some((channel) => !isByte(channel))) {
    return undefined;
  }

  return {
    model: "rgb",
    red: channels[0]!,
    green: channels[1]!,
    blue: channels[2]!,
    alpha: 255,
  };
}

function parseUnderline(parameters: string): UnderlineStyle {
  const variant = parameters.includes(":") ? Number(parameters.split(":").at(-1)) : 1;
  return (
    (
      {
        0: "none",
        1: "single",
        2: "double",
        3: "curly",
        4: "dotted",
        5: "dashed",
      } as const
    )[variant] ?? "single"
  );
}

function parseHyperlink(code: string): Hyperlink | undefined {
  let body = code.slice(LINK_PREFIX.length);
  if (body.endsWith(`${ESC}\\`)) {
    body = body.slice(0, -2);
  } else if (body.endsWith(BEL) || body.endsWith(C1_ST)) {
    body = body.slice(0, -1);
  }

  const separator = body.indexOf(";");
  if (separator < 0) {
    return undefined;
  }

  const parameters = body.slice(0, separator);
  const url = body.slice(separator + 1);
  return parameters ? { url, parameters } : { url };
}

function isByte(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}
