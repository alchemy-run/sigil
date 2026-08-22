// Derived from `terminal-size` (MIT, Sindre Sorhus), reduced for Ink's usage as a
// fallback when the stdout stream reports no dimensions. Unlike the original,
// this never shells out to `tput`/`resize` — it checks the process streams,
// the COLUMNS/LINES environment variables and /dev/tty, then falls back to
// the standard 80×24.
import { openSync, constants } from "node:fs";
import { WriteStream } from "node:tty";

import { isMacos } from "#/env.ts";

type TerminalSize = {
  columns: number;
  rows: number;
};

const create = (columns: number | string, rows: number | string): TerminalSize => ({
  columns: Number.parseInt(String(columns), 10),
  rows: Number.parseInt(String(rows), 10),
});

const devTty = (): TerminalSize | undefined => {
  try {
    // O_EVTONLY is macOS-only and missing from the Node type definitions.
    const { O_EVTONLY: evtOnly } = constants as { O_EVTONLY?: number };
    const flags =
      isMacos && evtOnly !== undefined
        ? // eslint-disable-next-line no-bitwise
          evtOnly | constants.O_NONBLOCK
        : constants.O_NONBLOCK;

    const { columns, rows } = new WriteStream(openSync("/dev/tty", flags));

    if (columns && rows) {
      return { columns, rows };
    }
  } catch {}

  return;
};

export const terminalSize = (): TerminalSize => {
  const { env, stdout, stderr } = process;

  if (stdout?.columns && stdout?.rows) {
    return create(stdout.columns, stdout.rows);
  }

  if (stderr?.columns && stderr?.rows) {
    return create(stderr.columns, stderr.rows);
  }

  // These values are static, so not the first choice.
  if (env["COLUMNS"] && env["LINES"]) {
    return create(env["COLUMNS"], env["LINES"]);
  }

  return devTty() ?? { columns: 80, rows: 24 };
};
