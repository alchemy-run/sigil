import { expect, test } from "vite-plus/test";

import { chalk } from "#/ansi/chalk.ts";
import { render, Box, Text } from "#/index.ts";

import createStdout from "./helpers/create-stdout.ts";
import { enableTestColors, disableTestColors } from "./helpers/force-colors.ts";
import { renderToString, renderToStringAsync } from "./helpers/render-to-string.ts";
import { renderAsync } from "./helpers/test-renderer.ts";

// ANSI escape sequences for background colors
// Note: We test against raw ANSI codes rather than chalk predicates because:
// 1. Different color reset patterns:
//    - Chalk: '\u001b[43mHello \u001b[49m\u001b[43mWorld\u001b[49m' (individual resets)
//    - Ink:   '\u001b[43mHello World\u001b[49m' (continuous blocks)
// 2. Background space fills that chalk doesn't generate:
//    - Ink: '\u001b[41mHello     \u001b[49m\n\u001b[41m          \u001b[49m' (fills entire Box area)
// 3. Context-aware color transitions:
//    - Chalk: '\u001b[43mOuter: \u001b[49m\u001b[44mInner: \u001b[49m\u001b[41mExplicit\u001b[49m'
//    - Ink:   '\u001b[43mOuter: \u001b[44mInner: \u001b[41mExplicit\u001b[49m' (no intermediate resets)
const ansi = {
  // Standard colors
  bgRed: "\u001B[41m",
  bgGreen: "\u001B[42m",
  bgYellow: "\u001B[43m",
  bgBlue: "\u001B[44m",
  bgMagenta: "\u001B[45m",
  bgCyan: "\u001B[46m",

  // Hex/RGB colors (24-bit)
  bgHexRed: "\u001B[48;2;255;0;0m", // #FF0000 or rgb(255,0,0)

  // ANSI256 colors
  bgAnsi256Nine: "\u001B[48;5;9m", // Ansi256(9)

  // Reset
  bgReset: "\u001B[49m",
} as const;

// Enable colors for all tests
test.beforeAll(() => {
  enableTestColors();
});

test.afterAll(() => {
  disableTestColors();
});

// Text inheritance tests (these work in non-TTY)
test("Text inherits parent Box background color", () => {
  const output = renderToString(
    <Box backgroundColor="green" alignSelf="flex-start">
      <Text>Hello World</Text>
    </Box>,
  );

  expect(output).toBe(chalk.bgGreen("Hello World"));
});

test("Text explicit background color overrides inherited", () => {
  const output = renderToString(
    <Box backgroundColor="red" alignSelf="flex-start">
      <Text backgroundColor="blue">Hello World</Text>
    </Box>,
  );

  expect(output).toBe(chalk.bgBlue("Hello World"));
});

