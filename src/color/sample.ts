import {
  rgb,
  type GradientStop,
  type InterpolationSpace,
  type LinearGradient,
  type Paint,
  type PaintContext,
  type PerimeterGradient,
} from "#/color/paint.ts";
import { colorToRgb } from "#/color/palette.ts";
import type { Color, RgbColor } from "#/screen/cell.ts";
import type { Rect } from "#/screen/geometry.ts";
import { parseSemanticColor } from "#/semantic-text-style.ts";

export function samplePaint(
  paint: Paint,
  x: number,
  y: number,
  bounds: Rect,
  context: PaintContext = {},
): Color | undefined {
  const resolved = resolveConditional(paint, context);
  if (resolved && typeof resolved === "object" && "type" in resolved) {
    if (resolved.type === "perimeter-gradient") {
      return samplePerimeterGradient(resolved, x, y, bounds, context);
    }
  }
  if (isLinearGradient(resolved)) {
    return sampleGradient(resolved, x, y, bounds, context);
  }
  return resolveColor(resolved);
}

export function blend(source: Color, destination: Color, palette?: PaintContext["palette"]): Color {
  const foreground = colorToRgb(source, palette);
  if (foreground.alpha >= 255) return foreground;
  const background = colorToRgb(destination, palette);
  const alpha = foreground.alpha / 255;
  return rgb(
    foreground.red * alpha + background.red * (1 - alpha),
    foreground.green * alpha + background.green * (1 - alpha),
    foreground.blue * alpha + background.blue * (1 - alpha),
  );
}

/** Progressively moves a color toward white in perceptual OKLab space. */
export function lighten(color: Color, amount: number, palette?: PaintContext["palette"]): RgbColor {
  return interpolateColor(color, rgb(255, 255, 255), amount, "oklab", palette);
}

/** Progressively moves a color toward black in perceptual OKLab space. */
export function darken(color: Color, amount: number, palette?: PaintContext["palette"]): RgbColor {
  return interpolateColor(color, rgb(0, 0, 0), amount, "oklab", palette);
}

