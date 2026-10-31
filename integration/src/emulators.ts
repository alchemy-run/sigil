// Real terminal emulator engines behind one interface: Ghostty's VT core
// (compiled to WebAssembly) and xterm.js (headless). Apps under test talk to
// an actual emulator implementation — queries get genuine answers, wrapping
// and styling behave like a real terminal.
//
// Both engines are optional peer dependencies loaded on demand, so the main
// package stays lean for non-testing consumers.

export type EmulatorName = "ghostty" | "xterm";

export type EmulatorCell = {
  text: string;
  hyperlink: string | undefined;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
  dim: boolean;
};

export type Emulator = {
  readonly name: EmulatorName;

  /**
	Feeds application output into the emulator.
	*/
  feed: (data: Uint8Array | string) => void;

  /**
	The emulator's own responses to queries (device attributes, colors, …),
	to be written back to the application.
	*/
  onResponse: (handler: (data: string) => void) => void;

  resize: (columns: number, rows: number) => void;

  /**
	The visible screen as right-trimmed rows.
	*/
  lines: () => string[];

  cellAt: (x: number, y: number) => EmulatorCell | undefined;

  cursor: () => { x: number; y: number };

  /**
	Flips the emulated OS color scheme (Ghostty only) — drives real color
	scheme reports into the application when it enabled mode 2031.
	*/
  setColorScheme?: (scheme: "dark" | "light") => void;

  dispose: () => void;
};

export type EmulatorOptions = {
  columns: number;
  rows: number;
  colorScheme: "dark" | "light";
};

const missingEngine = (pkg: string, cause: unknown): Error =>
  new Error(
    `The "${pkg}" package is required for this emulator backend. ` +
      `Install it as a dev dependency: pnpm add -D ${pkg}`,
    { cause },
  );

const createGhosttyEmulator = async ({
  columns,
  rows,
  colorScheme,
}: EmulatorOptions): Promise<Emulator> => {
  const { createGhosttyTerminal } = await import("@slopus/ghostty-wasm/node").catch((error) => {
    throw missingEngine("@slopus/ghostty-wasm", error);
  });

  const terminal = await createGhosttyTerminal({ cols: columns, rows, colorScheme });
  const decoder = new TextDecoder();

  return {
    name: "ghostty",
    feed: (data) => {
      terminal.write(data);
    },
    onResponse: (handler) => {
      terminal.onPtyWrite((data) => {
        handler(decoder.decode(data));
      });
    },
    resize: (nextColumns, nextRows) => {
      terminal.resize(nextColumns, nextRows);
    },
    lines: () =>
      terminal.snapshot().rows.map((row) =>
        row.cells
          .map((cell) => cell.text)
          .join("")
          .trimEnd(),
      ),
    cellAt: (x, y) => {
      const row = terminal.snapshot().rows[y];
      const cell = row?.cells.find((candidate) => candidate.x === x);
      if (!cell) {
        return undefined;
      }

      return {
        text: cell.text,
        hyperlink: cell.hyperlink ?? undefined,
        bold: cell.style.bold,
        italic: cell.style.italic,
        underline: cell.style.underline !== "none",
        inverse: cell.style.inverse,
        dim: cell.style.dim,
      };
    },
    cursor: () => {
      const cursor = terminal.snapshot().cursor;
      return { x: cursor?.x ?? 0, y: cursor?.y ?? 0 };
    },
    setColorScheme: (scheme) => {
      terminal.setColorScheme(scheme);
    },
    dispose: () => {
      terminal.dispose();
    },
  };
};

const createXtermEmulator = async ({ columns, rows }: EmulatorOptions): Promise<Emulator> => {
  const xterm = await import("@xterm/headless").catch((error) => {
    throw missingEngine("@xterm/headless", error);
  });
  // The package ships CJS; interop may nest the exports under `default`.
  const TerminalConstructor = xterm.Terminal ?? xterm.default.Terminal;

  const terminal = new TerminalConstructor({ cols: columns, rows, allowProposedApi: true });

  // Unicode 11 widths: without this, emoji measure 1 cell while Sigil lays
  // them out as 2, misaligning everything to their right.
  const unicode = (await import("@xterm/addon-unicode11").catch(() => undefined)) as
    | {
        Unicode11Addon?: new () => { activate: (terminal: unknown) => void; dispose: () => void };
        default?: {
          Unicode11Addon?: new () => { activate: (terminal: unknown) => void; dispose: () => void };
        };
      }
    | undefined;
  const Unicode11 = unicode?.Unicode11Addon ?? unicode?.default?.Unicode11Addon;
  if (Unicode11) {
    terminal.loadAddon(new Unicode11());
    terminal.unicode.activeVersion = "11";
  }

  return {
    name: "xterm",
    feed: (data) => {
      terminal.write(data);
    },
    onResponse: (handler) => {
      terminal.onData(handler);
    },
    resize: (nextColumns, nextRows) => {
      terminal.resize(nextColumns, nextRows);
    },
    lines: () => {
      const buffer = terminal.buffer.active;
      const lines: string[] = [];
      for (let y = 0; y < terminal.rows; y++) {
        lines.push(
          buffer
            .getLine(buffer.baseY + y)
            ?.translateToString(true)
            .trimEnd() ?? "",
        );
      }

      return lines;
    },
    cellAt: (x, y) => {
      const buffer = terminal.buffer.active;
      const cell = buffer.getLine(buffer.baseY + y)?.getCell(x);
      if (!cell) {
        return undefined;
      }

      return {
        text: cell.getChars(),
        hyperlink: undefined,
        bold: cell.isBold() !== 0,
        italic: cell.isItalic() !== 0,
        underline: cell.isUnderline() !== 0,
        inverse: cell.isInverse() !== 0,
        dim: cell.isDim() !== 0,
      };
    },
    cursor: () => ({ x: terminal.buffer.active.cursorX, y: terminal.buffer.active.cursorY }),
    dispose: () => {
      terminal.dispose();
    },
  };
};

export const createEmulator = (name: EmulatorName, options: EmulatorOptions): Promise<Emulator> =>
  name === "ghostty" ? createGhosttyEmulator(options) : createXtermEmulator(options);
