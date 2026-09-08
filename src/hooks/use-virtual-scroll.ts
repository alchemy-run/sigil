import { useCallback, useEffect, useState } from "react";

import {
  virtualScrollWindow,
  type VirtualScrollOptions,
  type VirtualScrollWindow,
} from "#/virtual-scroll.ts";

export type UseVirtualScrollOptions = Omit<VirtualScrollOptions, "scrollTop">;

export type UseVirtualScrollResult = VirtualScrollWindow & {
  /**
	Scroll so the viewport starts `top` rows from the top of the list.
	*/
  readonly scrollTo: (top: number) => void;

  /**
	Scroll by `delta` rows; negative values scroll up.
	*/
  readonly scrollBy: (delta: number) => void;
};

/**
A React hook that owns the scroll position of a windowed list and returns which
items to render for it. The position is clamped to the scrollable range and,
while `focusedIndex` is set, moved as little as necessary to keep that item
fully visible. Render the items in `[start, end)` inside an `overflowY="hidden"`
box of `viewportHeight` rows, shifted up by `offset` rows.

`<VirtualList>` wraps this hook; use it directly to draw your own chrome such
as overflow markers or a scrollbar around the window.

@example
```tsx
import { Box, Text, useVirtualScroll } from "@alchemy.run/sigil";

const Example = ({ lines, cursor }: { lines: string[]; cursor: number }) => {
	const { start, end, offset, hiddenAbove, hiddenBelow } = useVirtualScroll({
		count: lines.length,
		itemHeight: () => 1,
		viewportHeight: 10,
		focusedIndex: cursor,
	});

	return (
		<Box flexDirection="column">
			<Text dimColor>{hiddenAbove > 0 ? `↑ ${hiddenAbove} more` : ""}</Text>
			<Box flexDirection="column" height={10} overflowY="hidden">
				<Box flexDirection="column" flexShrink={0} marginTop={offset}>
					{lines.slice(start, end).map((line, index) => (
						<Text key={start + index} inverse={start + index === cursor}>
							{line}
						</Text>
					))}
				</Box>
			</Box>
			<Text dimColor>{hiddenBelow > 0 ? `↓ ${hiddenBelow} more` : ""}</Text>
		</Box>
	);
};
```
*/
export const useVirtualScroll = (options: UseVirtualScrollOptions): UseVirtualScrollResult => {
  const [position, setPosition] = useState(0);
  const window = virtualScrollWindow({ ...options, scrollTop: position });

  // Persist clamping and follow-focus corrections so the next scroll starts
  // from where the viewport actually is, not from the stale request.
  useEffect(() => {
    if (window.scrollTop !== position) {
      setPosition(window.scrollTop);
    }
  }, [window.scrollTop, position]);

  const scrollTo = useCallback((top: number) => {
    setPosition(top);
  }, []);

  const scrollBy = useCallback((delta: number) => {
    setPosition((current) => current + delta);
  }, []);

  return { ...window, scrollTo, scrollBy };
};
