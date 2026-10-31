import { expect, test } from "vite-plus/test";

import { chalk } from "#/ansi/chalk.ts";
import { Box, Text } from "#/index.ts";

import { disableTestColors, enableTestColors } from "./helpers/force-colors.ts";
import { renderToString } from "./helpers/render-to-string.ts";

test.beforeAll(() => {
  enableTestColors();
});

test.afterAll(() => {
  disableTestColors();
});

for (const isNested of [false, true]) {
  for (const [offset, width, expected] of [
    [1, 3, " 好"],
    [0, 3, "你 "],
    [1, 2, "  "],
    [0, 4, "你好"],
  ] as const) {
    test(`clipping wide text preserves its background (nested: ${isNested}, offset: ${offset}, width: ${width})`, () => {
      const content = <Text backgroundColor="blue">你好</Text>;
      const output = renderToString(
        <Box width={width} height={1} overflowX="hidden" contentOffsetX={offset}>
          <Box width={4} flexShrink={0}>
            {isNested ? <Text>{content}</Text> : content}
          </Box>
        </Box>,
      );

      expect(output).toBe(chalk.bgBlue(expected));
    });
  }
}

test("clipped halves retain their own background colors", () => {
  const output = renderToString(
    <Box width={2} height={1} overflowX="hidden" contentOffsetX={1}>
      <Box width={4} flexShrink={0}>
        <Text>
          <Text backgroundColor="blue">你</Text>
          <Text backgroundColor="red">好</Text>
        </Text>
      </Box>
    </Box>,
  );

  const expected = renderToString(
    <Text>
      <Text backgroundColor="blue"> </Text>
      <Text backgroundColor="red"> </Text>
    </Text>,
  );
  expect(output).toBe(expected);
});

test("clipping a joined emoji preserves its background and adjacent text", () => {
  const output = renderToString(
    <Box width={2} height={1} overflowX="hidden" contentOffsetX={1}>
      <Box width={3} flexShrink={0}>
        <Text>
          <Text backgroundColor="blue">👩‍💻X</Text>
        </Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(chalk.bgBlue(" X"));
});
