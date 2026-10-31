import { expect, test } from "vite-plus/test";

import { Box, Text } from "#/index.ts";

import { renderToString } from "./helpers/render-to-string.ts";

for (const [wrap, expected] of [
  ["truncate", "你…"],
  ["truncate-end", "你…"],
  ["truncate-middle", "你…"],
  ["truncate-start", "…界"],
] as const) {
  test(`${wrap} keeps wide characters that fit`, () => {
    const output = renderToString(
      <Box width={4}>
        <Text wrap={wrap}>你好世界</Text>
      </Box>,
    );

    expect(output).toBe(expected);
  });

  test(`${wrap} preserves the adjacent column`, () => {
    const output = renderToString(
      <Box width={5}>
        <Text wrap={wrap}>你好世界</Text>
        <Box flexShrink={0}>
          <Text>|</Text>
        </Box>
      </Box>,
    );

    expect(output).toBe(`${expected} |`);
  });
}

test("text that fits does not reserve extra width", () => {
  const output = renderToString(
    <Box width={10}>
      <Text wrap="truncate-middle">你好</Text>
      <Text>|</Text>
    </Box>,
  );

  expect(output).toBe("你好|");
});
