import { expect, test } from "vite-plus/test";

import { Box, Text } from "#/index.ts";

import { renderToString } from "./helpers/render-to-string.ts";

for (const wrap of ["truncate", "truncate-start", "truncate-middle", "truncate-end"] as const) {
  test(`${wrap} renders text in an absolute box without an explicit width`, () => {
    const output = renderToString(
      <Box height={2}>
        <Box position="absolute">
          <Text wrap={wrap}>hello</Text>
        </Box>
      </Box>,
    );

    expect(output).toBe("hello\n");
  });
}
