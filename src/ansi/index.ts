// Standalone ANSI toolkit — styling, measurement, and manipulation of
// terminal strings. Importable without the React renderer via
// `@alchemy.run/sigil/ansi`.

// Styling
export { default as chalk } from "./chalk.ts";
export { default as supportsColor } from "./supports-color.ts";
export * from "./sgr.ts";

// Escape sequences (raw building blocks + named sequences)
export { default as ansiEscapes } from "./escapes.ts";
export * from "./escapes.ts";
export { default as cliCursor } from "./cursor.ts";

// Measurement
export { default as stringWidth } from "./string-width.ts";
export { default as widestLine } from "./widest-line.ts";
export * from "./east-asian-width.ts";

// String manipulation
export { default as stripAnsi, ansiRegex } from "./strip.ts";
export { default as sliceAnsi } from "./slice.ts";
export { default as truncateAnsi } from "./truncate.ts";
export { default as wrapAnsi } from "./wrap.ts";

// Tokenizer: style-aware parsing and minimal re-emission
export * from "./tokenize.ts";
