import { expect, test } from "vite-plus/test";

import { Box, Text, VirtualList } from "#/index.ts";
import { virtualScrollWindow } from "#/virtual-scroll.ts";

import { renderToString } from "./helpers/render-to-string.ts";

// Five items stacked as rows 0, 1-3, 4-5, 6-9, 10.
const heights = [1, 3, 2, 4, 1];

const window = (scrollTop: number, viewportHeight: number, focusedIndex?: number) =>
  virtualScrollWindow({
    count: heights.length,
    itemHeight: (index) => heights[index],
    viewportHeight,
    scrollTop,
    focusedIndex,
  });

test("virtualScrollWindow - windows the items intersecting the viewport", () => {
  expect(window(0, 4)).toEqual({
    start: 0,
    end: 2,
    scrollTop: 0,
    maxScrollTop: 7,
    totalHeight: 11,
    offset: 0,
    hiddenAbove: 0,
    hiddenBelow: 7,
  });

  // Rows 2-5: the tail of item 1 and all of item 2.
  expect(window(2, 4)).toMatchObject({
    start: 1,
    end: 3,
    offset: -1,
    hiddenAbove: 2,
    hiddenBelow: 5,
  });
});

test("virtualScrollWindow - clamps the requested position to the scrollable range", () => {
  expect(window(50, 4)).toMatchObject({
    scrollTop: 7,
    start: 3,
    end: 5,
    offset: -1,
    hiddenBelow: 0,
  });
  expect(window(-3, 4).scrollTop).toBe(0);
  expect(window(3, 20)).toMatchObject({ scrollTop: 0, start: 0, end: 5, maxScrollTop: 0 });
});

test("virtualScrollWindow - moves the minimum needed to show the focused item", () => {
  // Item 2 occupies rows 4-5; a 4-row viewport aligns its bottom edge (rows 2-5).
  expect(window(0, 4, 2)).toMatchObject({ scrollTop: 2, start: 1, end: 3, offset: -1 });
  // Item 3 occupies rows 6-9; a 4-row viewport ends up at row 6.
  expect(window(0, 4, 3)).toMatchObject({ scrollTop: 6, start: 3, end: 4, offset: 0 });
  // Scrolling back to item 0 aligns its top.
  expect(window(6, 4, 0)).toMatchObject({ scrollTop: 0, start: 0 });
  // An item that is already visible does not move the viewport.
  expect(window(3, 4, 2).scrollTop).toBe(3);
  // An item taller than the viewport is aligned to its top.
  expect(window(0, 2, 3)).toMatchObject({ scrollTop: 6, start: 3, end: 4 });
  // Out-of-range focus is ignored.
  expect(window(2, 4, 9).scrollTop).toBe(2);
  expect(window(2, 4, -1).scrollTop).toBe(2);
});

test("virtualScrollWindow - handles an empty list", () => {
  expect(
    virtualScrollWindow({ count: 0, itemHeight: () => 1, viewportHeight: 5, scrollTop: 3 }),
  ).toEqual({
    start: 0,
    end: 0,
    scrollTop: 0,
    maxScrollTop: 0,
    totalHeight: 0,
    offset: 0,
    hiddenAbove: 0,
    hiddenBelow: 0,
  });
});

const items = Array.from({ length: 20 }, (_, index) => `item ${index}`);

test("VirtualList - renders only the rows inside a fixed viewport", () => {
  const rendered: number[] = [];
  const output = renderToString(
    <VirtualList
      items={items}
      height={3}
      itemHeight={() => 1}
      renderItem={(item, index) => {
        rendered.push(index);
        return <Text>{item}</Text>;
      }}
    />,
  );

  expect(output).toBe("item 0\nitem 1\nitem 2");
  expect(rendered).toEqual([0, 1, 2]);
});

test("VirtualList - keeps the focused item visible", () => {
  const output = renderToString(
    <VirtualList
      items={items}
      height={3}
      itemHeight={() => 1}
      focusedIndex={10}
      renderItem={(item) => <Text>{item}</Text>}
    />,
  );

  expect(output).toBe("item 8\nitem 9\nitem 10");
});

test("VirtualList - clips a partially scrolled multi-row item", () => {
  const output = renderToString(
    <VirtualList
      items={items.slice(0, 4)}
      height={3}
      itemHeight={() => 2}
      focusedIndex={1}
      renderItem={(item) => (
        <Box flexDirection="column">
          <Text>{item} top</Text>
          <Text>{item} bottom</Text>
        </Box>
      )}
    />,
  );

  expect(output).toBe("item 0 bottom\nitem 1 top\nitem 1 bottom");
});

test("VirtualList - shrinks to the rows its container leaves over", () => {
  const output = renderToString(
    <Box flexDirection="column" maxHeight={5}>
      <Box flexShrink={0}>
        <Text>header</Text>
      </Box>
      <VirtualList
        items={items}
        itemHeight={() => 1}
        focusedIndex={19}
        renderItem={(item) => <Text>{item}</Text>}
      />
      <Box flexShrink={0}>
        <Text>footer</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("header\nitem 17\nitem 18\nitem 19\nfooter");
});

test("VirtualList - follows the focus only once the viewport is measured", () => {
  // A zero-row pre-measurement pass must not pin the focused item to the top:
  // after measuring, item 3 is brought into a 3-row viewport bottom-aligned.
  const output = renderToString(
    <Box flexDirection="column" maxHeight={5}>
      <Box flexShrink={0}>
        <Text>header</Text>
      </Box>
      <VirtualList
        items={items}
        itemHeight={() => 1}
        focusedIndex={3}
        renderItem={(item) => <Text>{item}</Text>}
      />
      <Box flexShrink={0}>
        <Text>footer</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("header\nitem 1\nitem 2\nitem 3\nfooter");
});

test("VirtualList - stays compact when its content fits", () => {
  const output = renderToString(
    <Box flexDirection="column" maxHeight={10}>
      <Box flexShrink={0}>
        <Text>header</Text>
      </Box>
      <VirtualList
        items={items.slice(0, 2)}
        itemHeight={() => 1}
        renderItem={(item) => <Text>{item}</Text>}
      />
      <Box flexShrink={0}>
        <Text>footer</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("header\nitem 0\nitem 1\nfooter");
});
