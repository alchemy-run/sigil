// Standalone ANSI toolkit — styling, measurement, and manipulation of
// terminal strings. Importable without the React renderer via
// `@alchemy.run/sigil/ansi`.

// Styling
export { chalk } from "#/ansi/chalk.ts";
export { supportsColor } from "#/ansi/chalk.ts";
export { hyperlink } from "#/ansi/hyperlink.ts";
export * from "#/ansi/sgr.ts";

// Escape sequences (raw building blocks + named sequences)
export * from "#/ansi/escapes.ts";
export { cliCursor } from "#/ansi/cursor.ts";

// Measurement
export { stringWidth, widestLine } from "#/ansi/string-width.ts";
export * from "#/ansi/east-asian-width.ts";

// String manipulation
export { stripAnsi } from "#/ansi/strip.ts";
export { sliceAnsi } from "#/ansi/slice.ts";
export { cliTruncate as truncateAnsi } from "#/ansi/truncate.ts";
export { wrapAnsi } from "#/ansi/wrap.ts";

// Tokenizer: style-aware parsing and minimal re-emission
export * from "#/ansi/tokenize.ts";
