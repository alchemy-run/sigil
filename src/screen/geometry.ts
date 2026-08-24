export type Point = {
  readonly x: number;
  readonly y: number;
};

export type Rect = Point & {
  readonly width: number;
  readonly height: number;
};
