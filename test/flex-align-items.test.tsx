import { expect, test } from "vite-plus/test";

import { Box, Text, Newline } from "#/index.ts";

import { renderToString } from "./helpers/render-to-string.ts";

test("row - align text to center", () => {
  const output = renderToString(
    <Box alignItems="center" height={3}>
      <Text>Test</Text>
    </Box>,
  );

  expect(output).toBe("\nTest\n");
});

test("row - align multiple text nodes to center", () => {
  const output = renderToString(
    <Box alignItems="center" height={3}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("\nAB\n");
});

test("row - align text to bottom", () => {
  const output = renderToString(
    <Box alignItems="flex-end" height={3}>
      <Text>Test</Text>
    </Box>,
  );

  expect(output).toBe("\n\nTest");
});

test("row - align multiple text nodes to bottom", () => {
  const output = renderToString(
    <Box alignItems="flex-end" height={3}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("\n\nAB");
});

test("column - align text to center", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="center" width={10}>
      <Text>Test</Text>
    </Box>,
  );

  expect(output).toBe("   Test");
});

test("column - align text to right", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="flex-end" width={10}>
      <Text>Test</Text>
    </Box>,
  );

  expect(output).toBe("      Test");
});

test("row - align items stretch", () => {
  const output = renderToString(
    <Box alignItems="stretch" height={5}>
      <Box borderStyle="single">
        <Text>X</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("┌─┐\n│X│\n│ │\n│ │\n└─┘");
});

test("row - default align items stretches children", () => {
  const output = renderToString(
    <Box height={5}>
      <Box borderStyle="single">
        <Text>X</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("┌─┐\n│X│\n│ │\n│ │\n└─┘");
});

test("row - align text to baseline", () => {
  const output = renderToString(
    <Box alignItems="baseline" height={3}>
      <Text>
        A
        <Newline />B
      </Text>
      <Text>X</Text>
    </Box>,
  );

  expect(output).toBe("A\nBX\n");
});
