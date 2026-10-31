import type { PaintContext } from "#/color/paint.ts";
import { type DOMElement } from "#/dom.ts";
import { paintTree, renderAccessibleText } from "#/paint-tree.ts";
import { Canvas } from "#/screen/canvas.ts";
import { type ColorProfile } from "#/screen/index.ts";
import type { Screen } from "#/screen/screen.ts";
import { Yoga } from "#/yoga/index.ts";

type Result = {
  screen?: Screen;
  staticScreen?: Screen;
  accessibleText?: string;
  staticAccessibleText?: string;
};

type RendererOptions = {
  colorProfile?: ColorProfile;
  paintContext?: PaintContext;
};

const renderDimension = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.ceil(value)) : 0;

// Static output is painted separately, so ancestor visibility must be checked explicitly.
const getVisibleStaticNode = (node: DOMElement | undefined): DOMElement | undefined => {
  for (let ancestor = node; ancestor; ancestor = ancestor.parentNode) {
    if (ancestor.yogaNode?.getDisplay() === Yoga.DISPLAY_NONE) {
      return undefined;
    }
  }

  return node;
};

export const renderFrame = (
  node: DOMElement,
  isScreenReaderEnabled: boolean,
  options: RendererOptions = {},
): Result => {
  if (node.yogaNode) {
    const staticNode = getVisibleStaticNode(node.staticNode);

    if (isScreenReaderEnabled) {
      const output = renderAccessibleText(node, {
        skipStaticElements: true,
      });

      let staticOutput = "";

      if (staticNode) {
        staticOutput = renderAccessibleText(staticNode, {
          skipStaticElements: false,
        });
      }

      return {
        accessibleText: output,
        staticAccessibleText: staticOutput,
      };
    }

    const output = new Canvas({
      width: renderDimension(node.yogaNode.getComputedWidth()),
      height: renderDimension(node.yogaNode.getComputedHeight()),
      colorProfile: options.colorProfile,
      paintContext: options.paintContext,
    });

    paintTree(node, output, {
      skipStaticElements: true,
    });

    let staticOutput;

    if (staticNode?.yogaNode) {
      const { yogaNode } = staticNode;
      // Include the Static box's offset and trailing margins so they survive painting.
      staticOutput = new Canvas({
        width: renderDimension(
          yogaNode.getComputedLeft() +
            yogaNode.getComputedWidth() +
            yogaNode.getComputedMargin(Yoga.EDGE_RIGHT),
        ),
        height: renderDimension(
          yogaNode.getComputedTop() +
            yogaNode.getComputedHeight() +
            yogaNode.getComputedMargin(Yoga.EDGE_BOTTOM),
        ),
        colorProfile: options.colorProfile,
        paintContext: options.paintContext,
      });

      paintTree(staticNode, staticOutput, {
        skipStaticElements: false,
      });
    }

    return {
      screen: output.finish(),
      ...(staticOutput ? { staticScreen: staticOutput.finish() } : {}),
    };
  }

  return {
    accessibleText: "",
  };
};
