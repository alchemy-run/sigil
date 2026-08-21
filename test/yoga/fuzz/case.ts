// SPDX-License-Identifier: MIT

import type {
  Align,
  Direction,
  Display,
  Edge,
  FlexDirection,
  Justify,
  Overflow,
  PositionType,
  Wrap,
} from "../../../src/yoga/generated/YGEnums.ts";

export type LengthUnit =
  | "undefined"
  | "point"
  | "percent"
  | "auto"
  | "max-content"
  | "fit-content"
  | "stretch";

export interface LengthSpec {
  readonly unit: LengthUnit;
  readonly value?: number;
}

export interface EdgeValue {
  readonly edge: Edge;
  readonly value: LengthSpec;
}

export interface NodeSpec {
  readonly width: LengthSpec;
  readonly height: LengthSpec;
  readonly minWidth?: LengthSpec;
  readonly minHeight?: LengthSpec;
  readonly maxWidth?: LengthSpec;
  readonly maxHeight?: LengthSpec;
  readonly flexBasis?: LengthSpec;
  readonly flexDirection: FlexDirection;
  readonly justifyContent: Justify;
  readonly alignContent: Align;
  readonly alignItems: Align;
  readonly alignSelf: Align;
  readonly flexWrap: Wrap;
  readonly positionType: PositionType;
  readonly overflow: Overflow;
  readonly display: Display;
  readonly flexGrow?: number;
  readonly flexShrink?: number;
  readonly aspectRatio?: number;
  readonly gap?: LengthSpec;
  readonly margins: readonly EdgeValue[];
  readonly padding: readonly EdgeValue[];
  readonly borders: readonly EdgeValue[];
  readonly positions: readonly EdgeValue[];
  readonly measure?: { readonly width: number; readonly height: number };
  readonly children: readonly NodeSpec[];
}

export interface FuzzCase {
  readonly seed: number;
  readonly pointScaleFactor: number;
  readonly useWebDefaults: boolean;
  readonly errata: number;
  readonly availableWidth?: number;
  readonly availableHeight?: number;
  readonly direction: Direction;
  readonly root: NodeSpec;
}

class Random {
  private state: number;

  constructor(state: number) {
    this.state = state >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  }

  integer(minimum: number, maximum: number): number {
    return minimum + Math.floor(this.next() * (maximum - minimum + 1));
  }

  boolean(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(values: readonly T[]): T {
    return values[this.integer(0, values.length - 1)];
  }

  optional<T>(create: () => T, probability = 0.5): T | undefined {
    return this.boolean(probability) ? create() : undefined;
  }
}

const EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

function scalar(random: Random, maximum = 200): number {
  return random.integer(0, maximum * 4) / 4;
}

function length(random: Random, units: readonly LengthUnit[], maximum = 200): LengthSpec {
  const unit = random.pick(units);
  return unit === "point" || unit === "percent"
    ? { unit, value: scalar(random, maximum) }
    : { unit };
}

function edgeValues(random: Random, units: readonly LengthUnit[], maximum: number): EdgeValue[] {
  const count = random.integer(0, 3);
  const edges = [...EDGES];
  const result: EdgeValue[] = [];
  for (let index = 0; index < count; index++) {
    const selected = random.integer(0, edges.length - 1);
    result.push({
      edge: edges.splice(selected, 1)[0],
      value: length(random, units, maximum),
    });
  }
  return result;
}

function generateNode(random: Random, remaining: { value: number }, depth: number): NodeSpec {
  remaining.value--;
  const measured = depth > 0 && random.boolean(0.08);
  const children: NodeSpec[] = [];
  if (!measured && depth < 4 && remaining.value > 0) {
    const childCount = random.integer(0, Math.min(4, remaining.value));
    for (let index = 0; index < childCount && remaining.value > 0; index++) {
      children.push(generateNode(random, remaining, depth + 1));
    }
  }

  const dimensions = [
    "undefined",
    "point",
    "percent",
    "auto",
    "max-content",
    "fit-content",
    "stretch",
  ] as const;
  const constraints = [
    "undefined",
    "point",
    "percent",
    "max-content",
    "fit-content",
    "stretch",
  ] as const;

  return {
    width: length(random, dimensions, 300),
    height: length(random, dimensions, 200),
    minWidth: random.optional(() => length(random, constraints, 100), 0.25),
    minHeight: random.optional(() => length(random, constraints, 100), 0.25),
    maxWidth: random.optional(() => length(random, constraints, 400), 0.25),
    maxHeight: random.optional(() => length(random, constraints, 300), 0.25),
    flexBasis: random.optional(() => length(random, dimensions, 200), 0.35),
    flexDirection: random.integer(0, 3) as FlexDirection,
    justifyContent: random.integer(0, 9) as Justify,
    alignContent: random.integer(1, 10) as Align,
    alignItems: random.integer(1, 10) as Align,
    alignSelf: random.integer(0, 10) as Align,
    flexWrap: random.integer(0, 2) as Wrap,
    positionType: random.integer(0, 2) as PositionType,
    overflow: random.integer(0, 2) as Overflow,
    display: random.pick([0, 0, 0, 1, 2]) as Display,
    flexGrow: random.optional(() => scalar(random, 3), 0.35),
    flexShrink: random.optional(() => scalar(random, 3), 0.35),
    aspectRatio: random.optional(() => random.integer(1, 16) / 4, 0.2),
    gap: random.optional(() => length(random, ["undefined", "point", "percent"], 30), 0.35),
    margins: edgeValues(random, ["undefined", "point", "percent", "auto"], 40),
    padding: edgeValues(random, ["undefined", "point", "percent"], 30),
    borders: edgeValues(random, ["undefined", "point"], 15),
    positions: edgeValues(random, ["undefined", "point", "percent"], 100),
    measure: measured ? { width: scalar(random, 180), height: scalar(random, 100) } : undefined,
    children,
  };
}

export function generateCase(seed: number, maxNodes = 24): FuzzCase {
  const normalizedSeed = seed >>> 0;
  const random = new Random(normalizedSeed);
  const available = () => random.optional(() => random.integer(0, 800), 0.65);

  return {
    seed: normalizedSeed,
    pointScaleFactor: random.pick([0, 1, 1, 2, 3]),
    useWebDefaults: random.boolean(),
    errata: random.pick([0, 8, 2_147_483_646, 2_147_483_647]),
    availableWidth: available(),
    availableHeight: available(),
    direction: random.pick([1, 2]) as Direction,
    root: generateNode(random, { value: maxNodes }, 0),
  };
}
