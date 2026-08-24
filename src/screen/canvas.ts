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

  writeCells(x: number, y: number, lines: readonly (readonly Cell[])[]): void {
    const clip = this.#clips.at(-1);
    for (const [rowOffset, line] of lines.entries()) {
      const currentY = y + rowOffset;
      if (!this.#insideY(currentY, clip)) continue;
      let currentX = x;
      for (const cell of line) {
        const endX = currentX + cell.width;
        const clipped =
          (clip?.x1 !== undefined && currentX < clip.x1) ||
          (clip?.x2 !== undefined && endX > clip.x2);
        if (!clipped) this.#composeNativeCell(currentX, currentY, cell);
        currentX = endX;
      }
    }
  }

  writeAnsi(
    x: number,
    y: number,
    text: string,
    options: { transformers: AnsiTransformer[] },
  ): void {
    if (!text) return;
    let lines = text.split("\n");
    const clip = this.#clips.at(-1);
    if (clip?.y1 !== undefined && y < clip.y1) {
      lines = lines.slice(clip.y1 - y);
      y = clip.y1;
    }
    if (clip?.y2 !== undefined) lines = lines.slice(0, Math.max(0, clip.y2 - y));
    for (const [lineIndex, original] of lines.entries()) {
      const currentY = y + lineIndex;
      if (!this.#insideY(currentY, clip)) continue;
      let line = original;
      let currentX = x;
      if (clip?.x1 !== undefined && currentX < clip.x1) {
        line = sliceAnsi(line, clip.x1 - currentX);
        currentX = clip.x1;
      }
      if (clip?.x2 !== undefined) line = sliceAnsi(line, 0, Math.max(0, clip.x2 - currentX));
      for (const character of transformAnsiLine(line, lineIndex, options.transformers)) {
        const width = Math.max(1, stringWidth(character.value));
        if (clip?.x2 !== undefined && currentX + width > clip.x2) break;
        this.#writeCompatibilityCell(currentX, currentY, character, width);
        currentX += width;
      }
    }
  }

  clip(clip: Clip): void {
    this.#clips.push(clip);
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

  #composeNativeCell(x: number, y: number, cell: Cell): void {
    if (x >= this.#screen.width) {
      return;
    }
    this.#screen.composeCell(x, y, {
      content: { grapheme: cell.grapheme, width: cell.width },
      foreground: cell.reset?.foreground ? null : (cell.style.foreground ?? null),
      background: cell.reset?.background ? null : cell.style.background,
      underlineColor: cell.style.underlineColor ?? null,
      underline: cell.style.underline,
      attributes: cell.style.attributes,
      hyperlink: cell.hyperlink ?? null,
    });
  }

  #writeCompatibilityCell(x: number, y: number, character: StyledChar, width: number): void {
    if (x >= this.#screen.width) {
      return;
    }
    const cell = cellFromStyledChar(character, width);
    this.#screen.composeCell(x, y, {
      content: { grapheme: cell.grapheme, width: cell.width },
      foreground: cell.style.foreground ?? null,
      background: cell.style.background,
      underlineColor: cell.style.underlineColor ?? null,
      underline: cell.style.underline,
      attributes: cell.style.attributes,
      hyperlink: cell.hyperlink ?? null,
    });
  }
}
