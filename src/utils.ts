import type { OutputStream } from "./stream.ts";
import terminalSize from "./terminal-size.ts";

const resolveDimension = (
  value: number | undefined,
  fallback: number | undefined,
  defaultValue: number,
): number => {
  if (value !== undefined && value > 0) {
    return value;
  }

  if (fallback !== undefined && fallback > 0) {
    return fallback;
  }

  return defaultValue;
};

/**
Get the effective terminal dimensions from the given stdout stream.

Falls back to `terminal-size` for columns in piped processes where `stdout.columns` is 0, and uses standard defaults (80×24) when dimensions cannot be determined.
*/
export const getWindowSize = (stdout: OutputStream): { columns: number; rows: number } => {
  // `stdout.columns`/`rows` can be 0 or undefined in non-TTY environments.
  const columns = stdout.columns ?? 0;
  const rows = stdout.rows ?? 0;

  if (columns && rows) {
    return { columns, rows };
  }

  const fallbackSize = terminalSize();

  return {
    columns: resolveDimension(columns, fallbackSize.columns, 80),
    rows: resolveDimension(rows, fallbackSize.rows, 24),
  };
};
