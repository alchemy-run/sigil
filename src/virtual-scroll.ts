/**
Windowing math shared by `useVirtualScroll` and `<VirtualList>`.

Items are stacked vertically and measured in terminal rows. The viewport shows
`viewportHeight` rows of that stack starting `scrollTop` rows from the top.
*/
export type VirtualScrollOptions = {
  /**
	Number of items in the list.
	*/
  readonly count: number;

  /**
	Height of the item at `index` in rows. It must match what the item renders:
	the window is computed from these numbers, never from the rendered output.
	*/
  readonly itemHeight: (index: number) => number;

  /**
	Rows available to show items.
	*/
  readonly viewportHeight: number;

  /**
	Requested distance of the viewport from the top of the list in rows. It is
	clamped to the scrollable range and then moved as little as necessary to keep
	`focusedIndex` fully visible.
	*/
  readonly scrollTop: number;

  /**
	Item that must stay fully visible. An item taller than the viewport is aligned
	to the top. Out-of-range values are ignored.
	*/
  readonly focusedIndex?: number;
};

export type VirtualScrollWindow = {
  /**
	Index of the first item that intersects the viewport.
	*/
  readonly start: number;

  /**
	Index after the last item that intersects the viewport.
	*/
  readonly end: number;

  /**
	Effective distance of the viewport from the top of the list in rows.
	*/
  readonly scrollTop: number;

  /**
	Largest `scrollTop` that still fills the viewport.
	*/
  readonly maxScrollTop: number;

  /**
	Height of every item combined in rows.
	*/
  readonly totalHeight: number;

  /**
	Position of the `start` item relative to the top of the viewport. Zero or
	negative: a negative value means the item is partially scrolled out above.
	*/
  readonly offset: number;

  /**
	Rows scrolled out above the viewport.
	*/
  readonly hiddenAbove: number;

  /**
	Rows left below the viewport.
	*/
  readonly hiddenBelow: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const wholeRows = (value: number): number => Math.max(0, Math.floor(value)) || 0;

/**
Compute which items intersect a viewport over a vertical stack of items.
*/
export const virtualScrollWindow = (options: VirtualScrollOptions): VirtualScrollWindow => {
  const count = wholeRows(options.count);
  const viewportHeight = wholeRows(options.viewportHeight);

  const tops: number[] = [];
  let totalHeight = 0;
  for (let index = 0; index < count; index++) {
    tops.push(totalHeight);
    totalHeight += wholeRows(options.itemHeight(index));
  }
  const bottomOf = (index: number): number => (index + 1 < count ? tops[index + 1]! : totalHeight);

  const maxScrollTop = Math.max(0, totalHeight - viewportHeight);
  let scrollTop = clamp(Math.floor(options.scrollTop) || 0, 0, maxScrollTop);

  const focused = options.focusedIndex;
  if (focused !== undefined && Number.isInteger(focused) && focused >= 0 && focused < count) {
    const top = tops[focused]!;
    const bottom = bottomOf(focused);
    if (top < scrollTop) {
      scrollTop = top;
    } else if (bottom > scrollTop + viewportHeight) {
      // Align the bottom edge; an item taller than the viewport shows its top.
      scrollTop = Math.min(top, bottom - viewportHeight);
    }
    scrollTop = clamp(scrollTop, 0, maxScrollTop);
  }

  const viewportBottom = scrollTop + viewportHeight;
  let start = 0;
  while (start < count && bottomOf(start) <= scrollTop) start++;
  let end = start;
  while (end < count && tops[end]! < viewportBottom) end++;

  return {
    start,
    end,
    scrollTop,
    maxScrollTop,
    totalHeight,
    offset: start < end ? tops[start]! - scrollTop : 0,
    hiddenAbove: scrollTop,
    hiddenBelow: Math.max(0, totalHeight - viewportBottom),
  };
};
