import { hasAnsiControlCharacters, tokenizeAnsi } from "#/ansi-tokenizer.ts";

const sgrParametersRegex = /^[\d:;]*$/;
// ESC, CAN, SUB or a C1 control inside the parameters or URI ends the OSC in
// the terminal, so whatever follows would run as its own escape sequence.
const hyperlinkRegex =
  /^(?:\u001B\]|\u009D)8;[^\u0018\u001A\u001B\u0080-\u009F]*(?:\u0007|\u001B\\|\u009C)$/u;
// Terminals print nothing for C0 controls and DEL, so strip them; tabs and
// newlines carry layout. ESC and C1 never reach text tokens, the tokenizer owns them.
const controlCharactersRegex = /(?![\t\n])\p{Control}/gu;
const leadingMarksRegex = /^\p{Mark}+/u;

// Strip ANSI escape sequences that would conflict with Ink's layout.
// Preserved: SGR sequences (colors, bold, etc. - end with 'm') and OSC 8
// hyperlinks (ESC ] or C1 OSC) whose payload cannot end the sequence early.
// Stripped: cursor movement, screen clearing, and other control sequences.
// Combining marks share their base character's cell, so SGR sequences are
// deferred until after the marks instead of splitting them from their base.
export const sanitizeAnsi = (text: string): string => {
  if (!hasAnsiControlCharacters(text)) {
    return text.replaceAll(controlCharactersRegex, "");
  }

  let output = "";
  let pendingStyles = "";

  for (const token of tokenizeAnsi(text)) {
    if (token.type === "text") {
      const value = token.value.replaceAll(controlCharactersRegex, "");
      const marks = leadingMarksRegex.exec(value)?.[0] ?? "";
      output += marks;

      if (value.length > marks.length) {
        output += pendingStyles + value.slice(marks.length);
        pendingStyles = "";
      }

      continue;
    }

    if (token.type === "osc") {
      if (hyperlinkRegex.test(token.value)) {
        output += pendingStyles + token.value;
        pendingStyles = "";
      }

      continue;
    }

    if (
      token.type === "csi" &&
      token.finalCharacter === "m" &&
      token.intermediateString === "" &&
      sgrParametersRegex.test(token.parameterString)
    ) {
      pendingStyles += token.value;
    }
  }

  return output + pendingStyles;
};
