import { expect, test } from "vite-plus/test";

import { Box, Text, render } from "#/index.ts";

import createStdout from "./helpers/create-stdout.ts";
import { renderToString, renderToStringAsync } from "./helpers/render-to-string.ts";

test("absolute position with top and left offsets", () => {
  const output = renderToString(
    <Box width={5} height={3}>
      <Box position="absolute" top={1} left={2}>
        <Text>X</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("\n  X\n");
});

test("absolute position with bottom and right offsets", () => {
  const output = renderToString(
    <Box width={6} height={4}>
      <Box position="absolute" bottom={1} right={1}>
        <Text>X</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("\n\n    X\n");
});

test("absolute position with percentage offsets", () => {
  const output = renderToString(
    <Box width={6} height={4}>
      <Box position="absolute" top="50%" left="50%">
        <Text>X</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("\n\n   X\n");
});

test("absolute position with percentage bottom and right offsets", () => {
  const output = renderToString(
    <Box width={6} height={4}>
      <Box position="absolute" bottom="50%" right="50%">
        <Text>X</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("\n  X\n\n");
});

test("relative position offsets visual position while keeping flow", () => {
  const output = renderToString(
    <Box width={5}>
      <Box position="relative" left={2}>
        <Text>A</Text>
      </Box>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe(" BA");
});

test("static position ignores offsets", () => {
  const output = renderToString(
    <Box width={5}>
      <Box position="static" left={2}>
        <Text>A</Text>
      </Box>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("AB");
});

test("static position ignores percentage offsets", () => {
  const output = renderToString(
    <Box width={5}>
      <Box position="static" left="50%">
        <Text>A</Text>
      </Box>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("AB");
});

test("clears top offset on rerender", () => {
  const stdout = createStdout();

  function Test({ top }: { readonly top?: number }) {
    return (
      <Box width={5} height={3}>
        <Box position="absolute" top={top} left={2}>
          <Text>X</Text>
        </Box>
      </Box>
    );
  }

  const { rerender } = render(<Test top={1} />, {
    stdout,
    debug: true,
  });

  expect(stdout.write.mock.lastCall![0]).toBe("\n  X\n");

  rerender(<Test top={undefined} />);
  expect(stdout.write.mock.lastCall![0]).toBe("  X\n\n");
});

test("clears percentage top and left offsets on rerender", () => {
  const stdout = createStdout();

  function Test({ top, left }: { readonly top?: string; readonly left?: string }) {
    return (
      <Box width={6} height={4}>
        <Box position="absolute" top={top} left={left}>
          <Text>X</Text>
        </Box>
      </Box>
    );
  }

  const { rerender } = render(<Test top="50%" left="50%" />, {
    stdout,
    debug: true,
  });

  expect(stdout.write.mock.lastCall![0]).toBe("\n\n   X\n");

  rerender(<Test top={undefined} left={undefined} />);
  expect(stdout.write.mock.lastCall![0]).toBe("X\n\n\n");
});

test("clears percentage top and left offsets when props are omitted on rerender", () => {
  const stdout = createStdout();

  function Test({ showOffsets }: { readonly showOffsets: boolean }) {
    return (
      <Box width={6} height={4}>
        <Box
          position="absolute"
          {...(showOffsets ? { top: "50%" as const, left: "50%" as const } : {})}
        >
          <Text>X</Text>
        </Box>
      </Box>
    );
  }

  const { rerender } = render(<Test showOffsets />, {
    stdout,
    debug: true,
  });

  expect(stdout.write.mock.lastCall![0]).toBe("\n\n   X\n");

  rerender(<Test showOffsets={false} />);
  expect(stdout.write.mock.lastCall![0]).toBe("X\n\n\n");
});

test("clears bottom and right offsets on rerender", () => {
  const stdout = createStdout();

  function Test({ bottom, right }: { readonly bottom?: number; readonly right?: number }) {
    return (
      <Box width={6} height={4}>
        <Box position="absolute" bottom={bottom} right={right}>
          <Text>X</Text>
        </Box>
      </Box>
    );
  }

  const { rerender } = render(<Test bottom={1} right={1} />, {
    stdout,
    debug: true,
  });

  expect(stdout.write.mock.lastCall![0]).toBe("\n\n    X\n");

  rerender(<Test bottom={undefined} right={undefined} />);
  expect(stdout.write.mock.lastCall![0]).toBe("X\n\n\n");
});

test("absolute position with top and left offsets - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box width={5} height={3}>
      <Box position="absolute" top={1} left={2}>
        <Text>X</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("\n  X\n");
});
