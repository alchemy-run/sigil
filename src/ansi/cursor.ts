import { cursorHide, cursorShow } from "#/ansi/escapes.ts";
// Derived from `cli-cursor` + `restore-cursor` (MIT, Sindre Sorhus),
// collapsed into one module. Restores the cursor on process exit once
// `hide()` has been called, like `restore-cursor` did.
import { signalExit } from "#/signal-exit.ts";

type CursorStream = {
  isTTY?: boolean;
  write: (data: string) => unknown;
};

let restoreRegistered = false;

const registerRestore = (): void => {
  if (restoreRegistered) {
    return;
  }

  restoreRegistered = true;

  signalExit(
    () => {
      process.stderr.write(cursorShow);
    },
    { alwaysLast: true },
  );
};

export const cliCursor = {
  show(writableStream: CursorStream = process.stderr): void {
    if (!writableStream.isTTY) {
      return;
    }

    writableStream.write(cursorShow);
  },

  hide(writableStream: CursorStream = process.stderr): void {
    if (!writableStream.isTTY) {
      return;
    }

    registerRestore();
    writableStream.write(cursorHide);
  },
};
