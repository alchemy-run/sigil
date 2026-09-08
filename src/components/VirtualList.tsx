/** @jsxImportSource react */
import { useEffect, useLayoutEffect, useRef, useState, type Key, type ReactNode } from "react";

import { Box } from "#/components/Box.tsx";
import { addLayoutListener, type DOMElement } from "#/dom.ts";
import { useVirtualScroll } from "#/hooks/use-virtual-scroll.ts";

export type Props<Item> = {
  /**
	Items to window over.
	*/
  readonly items: ReadonlyArray<Item>;

  /**
	Height of an item in rows. It must match what `renderItem` produces for it:
	the window is computed from these numbers, never from the rendered output.
	*/
  readonly itemHeight: (item: Item, index: number) => number;

  /**
	Render one item. Only items intersecting the viewport are rendered.
	*/
  readonly renderItem: (item: Item, index: number) => ReactNode;

  /**
	React key for an item. Defaults to its index.
	*/
  readonly getKey?: (item: Item, index: number) => Key;

  /**
	Item to keep fully visible. When it changes, the list scrolls as little as
	necessary to show it.
	*/
  readonly focusedIndex?: number;

  /**
	Viewport height in rows. When omitted the list takes the height of its
	content and shrinks to whatever space its container leaves: bound an
	ancestor (`height` or `maxHeight`) and give the siblings that must keep
	their size `flexShrink={0}`.
	*/
  readonly height?: number;
};

const rootOf = (node: DOMElement | null): DOMElement | undefined => {
  let current = node;
  while (current?.parentNode) {
    current = current.parentNode;
  }
  return current?.nodeName === "ink-root" ? current : undefined;
};

/**
A vertically windowed list: only the items intersecting the viewport are
rendered, inside a clipped box that scrolls by whole rows. Items may have
different heights, and the item at the top edge may be partially visible.

Until the first layout pass has measured the viewport, every item is rendered
inside the clipped box so the first frame already looks right.
*/
export function VirtualList<Item>({
  items,
  itemHeight,
  renderItem,
  getKey,
  focusedIndex,
  height,
}: Props<Item>) {
  const ref = useRef<DOMElement>(null);
  const [measured, setMeasured] = useState<number>();

  const measure = () => {
    const next = ref.current?.yogaNode?.getComputedHeight();
    if (next !== undefined) {
      setMeasured((previous) => (previous === next ? previous : next));
    }
  };

  // Yoga has laid out the tree by the time layout effects run, so the height
  // this box ended up with is readable synchronously after every commit.
  useLayoutEffect(() => {
    if (height === undefined) measure();
  });

  // Sibling-driven changes (a resize, chrome growing) re-layout without
  // re-rendering this component; follow the root's layout commits for those.
  useEffect(() => {
    if (height !== undefined) return;
    const root = rootOf(ref.current);
    return root ? addLayoutListener(root, measure) : undefined;
  });

  const viewportHeight = height ?? measured;
  const windowed = viewportHeight !== undefined;
  const window = useVirtualScroll({
    count: items.length,
    itemHeight: (index) => itemHeight(items[index]!, index),
    viewportHeight: viewportHeight ?? 0,
    // Following the focus against an unmeasured (zero-row) viewport would pin
    // the item to the top; wait for the real height so it moves minimally.
    focusedIndex: windowed ? focusedIndex : undefined,
  });
  const start = windowed ? window.start : 0;
  const end = windowed ? window.end : items.length;
  const offset = windowed ? window.offset : 0;

  return (
    <Box
      ref={ref}
      flexDirection="column"
      overflowY="hidden"
      {...(height === undefined
        ? { height: window.totalHeight, minHeight: 0, flexShrink: 1 }
        : { height, flexShrink: 0 })}
    >
      <Box flexDirection="column" flexShrink={0} marginTop={offset}>
        {items.slice(start, end).map((item, sliceIndex) => {
          const index = start + sliceIndex;
          return (
            <Box key={getKey ? getKey(item, index) : index} flexDirection="column" flexShrink={0}>
              {renderItem(item, index)}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
