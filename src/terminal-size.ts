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

// Opened at most once per process: opening per call leaked a descriptor (and
// a stream) every time, and libuv reopens a tty handed to `tty.WriteStream`,
// so destroying the stream would not release ours. `null` records a failed
// open so it isn't retried.
let devTtyStream: (WriteStream & { _refreshSize?: () => void }) | null | undefined;

const devTty = (): TerminalSize | undefined => {
  try {
    if (devTtyStream === undefined) {
      devTtyStream = null;
      // O_EVTONLY is macOS-only and missing from the Node type definitions.
      const { O_EVTONLY: evtOnly } = constants as { O_EVTONLY?: number };
      const flags =
        isMacos && evtOnly !== undefined
          ? // eslint-disable-next-line no-bitwise
            evtOnly | constants.O_NONBLOCK
          : constants.O_NONBLOCK;

      devTtyStream = new WriteStream(openSync("/dev/tty", flags));
    }

    // The cached stream gets no SIGWINCH updates, so re-read the size; this is
    // what Node itself does for `process.stdout` on resize.
    devTtyStream?._refreshSize?.();
    const { columns, rows } = devTtyStream ?? {};

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
