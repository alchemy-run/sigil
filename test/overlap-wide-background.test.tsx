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

for (const glyph of ["你", "👩‍💻"]) {
  for (const left of [0, 1]) {
    test(`overwriting ${glyph} cell ${left} preserves the other cell's background`, () => {
      const output = renderToString(
        <Box width={3} height={1}>
          <Text backgroundColor="blue">{glyph}Z</Text>
          <Box position="absolute" left={left} top={0}>
            <Text>X</Text>
          </Box>
        </Box>,
      );
      // Unlike upstream Ink, an overlay without its own background composes
      // over the cell beneath it, so `X` keeps the wide character's blue.
      const expected = chalk.bgBlue(left === 0 ? "X Z" : " XZ");

      expect(output).toBe(expected);
    });
  }
}

for (const replacement of ["XY", "好"]) {
  test(`fully overwriting a wide character with ${replacement} replaces its styles`, () => {
    const output = renderToString(
      <Box width={3} height={1}>
        <Text backgroundColor="blue">你Z</Text>
        <Box position="absolute" left={0} top={0}>
          <Text backgroundColor="red">{replacement}</Text>
        </Box>
      </Box>,
    );
    const expected = renderToString(
      <Text>
        <Text backgroundColor="red">{replacement}</Text>
        <Text backgroundColor="blue">Z</Text>
      </Text>,
    );

    expect(output).toBe(expected);
  });
}

test("an overlay crossing two wide characters preserves both exposed backgrounds", () => {
  const output = renderToString(
    <Box width={4} height={1}>
      <Text>
        <Text backgroundColor="blue">你</Text>
        <Text backgroundColor="green">好</Text>
      </Text>
      <Box position="absolute" left={1} top={0}>
        <Text backgroundColor="red">XY</Text>
      </Box>
    </Box>,
  );
  const expected = renderToString(
    <Text>
      <Text backgroundColor="blue"> </Text>
      <Text backgroundColor="red">XY</Text>
      <Text backgroundColor="green"> </Text>
    </Text>,
  );

  expect(output).toBe(expected);
});