test("Nested Box background inheritance", () => {
  const output = renderToString(
    <Box backgroundColor="red" alignSelf="flex-start">
      <Box backgroundColor="blue">
        <Text>Hello World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(chalk.bgBlue("Hello World"));
});

test("Text without parent Box background has no inheritance", () => {
  const output = renderToString(
    <Box alignSelf="flex-start">
      <Text>Hello World</Text>
    </Box>,
  );

  expect(output).toBe("Hello World");
});

test("Multiple Text elements inherit same background", () => {
  const output = renderToString(
    <Box backgroundColor="yellow" alignSelf="flex-start">
      <Text>Hello </Text>
      <Text>World</Text>
    </Box>,
  );

  // Text nodes are rendered as a single block with shared background
  expect(output).toBe(chalk.bgYellow("Hello World"));
});

test("Mixed text with and without background inheritance", () => {
  const output = renderToString(
    <Box backgroundColor="green" alignSelf="flex-start">
      <Text>Inherited </Text>
      <Text backgroundColor="">No BG </Text>
      <Text backgroundColor="red">Red BG</Text>
    </Box>,
  );

  expect(output).toBe(chalk.bgGreen("Inherited ") + "No BG " + chalk.bgRed("Red BG"));
});

test("Complex nested structure with background inheritance", () => {
  const output = renderToString(
    <Box backgroundColor="yellow" alignSelf="flex-start">
      <Box>
        <Text>Outer: </Text>
        <Box backgroundColor="blue">
          <Text>Inner: </Text>
          <Text backgroundColor="red">Explicit</Text>
        </Box>
      </Box>
    </Box>,
  );

  // Colors transition without reset codes between them - actual behavior from debug output
  expect(output).toBe(
    `${ansi.bgYellow}Outer: ${ansi.bgBlue}Inner: ${ansi.bgRed}Explicit${ansi.bgReset}`,
  );
});

// Background color tests for different formats
test("Box background with standard color", () => {
  const output = renderToString(
    <Box backgroundColor="red" alignSelf="flex-start">
      <Text>Hello</Text>
    </Box>,
  );

  expect(output).toBe(chalk.bgRed("Hello"));
});

test("empty Box background paints terminal-default blank cells", () => {
  const output = renderToString(
    <Box width={3} backgroundColor="red">
      <Text>///</Text>
      <Box position="absolute" width={3} backgroundColor="">
        <Text>x</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("x");
});

test("Box background with hex color", () => {
  const output = renderToString(
    <Box backgroundColor="#FF0000" alignSelf="flex-start">
      <Text>Hello</Text>
    </Box>,
  );

  expect(output).toBe(chalk.bgHex("#FF0000")("Hello"));
});

test("Box background with rgb color", () => {
  const output = renderToString(
    <Box backgroundColor="rgb(255, 0, 0)" alignSelf="flex-start">
      <Text>Hello</Text>
    </Box>,
  );

  expect(output).toBe(chalk.bgRgb(255, 0, 0)("Hello"));
});

test("Box background with ansi256 color", () => {
  const output = renderToString(
    <Box backgroundColor="ansi256(9)" alignSelf="flex-start">
      <Text>Hello</Text>
    </Box>,
  );

  expect(output).toBe(chalk.bgAnsi256(9)("Hello"));
});

test("Box background with wide characters", () => {
  const output = renderToString(
    <Box backgroundColor="yellow" alignSelf="flex-start">
      <Text>こんにちは</Text>
    </Box>,
  );

  expect(output).toBe(chalk.bgYellow("こんにちは"));
});

test("Box background with emojis", () => {
  const output = renderToString(
    <Box backgroundColor="red" alignSelf="flex-start">
      <Text>🎉🎊</Text>
    </Box>,
  );

  expect(output).toBe(chalk.bgRed("🎉🎊"));
});

// Box background space fill tests - these should work with forced colors
test("Box background fills entire area with standard color", () => {
  const output = renderToString(
    <Box backgroundColor="red" width={10} height={3} alignSelf="flex-start">
      <Text>Hello</Text>
    </Box>,
  );

  // Should contain background color codes and fill spaces for entire Box area
  expect(output, "Should contain red background start code").toContain(ansi.bgRed);
  expect(output, "Should contain background reset code").toContain(ansi.bgReset);
  expect(output, "Should contain the text").toContain("Hello");
  expect(output, "Should contain background fill line").toContain(
    `${ansi.bgRed}          ${ansi.bgReset}`,
  );
});

test("Box background fills with hex color", () => {
  const output = renderToString(
    <Box backgroundColor="#FF0000" width={10} height={3} alignSelf="flex-start">
      <Text>Hello</Text>
    </Box>,
  );

  // Should contain hex color background codes and fill spaces
  expect(output, "Should contain the text").toContain("Hello");
  expect(output, "Should contain hex RGB background code").toContain(ansi.bgHexRed);
  expect(output, "Should contain background reset code").toContain(ansi.bgReset);
});

test("Box background fills with rgb color", () => {
  const output = renderToString(
    <Box backgroundColor="rgb(255, 0, 0)" width={10} height={3} alignSelf="flex-start">
      <Text>Hello</Text>
    </Box>,
  );

  // Should contain RGB color background codes and fill spaces
  expect(output, "Should contain the text").toContain("Hello");
  expect(output, "Should contain RGB background code").toContain(ansi.bgHexRed);
  expect(output, "Should contain background reset code").toContain(ansi.bgReset);
});

test("Box background fills with ansi256 color", () => {
  const output = renderToString(
    <Box backgroundColor="ansi256(9)" width={10} height={3} alignSelf="flex-start">
      <Text>Hello</Text>
    </Box>,
  );

  // Should contain ANSI256 color background codes and fill spaces
  expect(output, "Should contain the text").toContain("Hello");
  expect(output, "Should contain ANSI256 background code").toContain(ansi.bgAnsi256Nine);
  expect(output, "Should contain background reset code").toContain(ansi.bgReset);
});

test("Box background with border fills content area", () => {
  const output = renderToString(
    <Box backgroundColor="cyan" borderStyle="round" width={10} height={5} alignSelf="flex-start">
      <Text>Hi</Text>
    </Box>,
  );

  // Should have background fill inside the border and border characters
  expect(output, "Should contain the text").toContain("Hi");
  expect(output, "Should contain cyan background code").toContain(ansi.bgCyan);
  expect(output, "Should contain background reset code").toContain(ansi.bgReset);
  expect(output, "Should contain top-left border").toContain("╭");
  expect(output, "Should contain top-right border").toContain("╮");
});

test("Box background with padding fills entire padded area", () => {
  const output = renderToString(
    <Box backgroundColor="magenta" padding={1} width={10} height={5} alignSelf="flex-start">
      <Text>Hi</Text>
    </Box>,
  );

  // Background should fill the entire Box area including padding
  expect(output, "Should contain the text").toContain("Hi");
  expect(output, "Should contain magenta background code").toContain(ansi.bgMagenta);
  expect(output, "Should contain background reset code").toContain(ansi.bgReset);
});

test("Box background with center alignment fills entire area", () => {
  const output = renderToString(
    <Box
      backgroundColor="blue"
      width={10}
      height={3}
      justifyContent="center"
      alignSelf="flex-start"
    >
      <Text>Hi</Text>
    </Box>,
  );

  expect(output, "Should contain centered text").toContain("Hi");
  expect(output, "Should contain blue background code").toContain(ansi.bgBlue);
  expect(output, "Should contain background reset code").toContain(ansi.bgReset);
});

test("Box background with column layout fills entire area", () => {
  const output = renderToString(
    <Box
      backgroundColor="green"
      flexDirection="column"
      width={10}
      height={5}
      alignSelf="flex-start"
    >
      <Text>Line 1</Text>
      <Text>Line 2</Text>
    </Box>,
  );

  expect(output, "Should contain first line text").toContain("Line 1");
  expect(output, "Should contain second line text").toContain("Line 2");
  expect(output, "Should contain green background code").toContain(ansi.bgGreen);
  expect(output, "Should contain background reset code").toContain(ansi.bgReset);
});

// Update tests using render() for comprehensive coverage
test("Box background updates on rerender", () => {
  const stdout = createStdout();

  function Test({ bgColor }: { readonly bgColor?: string }) {
    return (
      <Box backgroundColor={bgColor} alignSelf="flex-start">
        <Text>Hello</Text>
      </Box>
    );
  }

  const { rerender } = render(<Test />, {
    stdout,
    debug: true,
  });

  expect(stdout.write.mock.lastCall![0]).toBe("Hello");

  rerender(<Test bgColor="green" />);
  expect(stdout.write.mock.lastCall![0]).toBe(chalk.bgGreen("Hello"));

  rerender(<Test />);
  expect(stdout.write.mock.lastCall![0]).toBe("Hello");
});

// Concurrent mode tests
test("Text inherits parent Box background color - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box backgroundColor="green" alignSelf="flex-start">
      <Text>Hello World</Text>
    </Box>,
  );

  expect(output).toBe(chalk.bgGreen("Hello World"));
});

