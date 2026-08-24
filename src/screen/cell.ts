/**
A terminal color before it is converted to an output profile.
*/
export type Color = RgbColor | IndexedColor;

export type RgbColor = {
  readonly model: "rgb";
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
};

export type IndexedColor = {
  readonly model: "indexed";
  readonly index: number;
  /** Preserve an explicit palette encoding when compatibility requires it. */
  readonly encoding?: "ansi16" | "ansi256";
};

/**
Bit flags for terminal text attributes. Multiple attributes may be combined.
*/
export const cellAttributes = {
  none: 0,
  bold: 1 << 0,
  faint: 1 << 1,
  italic: 1 << 2,
  blink: 1 << 3,
  rapidBlink: 1 << 4,
  inverse: 1 << 5,
  hidden: 1 << 6,
  strikethrough: 1 << 7,
} as const;

export type UnderlineStyle = "none" | "single" | "double" | "curly" | "dotted" | "dashed";

export type CellStyle = {
  readonly foreground?: Color;
  readonly background?: Color;
  readonly underlineColor?: Color;
  readonly underline: UnderlineStyle;
  readonly attributes: number;
};

export type Hyperlink = {
  readonly url: string;
  readonly parameters?: string;
};

export type CellContent = {
  readonly grapheme: string;
  readonly width: number;
};

/**
A compositing operation for one screen position.

An absent field is transparent and preserves the destination channel. `null`
explicitly resets a color or hyperlink to the terminal default. Supplying
`content` paints a grapheme; `{grapheme: " ", width: 1}` is therefore an
explicit blank, while an absent patch paints nothing at all.
*/
export type CellPatch = {
  readonly content?: CellContent;
  readonly foreground?: Color | null;
  readonly background?: Color | null;
  readonly underlineColor?: Color | null;
  readonly underline?: UnderlineStyle;
  readonly attributes?: number;
  readonly hyperlink?: Hyperlink | null;
};

/**
One grapheme cluster in a terminal screen. A width of zero is reserved for the
continuation columns of a wide grapheme and is created only by `Screen`.
*/
export type Cell = {
  readonly grapheme: string;
  readonly width: number;
  readonly style: CellStyle;
  readonly hyperlink?: Hyperlink;
  /** Composition intent consumed when this cell is drawn over another surface. */
  readonly reset?: { readonly foreground?: boolean; readonly background?: boolean };
};

export const emptyCellStyle: CellStyle = {
  underline: "none",
  attributes: cellAttributes.none,
};

export const emptyCell: Cell = {
  grapheme: " ",
  width: 1,
  style: emptyCellStyle,
};

export const createCell = (
  grapheme: string,
  width: number,
  style: CellStyle = emptyCellStyle,
  hyperlink?: Hyperlink,
  reset?: Cell["reset"],
): Cell => {
  if (grapheme.length === 0) {
    throw new Error("A cell must contain one grapheme cluster");
  }

  if (!Number.isInteger(width) || width < 1) {
    throw new Error("A cell width must be a positive integer");
  }

  return {
    grapheme,
    width,
    style,
    ...(hyperlink ? { hyperlink } : {}),
    ...(reset ? { reset } : {}),
  };
};

export const cellsEqual = (left: Cell | undefined, right: Cell | undefined): boolean => {
  if (left === right) return true;
  if (!left || !right || left.grapheme !== right.grapheme || left.width !== right.width) {
    return false;
  }

  const leftStyle = left.style;
  const rightStyle = right.style;
  return (
    leftStyle.attributes === rightStyle.attributes &&
    leftStyle.underline === rightStyle.underline &&
    JSON.stringify(leftStyle.foreground) === JSON.stringify(rightStyle.foreground) &&
    JSON.stringify(leftStyle.background) === JSON.stringify(rightStyle.background) &&
    JSON.stringify(leftStyle.underlineColor) === JSON.stringify(rightStyle.underlineColor) &&
    JSON.stringify(left.hyperlink) === JSON.stringify(right.hyperlink)
  );
};
