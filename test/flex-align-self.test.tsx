import React from "react";
import { expect, test } from "vite-plus/test";

import { Box, Text, Newline } from "../src/index.ts";
import { renderToString } from "./helpers/render-to-string.ts";

test("row - align text to center", () => {
  const output = renderToString(
    <Box height={3}>
      <Box alignSelf="center">
        <Text>Test</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("\nTest\n");
});

test("row - align multiple text nodes to center", () => {
  const output = renderToString(
    <Box height={3}>
      <Box alignSelf="center">
        <Text>A</Text>
        <Text>B</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("\nAB\n");
});

test("row - align text to bottom", () => {
  const output = renderToString(
    <Box height={3}>
      <Box alignSelf="flex-end">
        <Text>Test</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("\n\nTest");
});

test("row - align multiple text nodes to bottom", () => {
  const output = renderToString(
    <Box height={3}>
      <Box alignSelf="flex-end">
        <Text>A</Text>
        <Text>B</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("\n\nAB");
});

test("column - align text to center", () => {
  const output = renderToString(
    <Box flexDirection="column" width={10}>
      <Box alignSelf="center">
        <Text>Test</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("   Test");
});

test("column - align text to right", () => {
  const output = renderToString(
    <Box flexDirection="column" width={10}>
      <Box alignSelf="flex-end">
        <Text>Test</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("      Test");
});

test("column - align self stretch", () => {
  const output = renderToString(
    <Box flexDirection="column" width={7}>
      <Box alignSelf="stretch" borderStyle="single">
        <Text>X</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("┌─────┐\n│X    │\n└─────┘");
});

test("row - align self stretch", () => {
  const output = renderToString(
    <Box height={5}>
      <Box alignSelf="stretch" borderStyle="single">
        <Text>X</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("┌─┐\n│X│\n│ │\n│ │\n└─┘");
});

test("row - align self baseline", () => {
  const output = renderToString(
    <Box alignItems="flex-end" height={3}>
      <Text>
        A
        <Newline />B
      </Text>
      <Box alignSelf="baseline">
        <Text>X</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("AX\nB\n");
});