test("Nested Box background inheritance - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box backgroundColor="red" alignSelf="flex-start">
      <Box backgroundColor="blue">
        <Text>Hello World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(chalk.bgBlue("Hello World"));
});

test("Box background with hex color - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box backgroundColor="#FF0000" alignSelf="flex-start">
      <Text>Hello</Text>
    </Box>,
  );

  expect(output).toBe(chalk.bgHex("#FF0000")("Hello"));
});

test("Box background updates on rerender - concurrent", async () => {
  function Test({ bgColor }: { readonly bgColor?: string }) {
    return (
      <Box backgroundColor={bgColor} alignSelf="flex-start">
        <Text>Hello</Text>
      </Box>
    );
  }

  const { getOutput, rerenderAsync } = await renderAsync(<Test />);

  expect(getOutput()).toBe("Hello");

  await rerenderAsync(<Test bgColor="green" />);
  expect(getOutput()).toBe(chalk.bgGreen("Hello"));

  await rerenderAsync(<Test />);
  expect(getOutput()).toBe("Hello");
});

test("Box backgroundColor fills full width on every line when text wraps", () => {
  // "Hello World!!" is 13 chars, width=10 forces wrapping into 2 lines
  const output = renderToString(
    <Box backgroundColor="red" width={10} alignSelf="flex-start">
      <Text>Hello World!!</Text>
    </Box>,
  );

  // Both lines are padded to the full 10-char Box width with background color
  expect(output).toBe(
    `${ansi.bgRed}Hello     ${ansi.bgReset}\n${ansi.bgRed}World!!   ${ansi.bgReset}`,
  );
});

test("Text-only backgroundColor colors text content but does not fill Box width", () => {
  // Without a Box backgroundColor, only the text characters are colored
  const output = renderToString(
    <Box width={10} alignSelf="flex-start">
      <Text backgroundColor="red">Hello World!!</Text>
    </Box>,
  );

  // Text-only bg colors just the text, not the remaining space to fill Box width
  expect(output).toBe(`${ansi.bgRed}Hello ${ansi.bgReset}\n${ansi.bgRed}World!!${ansi.bgReset}`);
});
