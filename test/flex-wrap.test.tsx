import { expect, test } from "vite-plus/test";

import { Box, Text } from "#/index.ts";

import { renderToString } from "./helpers/render-to-string.ts";

test("row - no wrap", () => {
  const output = renderToString(
    <Box width={2}>
      <Text>A</Text>
      <Text>BC</Text>
    </Box>,
  );

  expect(output).toBe("BC\n");
});

test("column - no wrap", () => {
  const output = renderToString(
    <Box flexDirection="column" height={2}>
      <Text>A</Text>
      <Text>B</Text>
      <Text>C</Text>
    </Box>,
  );

  expect(output).toBe("B\nC");
});

test("row - wrap content", () => {
  const output = renderToString(
    <Box width={2} flexWrap="wrap">
      <Text>A</Text>
      <Text>BC</Text>
    </Box>,
  );

  expect(output).toBe("A\nBC");
});

test("column - wrap content", () => {
  const output = renderToString(
    <Box flexDirection="column" height={2} flexWrap="wrap">
      <Text>A</Text>
      <Text>B</Text>
      <Text>C</Text>
    </Box>,
  );

  expect(output).toBe("AC\nB");
});

test("column - wrap content reverse", () => {
  const output = renderToString(
    <Box flexDirection="column" height={2} width={3} flexWrap="wrap-reverse">
      <Text>A</Text>
      <Text>B</Text>
      <Text>C</Text>
    </Box>,
  );

  expect(output).toBe(" CA\n  B");
});

test("row - wrap content reverse", () => {
  const output = renderToString(
    <Box height={3} width={2} flexWrap="wrap-reverse">
      <Text>A</Text>
      <Text>B</Text>
      <Text>C</Text>
    </Box>,
  );

  expect(output).toBe("\nC\nAB");
});
