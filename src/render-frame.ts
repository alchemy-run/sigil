import type { PaintContext } from "#/color/paint.ts";
import { type DOMElement } from "#/dom.ts";
import { paintTree, renderAccessibleText } from "#/paint-tree.ts";
import { Canvas } from "#/screen/canvas.ts";
import { type ColorProfile } from "#/screen/index.ts";
import type { Screen } from "#/screen/screen.ts";

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

export const renderFrame = (
  node: DOMElement,
  isScreenReaderEnabled: boolean,
  options: RendererOptions = {},
): Result => {
  if (node.yogaNode) {
    if (isScreenReaderEnabled) {
      const output = renderAccessibleText(node, {
        skipStaticElements: true,
      });

      let staticOutput = "";

      if (node.staticNode) {
        staticOutput = renderAccessibleText(node.staticNode, {
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

    if (node.staticNode?.yogaNode) {
      staticOutput = new Canvas({
        width: renderDimension(node.staticNode.yogaNode.getComputedWidth()),
        height: renderDimension(node.staticNode.yogaNode.getComputedHeight()),
        colorProfile: options.colorProfile,
        paintContext: options.paintContext,
      });

      paintTree(node.staticNode, staticOutput, {
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