function sampleGradient(
  gradient: LinearGradient,
  x: number,
  y: number,
  bounds: Rect,
  context: PaintContext,
): Color | undefined {
  const radians = (gradient.angle * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  const width = Math.max(1, bounds.width - 1);
  const height = Math.max(1, bounds.height - 1);
  const projections = [0, width * dx, height * dy, width * dx + height * dy];
  const minimum = Math.min(...projections);
  const maximum = Math.max(...projections);
  const projection = (x - bounds.x) * dx + (y - bounds.y) * dy;
  const position = maximum === minimum ? 0 : (projection - minimum) / (maximum - minimum);
  return sampleStops(gradient.stops, position, gradient.space, x, y, bounds, context);
}

function samplePerimeterGradient(
  gradient: PerimeterGradient,
  x: number,
  y: number,
  bounds: Rect,
  context: PaintContext,
): Color | undefined {
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const steps = width === 1 || height === 1 ? Math.max(width, height) : 2 * width + 2 * height - 4;
  if (steps <= 1) return samplePaint(gradient.stops[0]!.color, x, y, bounds, context);

  const left = bounds.x;
  const top = bounds.y;
  const right = left + width - 1;
  const bottom = top + height - 1;
  let index: number;

  if (height === 1) index = x - left;
  else if (width === 1) index = y - top;
  else if (y <= top) index = Math.max(0, Math.min(width - 1, x - left));
  else if (x >= right) index = width + Math.max(0, Math.min(height - 2, y - top - 1));
  else if (y >= bottom) index = width + height - 2 + Math.max(0, Math.min(width - 1, right - x));
  else index = 2 * width + height - 2 + Math.max(0, Math.min(height - 2, bottom - y - 1));

  index = modulo(index - gradient.offset, steps);
  const position = blendPosition(index, steps, gradient.stops.length);
  return sampleStops(gradient.stops, position, gradient.space, x, y, bounds, context);
}

/** Matches Lip Gloss Blend1D's even, discrete distribution of stops. */
function blendPosition(index: number, steps: number, stopCount: number): number {
  if (steps <= stopCount) return index / Math.max(1, stopCount - 1);
  const segments = stopCount - 1;
  const baseSize = Math.floor(steps / segments);
  const remainder = steps % segments;
  let start = 0;
  for (let segment = 0; segment < segments; segment++) {
    const size = baseSize + (segment < remainder ? 1 : 0);
    if (index < start + size) {
      const local = size <= 1 ? 0 : (index - start) / (size - 1);
      return (segment + local) / segments;
    }
    start += size;
  }
  return 1;
}

function sampleStops(
  stops: readonly GradientStop[],
  position: number,
  space: InterpolationSpace,
  x: number,
  y: number,
  bounds: Rect,
  context: PaintContext,
): Color | undefined {
  let right = 1;
  while (right < stops.length - 1 && position > stops[right]!.offset!) right++;
  const left = right - 1;
  const start = stops[left]!;
  const end = stops[right]!;
  const span = end.offset! - start.offset!;
  const amount = span === 0 ? 0 : Math.max(0, Math.min(1, (position - start.offset!) / span));
  const startColor = samplePaint(start.color, x, y, bounds, context);
  const endColor = samplePaint(end.color, x, y, bounds, context);
  if (!startColor || !endColor) return startColor ?? endColor;
  return interpolateColor(startColor, endColor, amount, space, context.palette);
}

export function interpolateColor(
  from: Color,
  to: Color,
  amount: number,
  space: InterpolationSpace = "oklab",
  palette?: PaintContext["palette"],
): RgbColor {
  const a = colorToRgb(from, palette);
  const b = colorToRgb(to, palette);
  const t = Math.max(0, Math.min(1, amount));
  if (space === "rgb")
    return rgb(
      mix(a.red, b.red, t),
      mix(a.green, b.green, t),
      mix(a.blue, b.blue, t),
      mix(a.alpha, b.alpha, t),
    );
  if (space === "hsv") {
    const ah = toHsv(a),
      bh = toHsv(b);
    let delta = bh[0] - ah[0];
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return fromHsv(
      ah[0] + delta * t,
      mix(ah[1], bh[1], t),
      mix(ah[2], bh[2], t),
      mix(a.alpha, b.alpha, t),
    );
  }
  if (space === "lab") {
    const al = toLab(a),
      bl = toLab(b);
    return fromLab(
      mix(al[0], bl[0], t),
      mix(al[1], bl[1], t),
      mix(al[2], bl[2], t),
      mix(a.alpha, b.alpha, t),
    );
  }
  const al = toOklab(a),
    bl = toOklab(b);
  return fromOklab(
    mix(al[0], bl[0], t),
    mix(al[1], bl[1], t),
    mix(al[2], bl[2], t),
    mix(a.alpha, b.alpha, t),
  );
}

const D65 = [0.95047, 1, 1.08883] as const;
function labCurve(value: number): number {
  return value > (6 / 29) ** 3 ? Math.cbrt(value) : (value / 3) * (29 / 6) ** 2 + 4 / 29;
}
function inverseLabCurve(value: number): number {
  return value > 6 / 29 ? value ** 3 : 3 * (6 / 29) ** 2 * (value - 4 / 29);
}
function toLab(color: RgbColor): [number, number, number] {
  const r = linear(color.red),
    g = linear(color.green),
    b = linear(color.blue);
  const x = 0.4123907992659595 * r + 0.357584339383878 * g + 0.1804807884018343 * b;
  const y = 0.2126390058715104 * r + 0.7151686787677559 * g + 0.0721923153607337 * b;
  const z = 0.0193308187155919 * r + 0.119194779794626 * g + 0.9505321522496606 * b;
  const fy = labCurve(y / D65[1]);
  return [1.16 * fy - 0.16, 5 * (labCurve(x / D65[0]) - fy), 2 * (fy - labCurve(z / D65[2]))];
}
function fromLab(l: number, a: number, b: number, alpha: number): RgbColor {
  const center = (l + 0.16) / 1.16;
  const x = D65[0] * inverseLabCurve(center + a / 5);
  const y = D65[1] * inverseLabCurve(center);
  const z = D65[2] * inverseLabCurve(center - b / 2);
  return rgb(
    colorfulChannel(3.240969941904521 * x - 1.5373831775700935 * y - 0.4986107602930033 * z),
    colorfulChannel(-0.9692436362808798 * x + 1.8759675015077206 * y + 0.0415550574071756 * z),
    colorfulChannel(0.0556300796969936 * x - 0.2039769588889766 * y + 1.0569715142428786 * z),
    alpha,
  );
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const linear = (value: number) => {
  const x = value / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const gamma = (value: number) =>
  255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);
const colorfulChannel = (value: number) => {
  const encoded = value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
  return Math.floor(Math.round(Math.max(0, Math.min(1, encoded)) * 65_535) / 256);
};
function toOklab(c: RgbColor): [number, number, number] {
  const r = linear(c.red),
    g = linear(c.green),
    b = linear(c.blue);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b),
    m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function fromOklab(L: number, a: number, b: number, alpha: number): RgbColor {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return rgb(
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    alpha,
  );
}
function toHsv(c: RgbColor): [number, number, number] {
  const r = c.red / 255,
    g = c.green / 255,
    b = c.blue / 255,
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d)
    h =
      max === r
        ? 60 * (((g - b) / d) % 6)
        : max === g
          ? 60 * ((b - r) / d + 2)
          : 60 * ((r - g) / d + 4);
  return [(h + 360) % 360, max === 0 ? 0 : d / max, max];
}
function fromHsv(h: number, s: number, v: number, alpha: number): RgbColor {
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return rgb((r + m) * 255, (g + m) * 255, (b + m) * 255, alpha);
}
function resolveConditional(paint: Paint, context: PaintContext): Paint {
  if (typeof paint !== "object" || paint === null || "model" in paint) return paint;
  if (paint.type === "adaptive-color")
    return resolveConditional(context.appearance === "light" ? paint.light : paint.dark, context);
  if (paint.type === "profile-color")
    return resolveConditional(
      (context.profile && paint.colors[context.profile]) ?? paint.fallback,
      context,
    );
  return paint;
}
function resolveColor(value: Paint): Color | undefined {
  return typeof value === "string"
    ? parseSemanticColor(value)
    : typeof value === "object" && value !== null && "model" in value
      ? value
      : undefined;
}
function isLinearGradient(value: Paint): value is LinearGradient {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "linear-gradient"
  );
}

const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
