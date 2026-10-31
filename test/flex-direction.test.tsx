import { expect, test } from "vite-plus/test";

import { Box, Text, render } from "#/index.ts";

import createStdout from "./helpers/create-stdout.ts";
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

test("don't squash text nodes when column direction is applied", () => {
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

test("undefined direction uses the default row layout", () => {
  const output = renderToString(
    <Box flexDirection={undefined}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("AB");
});

test("undefined direction uses row separators for screen readers", () => {
  const output = renderToString(
    <Box flexDirection={undefined}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
    { isScreenReaderEnabled: true },
  );

  expect(output).toBe("A B");
});

test("setting direction to undefined restores the default row layout", () => {
  function Example({ direction }: { readonly direction?: "column" }) {
    return (
      <Box flexDirection={direction}>
        <Text>A</Text>
        <Text>B</Text>
      </Box>
    );
  }

  const stdout = createStdout();
  const { rerender, unmount } = render(<Example direction="column" />, {
    stdout,
    debug: true,
  });

  expect(stdout.get()).toBe("A\nB");
  rerender(<Example />);
  expect(stdout.get()).toBe("AB");
  unmount();
});
