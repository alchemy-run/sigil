import { isFullwidthCodePoint } from "./east-asian-width.ts";
// ANSI-aware tokenizer: splits a string into grapheme clusters and ANSI
// codes, tracks active styles per character, and re-emits minimal escape
// sequences. This is the style model Ink's renderer is built on.
// Ported from `@alcalzone/ansi-tokenize` (MIT, AlCalzone).
import { BEL, C1_ST, ESC } from "./escapes.ts";
import { codes as sgrCodes, foreground, background, styles } from "./sgr.ts";

// Single-character introducer suffixes (`ESC [` = CSI, `ESC ]` = OSC).
const BACKSLASH = "\\";
const CSI = "[";
const OSC = "]";

// Char codes
const CC_BEL = BEL.charCodeAt(0);
const CC_ESC = ESC.charCodeAt(0);
const CC_BACKSLASH = BACKSLASH.charCodeAt(0);
const CC_CSI = CSI.charCodeAt(0);
const CC_OSC = OSC.charCodeAt(0);
const CC_C1_ST = C1_ST.charCodeAt(0);
const CC_0 = "0".charCodeAt(0);
const CC_9 = "9".charCodeAt(0);
const CC_SEMI = ";".charCodeAt(0);
const CC_M = "m".charCodeAt(0);

// Escape code points: \u001B and \u009B
const ESCAPES = new Set([CC_ESC, 0x9b]);

// OSC 8 hyperlink constants
const linkCodePrefix = `${ESC}${OSC}8;`;
const linkCodePrefixCharCodes = linkCodePrefix.split("").map((char) => char.charCodeAt(0));
const linkCodeSuffix = BEL;
const linkEndCode = `${ESC}${OSC}8;;${BEL}`;
const linkEndCodeST = `${ESC}${OSC}8;;${ESC}${BACKSLASH}`;
const linkEndCodeC1ST = `${ESC}${OSC}8;;${C1_ST}`;

/**
An ANSI code paired with the code that ends its effect.
*/
export type AnsiCode = {
  readonly code: string;
  readonly endCode: string;
};

export type AnsiToken = AnsiCode & {
  readonly type: "ansi";
};

export type ControlToken = {
  readonly type: "control";
  readonly code: string;
};

export type CharToken = {
  readonly type: "char";
  readonly value: string;
  readonly fullWidth: boolean;
};

export type Token = AnsiToken | ControlToken | CharToken;

export type StyledChar = CharToken & {
  readonly styles: AnsiCode[];
};

export const endCodesSet = new Set<string>();
const endCodesMap = new Map<string, string>();

for (const [start, end] of sgrCodes) {
  endCodesSet.add(foreground.ansi(end));
  endCodesMap.set(foreground.ansi(start), foreground.ansi(end));
}

export function getLinkStartCode(url: string, params?: Record<string, string>): string {
  const paramsString = params
    ? Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join(":")
    : "";
  return `${linkCodePrefix}${paramsString};${url}${linkCodeSuffix}`;
}

export function getEndCode(code: string): string {
  if (endCodesSet.has(code)) return code;
  if (endCodesMap.has(code)) return endCodesMap.get(code)!;

  // We have a few special cases to handle here:
  // Links:
  if (code.startsWith(linkCodePrefix)) {
    if (code.endsWith(`${ESC}${BACKSLASH}`)) return linkEndCodeST;
    if (code.endsWith(C1_ST)) return linkEndCodeC1ST;
    return linkEndCode; // BEL (\u0007)
  }

  code = code.slice(2);

  // 8-bit/24-bit colors:
  if (code.startsWith("38")) {
    return foreground.close;
  }

  if (code.startsWith("48")) {
    return background.close;
  }

  // Otherwise find the reset code in the SGR code map
  const endCode = sgrCodes.get(Number.parseInt(code, 10));
  if (endCode !== undefined) {
    return foreground.ansi(endCode);
  }

  return styles.reset.open;
}

export function ansiCodesToString(codes: readonly AnsiCode[]): string {
  // Deduplicate ANSI code strings before joining
  const deduplicated = new Set(codes.map((code) => code.code));
  return [...deduplicated].join("");
}

