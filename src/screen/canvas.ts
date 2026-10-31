import { sliceAnsi } from "#/ansi/slice.ts";
import { stringWidth } from "#/ansi/string-width.ts";
import type { StyledChar } from "#/ansi/tokenize.ts";
import type { PaintContext } from "#/color/paint.ts";
import { cellFromStyledChar, Screen, type Cell, type ColorProfile } from "#/screen/index.ts";
import type { AnsiTransformer } from "#/transform-adapter.ts";
import { transformAnsiLine } from "#/transform-adapter.ts";

type Options = {
  width: number;
  height: number;
  colorProfile?: ColorProfile;
  paintContext?: PaintContext;
};
type Clip = {
  x1: number | undefined;
  x2: number | undefined;
  y1: number | undefined;
  y2: number | undefined;
};

// An undefined bound is unbounded, so keep whichever bound is defined.
const tighter = (
  a: number | undefined,
  b: number | undefined,
  pick: (a: number, b: number) => number,
): number | undefined => (a === undefined ? b : b === undefined ? a : pick(a, b));

/** Immediate structured drawing canvas with one explicit ANSI compatibility adapter. */
export class Canvas {
  width: number;
  height: number;
  readonly paintContext: PaintContext;
  readonly #screen: Screen;
  readonly #clips: Clip[] = [];

  constructor(options: Options) {
    this.width = options.width;
    this.height = options.height;
    this.paintContext = { profile: options.colorProfile ?? "truecolor", ...options.paintContext };
    this.#screen = new Screen(this.width, this.height);
  }

  writeCells(
    x: number,
    y: number,
    lines: readonly (readonly Cell[])[],
    options?: { overflow?: boolean },
  ): void {
    const clip = this.#clips.at(-1);
    const overflow = options?.overflow === true;
    for (const [rowOffset, line] of lines.entries()) {
      const currentY = y + rowOffset;
      if (!this.#insideY(currentY, clip)) continue;
      let currentX = x;
      for (const cell of line) {
        const endX = currentX + cell.width;
        const visibleStart = Math.max(currentX, clip?.x1 ?? currentX);
        const visibleEnd = Math.min(endX, clip?.x2 ?? endX);
        if (visibleStart === currentX && visibleEnd === endX) {
          this.#composeNativeCell(currentX, currentY, cell, overflow);
        } else {
          // A wide grapheme split by a clip edge still owns its visible
          // columns: paint them as blanks that keep the grapheme's style.
          const blank = { ...cell, grapheme: " ", width: 1 };
          for (let column = visibleStart; column < visibleEnd; column++) {
            this.#composeNativeCell(column, currentY, blank, overflow);
          }
        }
        currentX = endX;
      }
    }
  }

  writeAnsi(
    x: number,
    y: number,
    text: string,
    options: { transformers: AnsiTransformer[]; overflow?: boolean },
  ): void {
    if (!text) return;
    let lines = text.split("\n");
    const clip = this.#clips.at(-1);
    const overflow = options.overflow === true;
    // Transformers see each line's index within the original text.
    let firstLineIndex = 0;
    if (clip?.y1 !== undefined && y < clip.y1) {
      firstLineIndex = clip.y1 - y;
      lines = lines.slice(firstLineIndex);
      y = clip.y1;
    }
    if (clip?.y2 !== undefined) lines = lines.slice(0, Math.max(0, clip.y2 - y));
    for (const [lineIndex, original] of lines.entries()) {
      const currentY = y + lineIndex;
      if (!this.#insideY(currentY, clip)) continue;
      let line = original;
      let currentX = x;
      // Slicing drops a wide grapheme split by a clip edge; pad its visible
      // half back with a blank so the rest of the line keeps its columns.
      if (clip?.x1 !== undefined && currentX < clip.x1) {
        const visible = stringWidth(line) - (clip.x1 - currentX);
        line = sliceAnsi(line, clip.x1 - currentX);
        line = " ".repeat(Math.max(0, visible - stringWidth(line))) + line;
        currentX = clip.x1;
      }
      if (clip?.x2 !== undefined) {
        const columns = Math.max(0, clip.x2 - currentX);
        const visible = Math.min(columns, stringWidth(line));
        line = sliceAnsi(line, 0, columns);
        line += " ".repeat(Math.max(0, visible - stringWidth(line)));
      }
      for (const character of transformAnsiLine(
        line,
        firstLineIndex + lineIndex,
        options.transformers,
      )) {
        const width = Math.max(1, stringWidth(character.value));
        if (clip?.x2 !== undefined && currentX + width > clip.x2) break;
        this.#writeCompatibilityCell(currentX, currentY, character, width, overflow);
        currentX += width;
      }
    }
  }

  clip(clip: Clip): void {
    // Nested clips intersect; an inner clip must never widen the outer one.
    const outer = this.#clips.at(-1);
    this.#clips.push(
      outer
        ? {
            x1: tighter(outer.x1, clip.x1, Math.max),
            x2: tighter(outer.x2, clip.x2, Math.min),
            y1: tighter(outer.y1, clip.y1, Math.max),
            y2: tighter(outer.y2, clip.y2, Math.min),
          }
        : clip,
    );
  }
  unclip(): void {
    this.#clips.pop();
  }

  finish(): Screen {
    return this.#screen;
  }

  #insideY(y: number, clip: Clip | undefined): boolean {
    return (
      y >= 0 &&
      y < this.#screen.height &&
      (clip?.y1 === undefined || y >= clip.y1) &&
      (clip?.y2 === undefined || y < clip.y2)
    );
  }

  #composeNativeCell(x: number, y: number, cell: Cell, overflow = false): void {
    if (!overflow && x >= this.#screen.width) {
      return;
    }
    this.#screen.composeCell(
      x,
      y,
      {
        content: { grapheme: cell.grapheme, width: cell.width },
        foreground: cell.reset?.foreground ? null : (cell.style.foreground ?? null),
        background: cell.reset?.background ? null : cell.style.background,
        underlineColor: cell.style.underlineColor ?? null,
        underline: cell.style.underline,
        attributes: cell.style.attributes,
        hyperlink: cell.hyperlink ?? null,
      },
      { overflow },
    );
  }

  #writeCompatibilityCell(
    x: number,
    y: number,
    character: StyledChar,
    width: number,
    overflow = false,
  ): void {
    if (!overflow && x >= this.#screen.width) {
      return;
    }
    const cell = cellFromStyledChar(character, width);
    this.#screen.composeCell(
      x,
      y,
      {
        content: { grapheme: cell.grapheme, width: cell.width },
        foreground: cell.style.foreground ?? null,
        background: cell.style.background,
        underlineColor: cell.style.underlineColor ?? null,
        underline: cell.style.underline,
        attributes: cell.style.attributes,
        hyperlink: cell.hyperlink ?? null,
      },
      { overflow },
    );
  }
}
