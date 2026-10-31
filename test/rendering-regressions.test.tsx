import { expect, test } from "vite-plus/test";

import { Box, Text } from "#/index.ts";

import { renderToString } from "./helpers/render-to-string.ts";

test("clipping a wide character at the right edge preserves the adjacent marker column", () => {
  const output = renderToString(
    <Box>
      <Box width={4} height={1} overflowX="hidden">
        <Box width={7} flexShrink={0}>
          <Text>X你好世</Text>
        </Box>
      </Box>
      <Text>|</Text>
    </Box>,
  );

  expect(output).toBe("X你 |");
});

test("clipping a wide character at the left edge preserves the adjacent marker column", () => {
  const output = renderToString(
    <Box>
      <Box width={3} height={1} overflowX="hidden" contentOffsetX={1}>
        <Box width={4} flexShrink={0}>
          <Text>你好</Text>
        </Box>
      </Box>
      <Text>|</Text>
    </Box>,
  );

  expect(output).toBe(" 好|");
});