/**
Check if a code is an intensity code (bold or dim) — these share the end code
`22m` but can coexist.
*/
export function isIntensityCode(code: AnsiCode): boolean {
  return code.code === styles.bold.open || code.code === styles.dim.open;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function isFullwidthGrapheme(grapheme: string, baseCodePoint: number): boolean {
  if (isFullwidthCodePoint(baseCodePoint)) return true;
  // Variation Selector 16 forces emoji presentation (2 columns wide)
  if (grapheme.includes("\uFE0F")) return true;
  // Regional indicator pairs form flag emoji (2 columns wide)
  if (baseCodePoint >= 0x1f1e6 && baseCodePoint <= 0x1f1ff) return true;
  return false;
}

// HOT PATH: Use only basic string/char code operations for maximum performance
function parseLinkCode(string: string, offset: number): string | undefined {
  string = string.slice(offset);
  for (let index = 1; index < linkCodePrefixCharCodes.length; index++) {
    if (string.charCodeAt(index) !== linkCodePrefixCharCodes[index]) {
      return;
    }
  }

  // Find the semicolon that ends params
  const paramsEndIndex = string.indexOf(";", linkCodePrefix.length);
  if (paramsEndIndex === -1) return;

  // This is a link code (with or without the URL part). Find the end of it.
  const endIndex = findOscTerminatorIndex(string, paramsEndIndex + 1);
  if (endIndex === -1) return;

  return string.slice(0, endIndex + 1);
}

// HOT PATH: Generic fallback for non-link OSC sequences (window title, etc.)
function parseOscSequence(string: string, offset: number): string | undefined {
  string = string.slice(offset);
  // Find the OSC terminator (starting after "ESC ]")
  const endIndex = findOscTerminatorIndex(string, 2);
  if (endIndex === -1) return;
  return string.slice(0, endIndex + 1);
}

/**
Finds the index of the last character of the first OSC terminator at or after
`startIndex`. Recognizes BEL (\u0007), C1 ST (\u009C), and ESC+backslash.
Returns -1 if no terminator is found.
*/
function findOscTerminatorIndex(string: string, startIndex: number): number {
  for (let index = startIndex; index < string.length; index++) {
    const charCode = string.charCodeAt(index);
    if (charCode === CC_BEL) return index;
    if (charCode === CC_C1_ST) return index;
    if (
      charCode === CC_ESC &&
      index + 1 < string.length &&
      string.charCodeAt(index + 1) === CC_BACKSLASH
    ) {
      return index + 1;
    }
  }

  return -1;
}

/**
Scans through the given string and finds the index of the last character of an
SGR sequence like `\u001B[38;2;123;123;123m`. This assumes that the string has
been checked to start with `\u001B[`. Returns -1 if no valid SGR sequence is
found.
*/
function findSgrSequenceEndIndex(string: string): number {
  for (let index = 2; index < string.length; index++) {
    const charCode = string.charCodeAt(index);
    // m marks the end of the SGR sequence
    if (charCode === CC_M) return index;
    // Digits and semicolons are valid
    if (charCode === CC_SEMI) continue;
    if (charCode >= CC_0 && charCode <= CC_9) continue;
    // Everything else is invalid
    break;
  }

  return -1;
}

// HOT PATH: Use only basic string/char code operations for maximum performance
function parseSgrSequence(string: string, offset: number): string | undefined {
  string = string.slice(offset);
  const endIndex = findSgrSequenceEndIndex(string);
  if (endIndex === -1) return;
  return string.slice(0, endIndex + 1);
}

/**
Splits compound SGR sequences like `\u001B[1;3;31m` into individual components.
*/
function splitCompoundSgrSequences(code: string): string[] {
  if (!code.includes(";")) {
    // Not a compound code
    return [code];
  }

  const codeParts = code
    // Strip off the escape sequences \u001B[ and m
    .slice(2, -1)
    .split(";");

  const result: string[] = [];
  for (let index = 0; index < codeParts.length; index++) {
    const rawCode = codeParts[index]!;
    // Keep 8-bit and 24-bit color codes (containing multiple ";") together
    if (rawCode === "38" || rawCode === "48") {
      if (index + 2 < codeParts.length && codeParts[index + 1] === "5") {
        // 8-bit color, followed by another number
        result.push(codeParts.slice(index, index + 3).join(";"));
        index += 2;
        continue;
      } else if (index + 4 < codeParts.length && codeParts[index + 1] === "2") {
        // 24-bit color, followed by three numbers
        result.push(codeParts.slice(index, index + 5).join(";"));
        index += 4;
        continue;
      }
    }

    // Not a (valid) 8/24-bit color code, push as is
    result.push(rawCode);
  }

  return result.map((part) => `${ESC}[${part}m`);
}

export function tokenize(string: string, endChar = Number.POSITIVE_INFINITY): Token[] {
  const result: Token[] = [];
  let visible = 0;
  let codeEndIndex = 0;

  for (const { segment, index } of segmenter.segment(string)) {
    // Skip segments consumed as part of an ANSI sequence
    if (index < codeEndIndex) continue;

    const codePoint = segment.codePointAt(0)!;
    if (ESCAPES.has(codePoint)) {
      let code: string | undefined;
      // Peek the next code point to determine the type of ANSI sequence
      const nextCodePoint = string.codePointAt(index + 1);
      if (nextCodePoint === CC_OSC) {
        // ] = operating system commands
        code = parseLinkCode(string, index);
        if (code) {
          // OSC 8 hyperlinks are paired codes with an endCode
          result.push({
            type: "ansi",
            code,
            endCode: getEndCode(code),
          });
        } else {
          // Other OSC sequences (window title, etc.) are self-contained
          // control codes with no endCode.
          code = parseOscSequence(string, index);
          if (code) {
            result.push({
              type: "control",
              code,
            });
          }
        }
      } else if (nextCodePoint === CC_CSI) {
        // [ = control sequence introducer, like SGR sequences [...m
        code = parseSgrSequence(string, index);
        if (code) {
          // Split compound codes into individual tokens
          for (const individualCode of splitCompoundSgrSequences(code)) {
            result.push({
              type: "ansi",
              code: individualCode,
              endCode: getEndCode(individualCode),
            });
          }
        }
      }

      if (code) {
        codeEndIndex = index + code.length;
        continue;
      }
    }

    const fullWidth = isFullwidthGrapheme(segment, codePoint);
    result.push({
      type: "char",
      value: segment,
      fullWidth,
    });

    visible += fullWidth ? 2 : 1;
    if (visible >= endChar) {
      break;
    }
  }

  return result;
}

/**
Reduces the given array of ANSI codes to the minimum necessary to render with
the same style.
*/
export function reduceAnsiCodes(codes: readonly AnsiCode[]): AnsiCode[] {
  return reduceAnsiCodesIncremental([], codes);
}

/**
Like {@link reduceAnsiCodes}, but assumes that `codes` is already reduced.
Further reductions are only done for the items in `newCodes`.
*/
export function reduceAnsiCodesIncremental(
  codes: readonly AnsiCode[],
  newCodes: readonly AnsiCode[],
): AnsiCode[] {
  let result = [...codes];

  for (const code of newCodes) {
    if (code.code === styles.reset.open) {
      // Reset code, disable all codes
      result = [];
    } else if (endCodesSet.has(code.code)) {
      // This is an end code, disable all matching start codes
      result = result.filter((existing) => existing.endCode !== code.code);
    } else if (isIntensityCode(code)) {
      // Intensity codes (1m, 2m) can coexist (both end with 22m). Only add
      // if the exact same code is not already present.
      if (
        !result.some((existing) => existing.code === code.code && existing.endCode === code.endCode)
      ) {
        result.push(code);
      }
    } else {
      // This is a start code. Remove codes it "overrides" (same endCode),
      // then add it.
      result = result.filter((existing) => existing.endCode !== code.endCode);
      result.push(code);
    }
  }

  return result;
}

/**
Returns the combination of ANSI codes needed to undo the given ANSI codes.
*/
export function undoAnsiCodes(codes: readonly AnsiCode[]): AnsiCode[] {
  return reduceAnsiCodes(codes)
    .reverse()
    .map((code) => ({
      ...code,
      code: code.endCode,
    }));
}

/**
Returns the minimum amount of ANSI codes necessary to get from the compound
style `from` to `to`. Both are expected to be reduced.
*/
export function diffAnsiCodes(from: readonly AnsiCode[], to: readonly AnsiCode[]): AnsiCode[] {
  const endCodesInTo = new Set(to.map((code) => code.endCode));
  const startCodesInTo = new Set(to.map((code) => code.code));
  const startCodesInFrom = new Set(from.map((code) => code.code));

  return [
    // Disable all styles in `from` that are removed in `to`; keep the rest.
    ...undoAnsiCodes(
      from.filter((code) => {
        // Intensity codes (1m, 2m) can coexist (both end with 22m), so
        // check the start codes for those to not miss a reset.
        if (isIntensityCode(code)) {
          return !startCodesInTo.has(code.code);
        }

        return !endCodesInTo.has(code.endCode);
      }),
    ),
    // Add all styles in `to` that don't exist in `from`
    ...to.filter((code) => !startCodesInFrom.has(code.code)),
  ];
}

export function styledCharsFromTokens(tokens: readonly Token[]): StyledChar[] {
  let codes: AnsiCode[] = [];
  const result: StyledChar[] = [];

  for (const token of tokens) {
    if (token.type === "ansi") {
      codes = reduceAnsiCodesIncremental(codes, [token]);
    } else if (token.type === "char") {
      result.push({
        ...token,
        styles: [...codes],
      });
    }
  }

  return result;
}

export function styledCharsToString(chars: readonly StyledChar[]): string {
  let result = "";

  for (let index = 0; index < chars.length; index++) {
    const char = chars[index]!;

    if (index === 0) {
      result += ansiCodesToString(char.styles);
    } else {
      result += ansiCodesToString(diffAnsiCodes(chars[index - 1]!.styles, char.styles));
    }

    result += char.value;

    // Reset active styles at the end of the string
    if (index === chars.length - 1) {
      result += ansiCodesToString(diffAnsiCodes(char.styles, []));
    }
  }

  return result;
}
