import { cliCursor } from "#/ansi/cursor.ts";
import { ansiEscapes } from "#/ansi/escapes.ts";
import {
  buildCursorOnlySequence,
  buildCursorSuffix,
  buildReturnToBottomPrefix,
  cursorPositionChanged,
  type CursorPosition,
} from "#/cursor-position.ts";
import { cellAttributes, cellsEqual, type Cell } from "#/screen/cell.ts";
import type { ColorProfile } from "#/screen/color-profile.ts";
import type { Line, Screen } from "#/screen/screen.ts";
import { serializeLine, serializeScreen } from "#/screen/serialize.ts";

type Write = (data: string) => boolean;

/** Presents structured frames in an inline terminal region. */
export class ScreenPresenter {
  #screen: Screen | undefined;
  #lineCount = 0;
  #cursor: CursorPosition | undefined;
  #cursorWasShown = false;
  #fullscreen = false;
  #hidden = false;
  readonly #write: Write;
  readonly #stream: NodeJS.WritableStream;

  constructor(write: Write, stream: NodeJS.WritableStream) {
    this.#write = write;
    this.#stream = stream;
  }

  present(
    screen: Screen,
    options: {
      readonly colorProfile: ColorProfile;
      readonly cursor?: CursorPosition;
      readonly fullscreen?: boolean;
      readonly forceRewrite?: boolean;
    },
  ): boolean {
    if (!this.#hidden) {
      cliCursor.hide(this.#stream);
      this.#hidden = true;
    }

    const previousScreen = this.#screen;
    const sameScreen = previousScreen !== undefined && screensEqual(previousScreen, screen);
    const cursorChanged = cursorPositionChanged(options.cursor, this.#cursor);
    const fullscreen = options.fullscreen ?? false;
    const presentationModeChanged = this.#fullscreen !== fullscreen;
    if (!options.forceRewrite && sameScreen && !cursorChanged && !presentationModeChanged) {
      return false;
    }

    if (!options.forceRewrite && sameScreen && !presentationModeChanged) {
      this.#write(
        buildCursorOnlySequence({
          cursorWasShown: this.#cursorWasShown,
          previousLineCount: this.#lineCount,
          previousCursorPosition: this.#cursor,
          cursorPosition: options.cursor,
        }),
      );
      this.#remember(screen, options.cursor, options.fullscreen ?? false);
      return true;
    }

    const canRewriteSuffix =
      !options.forceRewrite &&
      previousScreen !== undefined &&
      previousScreen.width === screen.width &&
      this.#fullscreen === fullscreen;
    const firstChangedRow = canRewriteSuffix
      ? findFirstChangedRow(previousScreen, screen)
      : undefined;
    const serializeOptions = {
      colorProfile: options.colorProfile,
      styles: options.colorProfile !== "none",
    } as const;

    if (firstChangedRow !== undefined) {
      const eraseCount = this.#lineCount - firstChangedRow;
      const body = screen
        .toRows()
        .slice(firstChangedRow)
        .map((line) => serializeLine(line, serializeOptions))
        .join("\n");
      const output = fullscreen || body === "" ? body : `${body}\n`;
      this.#write(
        buildReturnToBottomPrefix(this.#cursorWasShown, this.#lineCount, this.#cursor) +
          ansiEscapes.eraseLines(eraseCount) +
          output +
          buildCursorSuffix(screen.height - (fullscreen ? 1 : 0), options.cursor),
      );
    } else {
      const body = serializeScreen(screen, serializeOptions);
      const output = fullscreen ? body : `${body}\n`;
      this.#write(
        buildReturnToBottomPrefix(this.#cursorWasShown, this.#lineCount, this.#cursor) +
          ansiEscapes.eraseLines(this.#lineCount) +
          output +
          buildCursorSuffix(screen.height - (fullscreen ? 1 : 0), options.cursor),
      );
    }

    this.#remember(screen, options.cursor, fullscreen);
    return true;
  }

  willPresent(
    screen: Screen,
    cursor: CursorPosition | undefined,
    fullscreen = false,
    forceRewrite = false,
  ): boolean {
    return (
      forceRewrite ||
      this.#screen === undefined ||
      !screensEqual(this.#screen, screen) ||
      cursorPositionChanged(cursor, this.#cursor) ||
      fullscreen !== this.#fullscreen
    );
  }

  /**
  Erases the presented frame from the cursor upward.

  `columns` is the terminal's current width. When it is narrower than the width
  the frame was painted at, a reflowing emulator (xterm.js, Ghostty, kitty,
  iTerm2, WezTerm, tmux, …) has already rewrapped every wider row onto several
  physical rows before the resize event reaches us, so the erase has to cover
  that physical footprint. Erasing only the logical row count leaves the frame's
  top rows behind as ghosts, one more batch per resize event.
  */
  clear(options: { readonly columns?: number } = {}): void {
    this.#write(
      buildReturnToBottomPrefix(this.#cursorWasShown, this.#lineCount, this.#cursor) +
        ansiEscapes.eraseLines(this.#physicalLineCount(options.columns)),
    );
    this.#lineCount = 0;
    this.#cursor = undefined;
    this.#cursorWasShown = false;
    this.#fullscreen = false;
  }

  #physicalLineCount(columns: number | undefined): number {
    if (
      this.#screen === undefined ||
      this.#lineCount === 0 ||
      columns === undefined ||
      columns < 1
    ) {
      return this.#lineCount;
    }
    let rows = 0;
    for (const line of this.#screen.toRows()) {
      rows += Math.max(1, Math.ceil(contentWidth(line) / columns));
    }
    return rows + (this.#fullscreen ? 0 : 1);
  }

  reset(): void {
    this.#screen = undefined;
    this.#lineCount = 0;
    this.#cursor = undefined;
    this.#cursorWasShown = false;
  }

  done(): void {
    this.reset();
    if (this.#hidden) {
      cliCursor.show(this.#stream);
      this.#hidden = false;
    }
  }

  get current(): Screen | undefined {
    return this.#screen;
  }

  #remember(screen: Screen, cursor: CursorPosition | undefined, fullscreen: boolean): void {
    this.#screen = screen;
    this.#lineCount = screen.height + (fullscreen ? 0 : 1);
    this.#cursor = cursor ? { ...cursor } : undefined;
    this.#cursorWasShown = cursor !== undefined;
    this.#fullscreen = fullscreen;
  }
}

/**
The columns a row occupies once written: everything up to its last visible
cell. Trailing unstyled blanks are trimmed by the serializer and never reach
the terminal, while styled blanks (a highlighted tab's padding) do.
*/
function contentWidth(line: Line): number {
  let width = 0;
  let end = 0;
  for (const cell of line) {
    width += cell.width;
    if (!isBlank(cell)) end = width;
  }
  return end;
}

function isBlank(cell: Cell): boolean {
  const { style } = cell;
  return (
    (cell.grapheme === " " || cell.width === 0) &&
    style.foreground === undefined &&
    style.background === undefined &&
    style.underlineColor === undefined &&
    style.underline === "none" &&
    style.attributes === cellAttributes.none &&
    cell.hyperlink === undefined
  );
}

function findFirstChangedRow(previous: Screen, next: Screen): number | undefined {
  const height = Math.max(previous.height, next.height);
  for (let y = 0; y < height; y++) {
    if (!rowsEqual(previous, next, y)) return y;
  }
  return undefined;
}

function rowsEqual(left: Screen, right: Screen, y: number): boolean {
  // Rows can extend past the nominal width when overflow content painted.
  const length = Math.max(left.rowLength(y), right.rowLength(y));
  for (let x = 0; x < length; x++) {
    if (!cellsEqual(left.cellAt(x, y), right.cellAt(x, y))) return false;
  }
  return true;
}

function screensEqual(left: Screen, right: Screen): boolean {
  if (left.width !== right.width || left.height !== right.height) return false;
  for (let y = 0; y < left.height; y++) {
    if (!rowsEqual(left, right, y)) return false;
  }
  return true;
}
