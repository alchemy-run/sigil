import { tokenizeAnsi } from "#/ansi-tokenizer.ts";
import { isFullwidthGrapheme } from "#/ansi/east-asian-width.ts";
// ANSI-aware style tokenizer: splits a string into grapheme clusters and
// ANSI codes, tracks active styles per character, and re-emits minimal
// escape sequences. This is the style model Ink's renderer is built on.
// Style semantics ported from `@alcalzone/ansi-tokenize` (MIT, AlCalzone);
// escape recognition delegates to the shared ECMA-48 grammar in
// `src/ansi-tokenizer.ts` (also behind sanitize-ansi), and grapheme widths
// come from `east-asian-width.ts` — one grammar, one width table.
import { BEL, C1_ST, ESC } from "#/ansi/escapes.ts";
import { codes as sgrCodes, foreground, background, styles } from "#/ansi/sgr.ts";

// Single-character introducer suffixes (`ESC [` = CSI, `ESC ]` = OSC).
const BACKSLASH = "\\";
const CSI = "[";
const OSC = "]";

// OSC 8 hyperlink constants
const linkCodePrefix = `${ESC}${OSC}8;`;
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

  // Extended underline color (T.416) closes with 59m; not in the SGR map.
  if (code.startsWith("58")) {
    return `${ESC}[59m`;
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

// SGR parameters: digits separated by `;` or `:` (ITU T.416 colon form).
const SGR_PARAMETERS_RE = /^[\d;:]*$/;

const c1LinkCodePrefix = "\u009D8;";

export function tokenize(string: string, endChar = Number.POSITIVE_INFINITY): Token[] {
  const result: Token[] = [];
  let visible = 0;

  outer: for (const ansiToken of tokenizeAnsi(string)) {
    if (ansiToken.type === "text") {
      for (const { segment } of segmenter.segment(ansiToken.value)) {
        const fullWidth = isFullwidthGrapheme(segment, segment.codePointAt(0)!);
        result.push({
          type: "char",
          value: segment,
          fullWidth,
        });

        visible += fullWidth ? 2 : 1;
        if (visible >= endChar) {
          break outer;
        }
      }

      continue;
    }

    if (ansiToken.type === "csi") {
      // SGR sequences carry style state; C1 introducers are normalized to the
      // 7-bit form so downstream comparisons see a single representation.
      if (
        ansiToken.finalCharacter === "m" &&
        ansiToken.intermediateString === "" &&
        SGR_PARAMETERS_RE.test(ansiToken.parameterString)
      ) {
        // Split compound codes into individual tokens
        const code = `${ESC}${CSI}${ansiToken.parameterString}m`;
        for (const individualCode of splitCompoundSgrSequences(code)) {
          result.push({
            type: "ansi",
            code: individualCode,
            endCode: getEndCode(individualCode),
          });
        }
      } else {
        result.push({
          type: "control",
          code: ansiToken.value,
        });
      }

      continue;
    }

    if (ansiToken.type === "osc") {
      // OSC 8 hyperlinks are paired codes with an endCode; C1 introducers are
      // normalized to the 7-bit form. Other OSC sequences (window title,
      // etc.) are self-contained control codes with no endCode.
      const { value } = ansiToken;
      const prefix = value.startsWith(linkCodePrefix)
        ? linkCodePrefix
        : value.startsWith(c1LinkCodePrefix)
          ? c1LinkCodePrefix
          : undefined;

      if (prefix !== undefined && value.includes(";", prefix.length)) {
        const code =
          prefix === linkCodePrefix ? value : `${linkCodePrefix}${value.slice(prefix.length)}`;
        result.push({
          type: "ansi",
          code,
          endCode: getEndCode(code),
        });
      } else {
        result.push({
          type: "control",
          code: value,
        });
      }

      continue;
    }

    // Everything else the grammar recognizes (ESC sequences, DCS/PM/APC/SOS
    // control strings, stray ST or C1 bytes, malformed tails) is a zero-width
    // control unit, preserved verbatim.
    result.push({
      type: "control",
      code: ansiToken.value,
    });
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
    .toReversed()
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
