import { expect, test } from "vite-plus/test";

import { Box, Text } from "../src/index.ts";
import { renderToString, renderToStringAsync } from "./helpers/render-to-string.ts";

test("direction row", () => {
  const output = renderToString(
    <Box flexDirection="row">
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("AB");
});

test("direction row reverse", () => {
  const output = renderToString(
    <Box flexDirection="row-reverse" width={4}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("  BA");
});

test("direction column", () => {
  const output = renderToString(
    <Box flexDirection="column">
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("A\nB");
});

test("direction column reverse", () => {
  const output = renderToString(
    <Box flexDirection="column-reverse" height={4}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("\n\nB\nA");
});

test("don’t squash text nodes when column direction is applied", () => {
  const output = renderToString(
    <Box flexDirection="column">
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("A\nB");
});

// Concurrent mode tests
test("direction row - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box flexDirection="row">
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("AB");
});

test("direction column - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box flexDirection="column">
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("A\nB");
});
