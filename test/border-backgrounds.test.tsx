import React from "react";
import { expect, test } from "vite-plus/test";

import { Box, Text } from "../src/index.ts";
import { enableTestColors, disableTestColors } from "./helpers/force-colors.ts";
import { renderToString } from "./helpers/render-to-string.ts";

// Ensure Chalk emits colors in non-TTY test environment
test.beforeAll(() => {
  enableTestColors();
});

test.afterAll(() => {
  disableTestColors();
});

test("border with background color", () => {
  const output = renderToString(
    <Box borderStyle="single" borderColor="white" borderBackgroundColor="blue">
      <Box width={4}>
        <Text>Test</Text>
      </Box>
    </Box>,
  );

  // Verify the border characters are rendered
  expect(output.includes("┌")).toBe(true);
  expect(output.includes("┐")).toBe(true);
  expect(output.includes("└")).toBe(true);
  expect(output.includes("┘")).toBe(true);
  expect(output.includes("Test")).toBe(true);

  // Verify background color escape for blue is present
  // Named blue background => ESC[44m
  expect(output.includes("\u001B[44m")).toBe(true);
});

test("border with different background colors per side", () => {
  const output = renderToString(
    <Box
      borderStyle="single"
      borderTopBackgroundColor="red"
      borderBottomBackgroundColor="blue"
      borderLeftBackgroundColor="green"
      borderRightBackgroundColor="yellow"
    >
      <Box width={4}>
        <Text>Test</Text>
      </Box>
    </Box>,
  );

  // Verify the border characters are rendered
  expect(output.includes("┌")).toBe(true);
  expect(output.includes("┐")).toBe(true);
  expect(output.includes("└")).toBe(true);
  expect(output.includes("┘")).toBe(true);
  expect(output.includes("Test")).toBe(true);

  // Verify background colors for each named color are present
  // red => 41, green => 42, yellow => 43, blue => 44
  expect(output.includes("\u001B[41m")).toBe(true);
  expect(output.includes("\u001B[42m")).toBe(true);
  expect(output.includes("\u001B[43m")).toBe(true);
  expect(output.includes("\u001B[44m")).toBe(true);
});

test("border background color fallback to general borderBackgroundColor", () => {
  const output = renderToString(
    <Box borderStyle="single" borderBackgroundColor="magenta" borderTopBackgroundColor="cyan">
      <Box width={4}>
        <Text>Test</Text>
      </Box>
    </Box>,
  );

  // Verify the border characters are rendered
  expect(output.includes("┌")).toBe(true);
  expect(output.includes("┐")).toBe(true);
  expect(output.includes("└")).toBe(true);
  expect(output.includes("┘")).toBe(true);
  expect(output.includes("Test")).toBe(true);

  // Verify cyan (46) and magenta (45) backgrounds appear
  expect(output.includes("\u001B[46m")).toBe(true);
  expect(output.includes("\u001B[45m")).toBe(true);
});

test("vertical border background does not bleed into content rows", () => {
  const output = renderToString(
    <Box borderStyle="classic" borderBackgroundColor="cyan" alignSelf="flex-start" width={12}>
      <Text>Text longer than the Box width, so will definitely wrap.</Text>
    </Box>,
  );

  const bgCyanPattern = "\u001B\\[46m";
  const bgResetPattern = "\u001B\\[49m";
  const tableBorderChar = "|";
  const tableBorderPattern = bgCyanPattern + tableBorderChar + bgResetPattern;
  const contentRowPattern = new RegExp(`^${tableBorderPattern}.*${tableBorderPattern}$$`);

  const tableRows = output.split("\n");
  const contentRows = tableRows.slice(1, -1);
  for (const contentRow of contentRows) {
    expect(contentRow).toMatch(contentRowPattern);
  }
});

test("foreground, background and dim combine correctly", () => {
  const output = renderToString(
    <Box
      borderTopDimColor
      borderStyle="single"
      borderTopColor="red"
      borderTopBackgroundColor="cyan"
      alignSelf="flex-start"
    >
      <Text>Hi</Text>
    </Box>,
  );

  // Expect red FG (31), cyan BG (46) and dim (2) to appear
  expect(output.includes("\u001B[31m")).toBe(true);
  expect(output.includes("\u001B[46m")).toBe(true);
  expect(output.includes("\u001B[2m")).toBe(true);
});
