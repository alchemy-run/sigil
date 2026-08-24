import { blend } from "#/color/sample.ts";
import { createCell, emptyCell, type Cell, type CellPatch, type CellStyle } from "#/screen/cell.ts";
import type { Rect } from "#/screen/geometry.ts";

export type Line = readonly Cell[];

/** A half-open range of changed columns in one row. */
export type DirtySpan = {
  readonly y: number;
  readonly start: number;
  readonly end: number;
};

/**
A mutable two-dimensional terminal cell buffer. Cells themselves are immutable,
so current and next screens can compare them by value or safely share constants.
*/
export class Screen {
  #width: number;
  #height: number;

  #rows: Cell[][];
  #painted: boolean[][];
  #dirty: Array<{ start: number; end: number } | undefined>;

  constructor(width: number, height: number) {
    validateDimensions(width, height);

    this.#width = width;
    this.#height = height;
    this.#rows = Array.from({ length: height }, () => Array<Cell>(width).fill(emptyCell));
    this.#painted = Array.from({ length: height }, () => Array<boolean>(width).fill(false));
    this.#dirty = Array.from({ length: height }, () =>
      width > 0 ? { start: 0, end: width } : undefined,
    );
  }

  get width(): number {
    return this.#width;
  }

  get height(): number {
    return this.#height;
  }

  bounds(): Rect {
    return { x: 0, y: 0, width: this.width, height: this.height };
  }

  cellAt(x: number, y: number): Cell | undefined {
    return this.#rows[y]?.[x];
  }

  /** Whether a drawable explicitly touched this position. */
  isPainted(x: number, y: number): boolean {
    return this.#painted[y]?.[x] ?? false;
  }

  setCell(x: number, y: number, cell: Cell): void {
    const row = this.#rows[y];
    if (!row || x < 0 || x >= this.width) {
      return;
    }

    if (!Number.isInteger(cell.width) || cell.width < 1) {
      throw new Error("Only leading cells with a positive width may be written");
    }

    const finalColumn = x + cell.width;
    const clipped = finalColumn > this.width;
    const overwriteEnd = Math.min(finalColumn, this.width);

    for (let column = x; column < overwriteEnd; column++) {
      this.#clearGraphemeAt(row, y, column);
    }

    if (clipped) {
      for (let column = x; column < this.width; column++) {
        row[column] = emptyCell;
      }
      this.#markDirty(y, x, this.width);

      return;
    }

    row[x] = cell;
    this.#painted[y]![x] = true;

    for (let column = x + 1; column < finalColumn; column++) {
      row[column] = {
        grapheme: "",
        width: 0,
        style: cell.style,
        ...(cell.hyperlink ? { hyperlink: cell.hyperlink } : {}),
      };
      this.#painted[y]![column] = true;
    }
    this.#markDirty(y, x, finalColumn);
  }

  /**
  Composes independent cell channels over the existing cell. An undefined
  patch is transparent; an explicit space in `content` paints a blank.
  */
  composeCell(x: number, y: number, patch: CellPatch | undefined): void {
    if (!patch) {
      return;
    }

    const row = this.#rows[y];
    if (!row || x < 0 || x >= this.width) {
      return;
    }

    let leadingColumn = x;
    while (leadingColumn > 0 && row[leadingColumn]?.width === 0) {
      leadingColumn--;
    }

    const destination = row[leadingColumn] ?? emptyCell;
    const writeColumn = patch.content ? x : leadingColumn;
    const style: CellStyle = {
      ...this.#composeColor(destination.style, patch, "foreground"),
      ...this.#composeColor(destination.style, patch, "background"),
      ...this.#composeColor(destination.style, patch, "underlineColor"),
      underline: patch.underline ?? destination.style.underline,
      attributes: patch.attributes ?? destination.style.attributes,
    };
    const content = patch.content ?? destination;
    const hyperlink =
      patch.hyperlink === undefined ? destination.hyperlink : (patch.hyperlink ?? undefined);

    this.setCell(writeColumn, y, createCell(content.grapheme, content.width, style, hyperlink));
  }

  /** Composes a patch throughout a rectangle, clipped to this screen. */
  fill(bounds: Rect, patch: CellPatch | undefined): void {
    if (!patch) {
      return;
    }

    const startX = Math.max(0, bounds.x);
    const startY = Math.max(0, bounds.y);
    const endX = Math.min(this.width, bounds.x + bounds.width);
    const endY = Math.min(this.height, bounds.y + bounds.height);
    const step = Math.max(1, patch.content?.width ?? 1);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x += step) {
        this.composeCell(x, y, patch);
      }
    }
  }

  /** Resizes while preserving complete graphemes in the shared top-left area. */
  resize(width: number, height: number): void {
    validateDimensions(width, height);

    const rows = Array.from({ length: height }, () => Array<Cell>(width).fill(emptyCell));
    const painted = Array.from({ length: height }, () => Array<boolean>(width).fill(false));
    const sharedHeight = Math.min(height, this.height);

    for (let y = 0; y < sharedHeight; y++) {
      const source = this.#rows[y]!;
      const destination = rows[y]!;
      for (let x = 0; x < Math.min(width, this.width); x++) {
        const cell = source[x]!;
        if (cell.width === 0 || x + cell.width > width) {
          continue;
        }

        destination[x] = cell;
        painted[y]![x] = this.#painted[y]![x]!;
        for (let column = x + 1; column < x + cell.width; column++) {
          destination[column] = source[column]!;
          painted[y]![column] = this.#painted[y]![column]!;
        }
      }
    }

    this.#width = width;
    this.#height = height;
    this.#rows = rows;
    this.#painted = painted;
    this.#dirty = Array.from({ length: height }, () =>
      width > 0 ? { start: 0, end: width } : undefined,
    );
  }

  clear(): void {
    for (const [y, row] of this.#rows.entries()) {
      row.fill(emptyCell);
      this.#painted[y]!.fill(true);
      this.#markDirty(y, 0, this.width);
    }
  }

  toRows(): readonly Line[] {
    return this.#rows;
  }

  dirtySpans(): readonly DirtySpan[] {
    return this.#dirty.flatMap((span, y) => (span ? [{ y, ...span }] : []));
  }

  takeDirtySpans(): readonly DirtySpan[] {
    const spans = this.dirtySpans();
    this.#dirty.fill(undefined);
    return spans;
  }

  #clearGraphemeAt(row: Cell[], y: number, x: number): void {
    const existing = row[x];
    if (!existing || existing === emptyCell) {
      return;
    }

    let leadingColumn = x;
    while (leadingColumn > 0 && row[leadingColumn]?.width === 0) {
      leadingColumn--;
    }

    const leadingCell = row[leadingColumn];
    const width = Math.max(1, leadingCell?.width ?? 1);
    for (
      let column = leadingColumn;
      column < Math.min(leadingColumn + width, this.width);
      column++
    ) {
      row[column] = emptyCell;
      this.#painted[y]![column] = true;
    }
    this.#markDirty(y, leadingColumn, leadingColumn + width);
  }

  #composeColor(
    destination: CellStyle,
    patch: CellPatch,
    channel: "foreground" | "background" | "underlineColor",
  ): Partial<CellStyle> {
    const value = patch[channel];
    if (value === undefined) {
      return destination[channel] ? { [channel]: destination[channel] } : {};
    }

    if (value === null) return {};
    const destinationColor = destination[channel];
    if (value.model === "rgb" && value.alpha < 255 && destinationColor) {
      return { [channel]: blend(value, destinationColor) };
    }
    return { [channel]: value };
  }

  #markDirty(y: number, start: number, end: number): void {
    if (y < 0 || y >= this.height || start >= end) {
      return;
    }

    const clippedStart = Math.max(0, start);
    const clippedEnd = Math.min(this.width, end);
    const current = this.#dirty[y];
    this.#dirty[y] = current
      ? { start: Math.min(current.start, clippedStart), end: Math.max(current.end, clippedEnd) }
      : { start: clippedStart, end: clippedEnd };
  }
}

function validateDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || width < 0 || !Number.isInteger(height) || height < 0) {
    throw new Error("Screen dimensions must be non-negative integers");
  }
}
