import { expect, test } from "vite-plus/test";

import chalk from "../src/ansi/chalk.ts";
import { Box, Text } from "../src/index.ts";
import { renderToString } from "./helpers/render-to-string.ts";

test("row - align text to center", () => {
  const output = renderToString(
    <Box justifyContent="center" width={10}>
      <Text>Test</Text>
    </Box>,
  );

  expect(output).toBe("   Test");
});

test("row - align multiple text nodes to center", () => {
  const output = renderToString(
    <Box justifyContent="center" width={10}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("    AB");
});

test("row - align text to right", () => {
  const output = renderToString(
    <Box justifyContent="flex-end" width={10}>
      <Text>Test</Text>
    </Box>,
  );

  expect(output).toBe("      Test");
});

test("row - align multiple text nodes to right", () => {
  const output = renderToString(
    <Box justifyContent="flex-end" width={10}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("        AB");
});

test("row - align two text nodes on the edges", () => {
  const output = renderToString(
    <Box justifyContent="space-between" width={4}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("A  B");
});

test("row - space evenly two text nodes", () => {
  const output = renderToString(
    <Box justifyContent="space-evenly" width={10}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("  A   B");
});

// Yoga has a bug, where first child in a container with space-around doesn't have
// the correct X coordinate and measure function is used on that child node
test.fails("row - align two text nodes with equal space around them", () => {
  const output = renderToString(
    <Box justifyContent="space-around" width={5}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe(" A B");
});

test("row - align colored text node when text is squashed", () => {
  const output = renderToString(
    <Box justifyContent="flex-end" width={5}>
      <Text color="green">X</Text>
    </Box>,
  );

  expect(output).toBe(`    ${chalk.green("X")}`);
});

test("column - align text to center", () => {
  const output = renderToString(
    <Box flexDirection="column" justifyContent="center" height={3}>
      <Text>Test</Text>
    </Box>,
  );

  expect(output).toBe("\nTest\n");
});

test("column - align text to bottom", () => {
  const output = renderToString(
    <Box flexDirection="column" justifyContent="flex-end" height={3}>
      <Text>Test</Text>
    </Box>,
  );

  expect(output).toBe("\n\nTest");
});

test("column - align two text nodes on the edges", () => {
  const output = renderToString(
    <Box flexDirection="column" justifyContent="space-between" height={4}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("A\n\n\nB");
});

// Yoga has a bug, where first child in a container with space-around doesn't have
// the correct X coordinate and measure function is used on that child node
test.fails("column - align two text nodes with equal space around them", () => {
  const output = renderToString(
    <Box flexDirection="column" justifyContent="space-around" height={5}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("\nA\n\nB\n");
});
