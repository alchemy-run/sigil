import { Yoga, type Node as YogaNode } from "#/yoga/index.ts";

export const getMaxWidth = (yogaNode: YogaNode) => {
  return (
    yogaNode.getComputedWidth() -
    yogaNode.getComputedPadding(Yoga.EDGE_LEFT) -
    yogaNode.getComputedPadding(Yoga.EDGE_RIGHT) -
    yogaNode.getComputedBorder(Yoga.EDGE_LEFT) -
    yogaNode.getComputedBorder(Yoga.EDGE_RIGHT)
  );
};
