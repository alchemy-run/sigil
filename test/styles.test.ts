import { expect, onTestFinished, test } from "vite-plus/test";

import { styles as applyStyles } from "#/styles.ts";
import { Yoga } from "#/yoga/index.ts";

const createNode = () => {
  const node = Yoga.Node.create();
  onTestFinished(() => {
    node.free();
  });
  return node;
};

for (const [property, edge] of [
  ["marginX", Yoga.EDGE_LEFT],
  ["marginY", Yoga.EDGE_TOP],
  ["marginLeft", Yoga.EDGE_LEFT],
  ["marginRight", Yoga.EDGE_RIGHT],
  ["marginTop", Yoga.EDGE_TOP],
  ["marginBottom", Yoga.EDGE_BOTTOM],
] as const) {
  test(`removing ${property} restores shorthand margin`, () => {
    const node = createNode();

    applyStyles(node, { margin: 2, [property]: 1 });
    node.calculateLayout();
    expect(node.getComputedMargin(edge)).toBe(1);

    applyStyles(node, { [property]: undefined });
    node.calculateLayout();
    expect(node.getComputedMargin(edge)).toBe(2);

    applyStyles(node, { [property]: 0 });
    node.calculateLayout();
    expect(node.getComputedMargin(edge)).toBe(0);
  });
}

for (const [property, edge] of [
  ["paddingX", Yoga.EDGE_LEFT],
  ["paddingY", Yoga.EDGE_TOP],
  ["paddingLeft", Yoga.EDGE_LEFT],
  ["paddingRight", Yoga.EDGE_RIGHT],
  ["paddingTop", Yoga.EDGE_TOP],
  ["paddingBottom", Yoga.EDGE_BOTTOM],
] as const) {
  test(`removing ${property} restores shorthand padding`, () => {
    const node = createNode();

    applyStyles(node, { padding: 2, [property]: 1 });
    node.calculateLayout();
    expect(node.getComputedPadding(edge)).toBe(1);

    applyStyles(node, { [property]: undefined });
    node.calculateLayout();
    expect(node.getComputedPadding(edge)).toBe(2);

    applyStyles(node, { [property]: 0 });
    node.calculateLayout();
    expect(node.getComputedPadding(edge)).toBe(0);
  });
}

for (const [property, getter] of [
  ["width", "getWidth"],
  ["height", "getHeight"],
  ["minHeight", "getMinHeight"],
  ["maxHeight", "getMaxHeight"],
  ["flexBasis", "getFlexBasis"],
] as const) {
  test(`${property} preserves fractional percentages`, () => {
    const node = createNode();

    applyStyles(node, { [property]: "12.5%" });

    expect(node[getter]()).toEqual({ value: 12.5, unit: Yoga.UNIT_PERCENT });
  });
}
