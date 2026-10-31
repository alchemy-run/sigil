import { expect, test } from "vite-plus/test";

import { Box, Text, render } from "#/index.ts";

import createStdout from "./helpers/create-stdout.ts";
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

for (const [property, flexDirection, separator] of [
  ["columnGap", "row", " "],
  ["rowGap", "column", "\n"],
] as const) {
  test(`removing ${property} restores gap on rerender`, () => {
    function Example({ override }: { readonly override?: number }) {
      return (
        <Box gap={2} flexDirection={flexDirection} {...{ [property]: override }}>
          <Text>A</Text>
          <Text>B</Text>
        </Box>
      );
    }

    const stdout = createStdout();
    const { rerender, unmount } = render(<Example override={1} />, {
      stdout,
      debug: true,
    });
    const lineBreak = flexDirection === "column" ? "\n" : "";

    expect(stdout.get()).toBe(`A${separator}${lineBreak}B`);
    rerender(<Example />);
    expect(stdout.get()).toBe(`A${separator.repeat(2)}${lineBreak}B`);
    rerender(<Example override={0} />);
    expect(stdout.get()).toBe(`A${lineBreak}B`);
    rerender(<Example />);
    expect(stdout.get()).toBe(`A${separator.repeat(2)}${lineBreak}B`);
    unmount();
  });
}
