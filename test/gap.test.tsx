import React from "react";
import { expect, test } from "vite-plus/test";

import { Box, Text } from "../src/index.ts";
import { renderToString, renderToStringAsync } from "./helpers/render-to-string.ts";

test("gap", () => {
  const output = renderToString(
    <Box gap={1} width={3} flexWrap="wrap">
      <Text>A</Text>
      <Text>B</Text>
      <Text>C</Text>
    </Box>,
  );

  expect(output).toBe("A B\n\nC");
});

test("column gap", () => {
  const output = renderToString(
    <Box gap={1}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("A B");
});

test("row gap", () => {
  const output = renderToString(
    <Box flexDirection="column" gap={1}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("A\n\nB");
});

// Concurrent mode tests
test("gap - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box gap={1} width={3} flexWrap="wrap">
      <Text>A</Text>
      <Text>B</Text>
      <Text>C</Text>
    </Box>,
  );

  expect(output).toBe("A B\n\nC");
});

test("column gap - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box gap={1}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("A B");
});

test("row gap - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box flexDirection="column" gap={1}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("A\n\nB");
});
