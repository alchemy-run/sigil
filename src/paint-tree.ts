import { type DOMElement } from "#/dom.ts";
import { getMaxWidth } from "#/get-max-width.ts";
import { renderBackground } from "#/render-background.ts";
import { renderBorder } from "#/render-border.ts";
import type { Canvas } from "#/screen/canvas.ts";
import { serializeLine } from "#/screen/serialize.ts";
import { squashTextNodes } from "#/squash-text-nodes.ts";
import {
  hasCompatibilityText,
  structuredTextBaseStyle,
  structuredTextLines,
  wrapStructuredText,
  sampleStructuredText,
} from "#/structured-text.ts";
import type { AnsiTransformer } from "#/transform-adapter.ts";
import { Yoga } from "#/yoga/index.ts";

export const renderAccessibleText = (
  node: DOMElement,
  options: {
    parentRole?: string;
    skipStaticElements?: boolean;
  } = {},
): string => {
  if (options.skipStaticElements && node.internal_static) {
    return "";
  }

  if (node.yogaNode?.getDisplay() === Yoga.DISPLAY_NONE) {
    return "";
  }

  let output = "";

  if (node.nodeName === "ink-text") {
    output = squashTextNodes(node);
  } else if (node.nodeName === "ink-box" || node.nodeName === "ink-root") {
    const separator =
      node.style.flexDirection === "row" || node.style.flexDirection === "row-reverse" ? " " : "\n";

    const childNodes =
      node.style.flexDirection === "row-reverse" || node.style.flexDirection === "column-reverse"
        ? [...node.childNodes].reverse()
        : [...node.childNodes];

    output = childNodes
      .map((childNode) => {
        const screenReaderOutput = renderAccessibleText(childNode as DOMElement, {
          parentRole: node.internal_accessibility?.role,
          skipStaticElements: options.skipStaticElements,
        });
        return screenReaderOutput;
      })
      .filter(Boolean)
      .join(separator);
  }

  if (node.internal_accessibility) {
    const { role, state } = node.internal_accessibility;

    if (state) {
      const stateKeys = Object.keys(state) as Array<keyof typeof state>;
      const stateDescription = stateKeys.filter((key) => state[key]).join(", ");

      if (stateDescription) {
        output = `(${stateDescription}) ${output}`;
      }
    }

    if (role && role !== options.parentRole) {
      output = `${role}: ${output}`;
    }
  }

  return output;
};

// After nodes are laid out, render each to output object, which later gets rendered to terminal
export const paintTree = (
  node: DOMElement,
  output: Canvas,
  options: {
    offsetX?: number;
    offsetY?: number;
    transformers?: AnsiTransformer[];
    skipStaticElements: boolean;
  },
) => {
  const { offsetX = 0, offsetY = 0, transformers = [], skipStaticElements } = options;

  if (skipStaticElements && node.internal_static) {
    return;
  }

  const { yogaNode } = node;

  if (yogaNode) {
    if (yogaNode.getDisplay() === Yoga.DISPLAY_NONE) {
      return;
    }

    // Left and top positions in Yoga are relative to their parent node
    const x = offsetX + yogaNode.getComputedLeft();
    const y = offsetY + yogaNode.getComputedTop();

    // Transformers are functions that transform final text output of each component
    // The canvas applies explicit compatibility transformers at this boundary.
    const newTransformers = node.internal_transform
      ? [node.internal_transform, ...transformers]
      : transformers;

    if (node.nodeName === "ink-text") {
      const text = squashTextNodes(node);

      if (text.length > 0) {
        const maxWidth = getMaxWidth(yogaNode);
        const firstChildYoga = node.childNodes[0]?.yogaNode;
        const paddingX = firstChildYoga?.getComputedLeft() ?? 0;
        const paddingY = firstChildYoga?.getComputedTop() ?? 0;
        const lines = wrapStructuredText(
          structuredTextLines(node),
          maxWidth,
          node.style.textWrap ?? "wrap",
          structuredTextBaseStyle(node),
        );
        const paintBounds = {
          x: x + paddingX,
          y: y + paddingY,
          width: Math.max(
            1,
            ...lines.map((line) => line.reduce((width, cell) => width + cell.width, 0)),
          ),
          height: lines.length,
        };
        const sampled = sampleStructuredText(lines, paintBounds, output.paintContext);

        if (hasCompatibilityText(node)) {
          const textTransformers = collectTransformers(node, transformers);
          output.writeAnsi(
            paintBounds.x,
            paintBounds.y,
            sampled
              .map((line) =>
                serializeLine(line, {
                  colorProfile: output.paintContext.profile ?? "truecolor",
                  trimEnd: false,
                }),
              )
              .join("\n"),
            { transformers: textTransformers },
          );
        } else {
          output.writeCells(paintBounds.x, paintBounds.y, sampled);
        }
      }

      return;
    }

    let clipped = false;

    if (node.nodeName === "ink-box") {
      renderBackground(x, y, node, output);
      renderBorder(x, y, node, output);

      const clipHorizontally =
        node.style.overflowX === "hidden" || node.style.overflow === "hidden";
      const clipVertically = node.style.overflowY === "hidden" || node.style.overflow === "hidden";

      if (clipHorizontally || clipVertically) {
        const x1 = clipHorizontally ? x + yogaNode.getComputedBorder(Yoga.EDGE_LEFT) : undefined;

        const x2 = clipHorizontally
          ? x + yogaNode.getComputedWidth() - yogaNode.getComputedBorder(Yoga.EDGE_RIGHT)
          : undefined;

        const y1 = clipVertically ? y + yogaNode.getComputedBorder(Yoga.EDGE_TOP) : undefined;

        const y2 = clipVertically
          ? y + yogaNode.getComputedHeight() - yogaNode.getComputedBorder(Yoga.EDGE_BOTTOM)
          : undefined;

        output.clip({ x1, x2, y1, y2 });
        clipped = true;
      }
    }

    if (node.nodeName === "ink-root" || node.nodeName === "ink-box") {
      for (const childNode of node.childNodes) {
        paintTree(childNode as DOMElement, output, {
          offsetX: x,
          offsetY: y,
          transformers: newTransformers,
          skipStaticElements,
        });
      }

      if (clipped) {
        output.unclip();
      }
    }
  }
};

function collectTransformers(
  node: DOMElement,
  inherited: readonly AnsiTransformer[],
): AnsiTransformer[] {
  return [
    ...node.childNodes.flatMap((child) =>
      child.nodeName === "#text" ? [] : collectTransformers(child, []),
    ),
    ...(node.internal_transform ? [node.internal_transform] : []),
    ...inherited,
  ];
}
