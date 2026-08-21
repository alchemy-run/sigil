// SPDX-License-Identifier: MIT

import type { Edge } from "../../../src/yoga/generated/YGEnums.ts";
import type { Yoga as YogaApi } from "../../../src/yoga/index.ts";
import type { EdgeValue, FuzzCase, LengthSpec, NodeSpec } from "./case.ts";

type EngineNode = ReturnType<YogaApi["Node"]["create"]>;

export interface LayoutSnapshot {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
  readonly hadOverflow: boolean;
  readonly children: readonly LayoutSnapshot[];
}

type LengthValue =
  | number
  | `${number}%`
  | "auto"
  | "max-content"
  | "fit-content"
  | "stretch"
  | undefined;

function value(length: LengthSpec): LengthValue {
  if (length.unit === "undefined") return;
  if (length.unit === "point") return length.value!;
  if (length.unit === "percent") return `${length.value!}%`;
  return length.unit;
}

function applyEdges(
  values: readonly EdgeValue[],
  apply: (edge: Edge, value: LengthValue) => void,
): void {
  for (const item of values) apply(item.edge, value(item.value));
}

function applyNode(Yoga: YogaApi, node: EngineNode, spec: NodeSpec): void {
  node.setWidth(value(spec.width));
  node.setHeight(value(spec.height));
  if (spec.minWidth)
    node.setMinWidth(value(spec.minWidth) as Parameters<EngineNode["setMinWidth"]>[0]);
  if (spec.minHeight)
    node.setMinHeight(value(spec.minHeight) as Parameters<EngineNode["setMinHeight"]>[0]);
  if (spec.maxWidth)
    node.setMaxWidth(value(spec.maxWidth) as Parameters<EngineNode["setMaxWidth"]>[0]);
  if (spec.maxHeight)
    node.setMaxHeight(value(spec.maxHeight) as Parameters<EngineNode["setMaxHeight"]>[0]);
  if (spec.flexBasis) node.setFlexBasis(value(spec.flexBasis));
  node.setFlexDirection(spec.flexDirection);
  node.setJustifyContent(spec.justifyContent);
  node.setAlignContent(spec.alignContent);
  node.setAlignItems(spec.alignItems);
  node.setAlignSelf(spec.alignSelf);
  node.setFlexWrap(spec.flexWrap);
  node.setPositionType(spec.positionType);
  node.setOverflow(spec.overflow);
  node.setDisplay(spec.display);
  if (spec.flexGrow !== undefined) node.setFlexGrow(spec.flexGrow);
  if (spec.flexShrink !== undefined) node.setFlexShrink(spec.flexShrink);
  if (spec.aspectRatio !== undefined) node.setAspectRatio(spec.aspectRatio);
  if (spec.gap)
    node.setGap(Yoga.GUTTER_ALL, value(spec.gap) as Parameters<EngineNode["setGap"]>[1]);

  applyEdges(spec.margins, (edge, edgeValue) =>
    node.setMargin(edge, edgeValue as number | `${number}%` | "auto" | undefined),
  );
  applyEdges(spec.padding, (edge, edgeValue) =>
    node.setPadding(edge, edgeValue as number | `${number}%` | undefined),
  );
  applyEdges(spec.borders, (edge, edgeValue) =>
    node.setBorder(edge, edgeValue as number | undefined),
  );
  applyEdges(spec.positions, (edge, edgeValue) =>
    node.setPosition(edge, edgeValue as number | `${number}%` | undefined),
  );

  if (spec.measure) {
    const measured = spec.measure;
    node.setMeasureFunc(() => measured);
  }
}

function buildNode(Yoga: YogaApi, spec: NodeSpec, config: unknown): EngineNode {
  const node = Yoga.Node.createWithConfig(
    config as Parameters<YogaApi["Node"]["createWithConfig"]>[0],
  );
  try {
    applyNode(Yoga, node, spec);
    spec.children.forEach((childSpec, index) => {
      node.insertChild(buildNode(Yoga, childSpec, config), index);
    });
    return node;
  } catch (error) {
    node.freeRecursive();
    throw error;
  }
}

function snapshot(node: EngineNode): LayoutSnapshot {
  return {
    left: node.getComputedLeft(),
    top: node.getComputedTop(),
    right: node.getComputedRight(),
    bottom: node.getComputedBottom(),
    width: node.getComputedWidth(),
    height: node.getComputedHeight(),
    hadOverflow: node.getComputedHadOverflow(),
    children: Array.from({ length: node.getChildCount() }, (_, index) =>
      snapshot(node.getChild(index)),
    ),
  };
}

export function executeCase(Yoga: YogaApi, fuzzCase: FuzzCase): LayoutSnapshot {
  const config = Yoga.Config.create();
  let root: EngineNode | undefined;
  try {
    config.setPointScaleFactor(fuzzCase.pointScaleFactor);
    config.setUseWebDefaults(fuzzCase.useWebDefaults);
    config.setErrata(fuzzCase.errata);
    root = buildNode(Yoga, fuzzCase.root, config);
    root.calculateLayout(fuzzCase.availableWidth, fuzzCase.availableHeight, fuzzCase.direction);
    return snapshot(root);
  } finally {
    root?.freeRecursive();
    config.free();
  }
}

function assertLayoutInvariants(snapshotValue: LayoutSnapshot, path = "root"): void {
  if (
    (Number.isFinite(snapshotValue.width) && snapshotValue.width < 0) ||
    (Number.isFinite(snapshotValue.height) && snapshotValue.height < 0)
  ) {
    throw new Error(
      `${path} has a negative size: ${snapshotValue.width} × ${snapshotValue.height}`,
    );
  }
  snapshotValue.children.forEach((child, index) =>
    assertLayoutInvariants(child, `${path}.children[${index}]`),
  );
}

export function assertInvariants(first: LayoutSnapshot, second: LayoutSnapshot): void {
  assertLayoutInvariants(first);
  assertEqualLayouts(first, second);
}

function close(left: number, right: number): boolean {
  if (Number.isNaN(left) && Number.isNaN(right)) return true;
  if (Object.is(left, right) || (left === 0 && right === 0)) return true;
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= 1e-4 * scale;
}

export function assertEqualLayouts(
  actual: LayoutSnapshot,
  expected: LayoutSnapshot,
  path = "root",
): void {
  for (const property of ["left", "top", "right", "bottom", "width", "height"] as const) {
    if (!close(actual[property], expected[property])) {
      throw new Error(
        `${path}.${property}: JavaScript=${actual[property]}, WASM=${expected[property]}`,
      );
    }
  }
  if (actual.hadOverflow !== expected.hadOverflow) {
    throw new Error(
      `${path}.hadOverflow: JavaScript=${actual.hadOverflow}, WASM=${expected.hadOverflow}`,
    );
  }
  if (actual.children.length !== expected.children.length) {
    throw new Error(
      `${path}.children: JavaScript=${actual.children.length}, WASM=${expected.children.length}`,
    );
  }
  actual.children.forEach((child, index) =>
    assertEqualLayouts(child, expected.children[index], `${path}.children[${index}]`),
  );
}
