import { expect, test } from "vite-plus/test";

import { chalk } from "#/ansi/chalk.ts";
import { BOXES as cliBoxes } from "#/glyphs.ts";
import { render, Box, Text } from "#/index.ts";

import createStdout from "./helpers/create-stdout.ts";
import { renderToString, renderToStringAsync } from "./helpers/render-to-string.ts";
import { renderAsync } from "./helpers/test-renderer.ts";

test("single node - full width box", () => {
  const output = renderToString(
    <Box borderStyle="round">
      <Text>Hello World</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "╭──────────────────────────────────────────────────────────────────────────────────────────────────╮",
      "│Hello World                                                                                       │",
      "╰──────────────────────────────────────────────────────────────────────────────────────────────────╯",
    ].join("\n"),
  );
});

test("single node - full width box with colorful border", () => {
  const output = renderToString(
    <Box borderStyle="round" borderColor="green">
      <Text>Hello World</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "\u001B[32m╭──────────────────────────────────────────────────────────────────────────────────────────────────╮\u001B[39m",
      "\u001B[32m│\u001B[39mHello World                                                                                       \u001B[32m│\u001B[39m",
      "\u001B[32m╰──────────────────────────────────────────────────────────────────────────────────────────────────╯\u001B[39m",
    ].join("\n"),
  );
});

test("single node - fit-content box", () => {
  const output = renderToString(
    <Box borderStyle="round" alignSelf="flex-start">
      <Text>Hello World</Text>
    </Box>,
  );

  expect(output).toBe(["╭───────────╮", "│Hello World│", "╰───────────╯"].join("\n"));
});

test("single node - fit-content box with wide characters", () => {
  const output = renderToString(
    <Box borderStyle="round" alignSelf="flex-start">
      <Text>こんにちは</Text>
    </Box>,
  );

  expect(output).toBe(["╭──────────╮", "│こんにちは│", "╰──────────╯"].join("\n"));
});

test("single node - fit-content box with emojis", () => {
  const output = renderToString(
    <Box borderStyle="round" alignSelf="flex-start">
      <Text>🌊🌊</Text>
    </Box>,
  );

  expect(output).toBe(["╭────╮", "│🌊🌊│", "╰────╯"].join("\n"));
});

// Issue #733: Emojis with variation selectors (FE0F) should align properly
test("single node - fit-content box with variation selector emojis", () => {
  const output = renderToString(
    <Box borderStyle="round" alignSelf="flex-start">
      <Text>🌡️⚠️✅</Text>
    </Box>,
  );

  expect(output).toBe(["╭──────╮", "│🌡️⚠️✅│", "╰──────╯"].join("\n"));
});

test("single node - fixed width box", () => {
  const output = renderToString(
    <Box borderStyle="round" width={20}>
      <Text>Hello World</Text>
    </Box>,
  );

  expect(output).toBe(
    ["╭──────────────────╮", "│Hello World       │", "╰──────────────────╯"].join("\n"),
  );
});

test("single node - fixed width and height box", () => {
  const output = renderToString(
    <Box borderStyle="round" width={20} height={20}>
      <Text>Hello World</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "╭──────────────────╮",
      "│Hello World       │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "╰──────────────────╯",
    ].join("\n"),
  );
});

test("single node - box with padding", () => {
  const output = renderToString(
    <Box borderStyle="round" padding={1} alignSelf="flex-start">
      <Text>Hello World</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "╭─────────────╮",
      "│             │",
      "│ Hello World │",
      "│             │",
      "╰─────────────╯",
    ].join("\n"),
  );
});

test("single node - box with horizontal alignment", () => {
  const output = renderToString(
    <Box borderStyle="round" width={20} justifyContent="center">
      <Text>Hello World</Text>
    </Box>,
  );

  expect(output).toBe(
    ["╭──────────────────╮", "│   Hello World    │", "╰──────────────────╯"].join("\n"),
  );
});

test("single node - box with vertical alignment", () => {
  const output = renderToString(
    <Box borderStyle="round" height={20} alignItems="center" alignSelf="flex-start">
      <Text>Hello World</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "╭───────────╮",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│Hello World│",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "╰───────────╯",
    ].join("\n"),
  );
});

test("single node - box with wrapping", () => {
  const output = renderToString(
    <Box borderStyle="round" width={10}>
      <Text>Hello World</Text>
    </Box>,
  );

  expect(output).toBe(["╭────────╮", "│Hello   │", "│World   │", "╰────────╯"].join("\n"));
});

test("multiple nodes - full width box", () => {
  const output = renderToString(
    <Box borderStyle="round">
      <Text>{"Hello "}World</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "╭──────────────────────────────────────────────────────────────────────────────────────────────────╮",
      "│Hello World                                                                                       │",
      "╰──────────────────────────────────────────────────────────────────────────────────────────────────╯",
    ].join("\n"),
  );
});

test("multiple nodes - full width box with colorful border", () => {
  const output = renderToString(
    <Box borderStyle="round" borderColor="green">
      <Text>{"Hello "}World</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "\u001B[32m╭──────────────────────────────────────────────────────────────────────────────────────────────────╮\u001B[39m",
      "\u001B[32m│\u001B[39mHello World                                                                                       \u001B[32m│\u001B[39m",
      "\u001B[32m╰──────────────────────────────────────────────────────────────────────────────────────────────────╯\u001B[39m",
    ].join("\n"),
  );
});

test("multiple nodes - fit-content box", () => {
  const output = renderToString(
    <Box borderStyle="round" alignSelf="flex-start">
      <Text>{"Hello "}World</Text>
    </Box>,
  );

  expect(output).toBe(["╭───────────╮", "│Hello World│", "╰───────────╯"].join("\n"));
});

test("multiple nodes - fixed width box", () => {
  const output = renderToString(
    <Box borderStyle="round" width={20}>
      <Text>{"Hello "}World</Text>
    </Box>,
  );
  expect(output).toBe(
    ["╭──────────────────╮", "│Hello World       │", "╰──────────────────╯"].join("\n"),
  );
});

test("multiple nodes - fixed width and height box", () => {
  const output = renderToString(
    <Box borderStyle="round" width={20} height={20}>
      <Text>{"Hello "}World</Text>
    </Box>,
  );
  expect(output).toBe(
    [
      "╭──────────────────╮",
      "│Hello World       │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "│                  │",
      "╰──────────────────╯",
    ].join("\n"),
  );
});

test("multiple nodes - box with padding", () => {
  const output = renderToString(
    <Box borderStyle="round" padding={1} alignSelf="flex-start">
      <Text>{"Hello "}World</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "╭─────────────╮",
      "│             │",
      "│ Hello World │",
      "│             │",
      "╰─────────────╯",
    ].join("\n"),
  );
});

test("multiple nodes - box with horizontal alignment", () => {
  const output = renderToString(
    <Box borderStyle="round" width={20} justifyContent="center">
      <Text>{"Hello "}World</Text>
    </Box>,
  );

  expect(output).toBe(
    ["╭──────────────────╮", "│   Hello World    │", "╰──────────────────╯"].join("\n"),
  );
});

test("multiple nodes - box with vertical alignment", () => {
  const output = renderToString(
    <Box borderStyle="round" height={20} alignItems="center" alignSelf="flex-start">
      <Text>{"Hello "}World</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "╭───────────╮",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│Hello World│",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "│           │",
      "╰───────────╯",
    ].join("\n"),
  );
});

test("multiple nodes - box with wrapping", () => {
  const output = renderToString(
    <Box borderStyle="round" width={10}>
      <Text>{"Hello "}World</Text>
    </Box>,
  );

  expect(output).toBe(["╭────────╮", "│Hello   │", "│World   │", "╰────────╯"].join("\n"));
});

test("multiple nodes - box with wrapping and long first node", () => {
  const output = renderToString(
    <Box borderStyle="round" width={10}>
      <Text>{"Helloooooo"} World</Text>
    </Box>,
  );

  expect(output).toBe(["╭────────╮", "│Helloooo│", "│oo World│", "╰────────╯"].join("\n"));
});

test("multiple nodes - box with wrapping and very long first node", () => {
  const output = renderToString(
    <Box borderStyle="round" width={10}>
      <Text>{"Hellooooooooooooo"} World</Text>
    </Box>,
  );

  expect(output).toBe(
    ["╭────────╮", "│Helloooo│", "│oooooooo│", "│o World │", "╰────────╯"].join("\n"),
  );
});

test("nested boxes", () => {
  const output = renderToString(
    <Box borderStyle="round" width={40} padding={1}>
      <Box borderStyle="round" justifyContent="center" padding={1}>
        <Text>Hello World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(
    [
      "╭──────────────────────────────────────╮",
      "│                                      │",
      "│ ╭─────────────╮                      │",
      "│ │             │                      │",
      "│ │ Hello World │                      │",
      "│ │             │                      │",
      "│ ╰─────────────╯                      │",
      "│                                      │",
      "╰──────────────────────────────────────╯",
    ].join("\n"),
  );
});

test("nested boxes - fit-content box with wide characters on flex-direction row", () => {
  const output = renderToString(
    <Box borderStyle="round" alignSelf="flex-start">
      <Box borderStyle="round">
        <Text>ミスター</Text>
      </Box>
      <Box borderStyle="round">
        <Text>スポック</Text>
      </Box>
      <Box borderStyle="round">
        <Text>カーク船長</Text>
      </Box>
    </Box>,
  );

  const expected = [
    "╭────────────────────────────────╮",
    "│╭────────╮╭────────╮╭──────────╮│",
    "││ミスター││スポック││カーク船長││",
    "│╰────────╯╰────────╯╰──────────╯│",
    "╰────────────────────────────────╯",
  ].join("\n");

  expect(output).toBe(expected);
});

test("nested boxes - fit-content box with emojis on flex-direction row", () => {
  const output = renderToString(
    <Box borderStyle="round" alignSelf="flex-start">
      <Box borderStyle="round">
        <Text>🦾</Text>
      </Box>
      <Box borderStyle="round">
        <Text>🌏</Text>
      </Box>
      <Box borderStyle="round">
        <Text>😋</Text>
      </Box>
    </Box>,
  );

  const expected = [
    "╭────────────╮",
    "│╭──╮╭──╮╭──╮│",
    "││🦾││🌏││😋││",
    "│╰──╯╰──╯╰──╯│",
    "╰────────────╯",
  ].join("\n");

  expect(output).toBe(expected);
});

test("nested boxes - fit-content box with wide characters on flex-direction column", () => {
  const output = renderToString(
    <Box borderStyle="round" alignSelf="flex-start" flexDirection="column">
      <Box borderStyle="round">
        <Text>ミスター</Text>
      </Box>
      <Box borderStyle="round">
        <Text>スポック</Text>
      </Box>
      <Box borderStyle="round">
        <Text>カーク船長</Text>
      </Box>
    </Box>,
  );

  const expected = [
    "╭────────────╮",
    "│╭──────────╮│",
    "││ミスター  ││",
    "│╰──────────╯│",
    "│╭──────────╮│",
    "││スポック  ││",
    "│╰──────────╯│",
    "│╭──────────╮│",
    "││カーク船長││",
    "│╰──────────╯│",
    "╰────────────╯",
  ].join("\n");

  expect(output).toBe(expected);
});

test("nested boxes - fit-content box with emojis on flex-direction column", () => {
  const output = renderToString(
    <Box borderStyle="round" alignSelf="flex-start" flexDirection="column">
      <Box borderStyle="round">
        <Text>🦾</Text>
      </Box>
      <Box borderStyle="round">
        <Text>🌏</Text>
      </Box>
      <Box borderStyle="round">
        <Text>😋</Text>
      </Box>
    </Box>,
  );

  const expected = [
    "╭────╮",
    "│╭──╮│",
    "││🦾││",
    "│╰──╯│",
    "│╭──╮│",
    "││🌏││",
    "│╰──╯│",
    "│╭──╮│",
    "││😋││",
    "│╰──╯│",
    "╰────╯",
  ].join("\n");

  expect(output).toBe(expected);
});

test("render border after update", () => {
  const stdout = createStdout();

  function Test({ borderColor }: { readonly borderColor?: string }) {
    return (
      <Box borderStyle="round" borderColor={borderColor}>
        <Text>Hello World</Text>
      </Box>
    );
  }

  const { rerender } = render(<Test />, {
    stdout,
    debug: true,
  });

  expect(stdout.write.mock.lastCall![0]).toBe(
    [
      "╭──────────────────────────────────────────────────────────────────────────────────────────────────╮",
      "│Hello World                                                                                       │",
      "╰──────────────────────────────────────────────────────────────────────────────────────────────────╯",
    ].join("\n"),
  );

  rerender(<Test borderColor="green" />);

  expect(stdout.write.mock.lastCall![0]).toBe(
    [
      "\u001B[32m╭──────────────────────────────────────────────────────────────────────────────────────────────────╮\u001B[39m",
      "\u001B[32m│\u001B[39mHello World                                                                                       \u001B[32m│\u001B[39m",
      "\u001B[32m╰──────────────────────────────────────────────────────────────────────────────────────────────────╯\u001B[39m",
    ].join("\n"),
  );

  rerender(<Test />);

  expect(stdout.write.mock.lastCall![0]).toBe(
    [
      "╭──────────────────────────────────────────────────────────────────────────────────────────────────╮",
      "│Hello World                                                                                       │",
      "╰──────────────────────────────────────────────────────────────────────────────────────────────────╯",
    ].join("\n"),
  );
});

test("render border edge changes after update when borderStyle is unchanged", () => {
  const stdout = createStdout();

  function Test({ borderTop }: { readonly borderTop?: boolean }) {
    return (
      <Box borderStyle="round" borderTop={borderTop} alignSelf="flex-start">
        <Text>Content</Text>
      </Box>
    );
  }

  const { rerender } = render(<Test />, {
    stdout,
    debug: true,
  });

  expect(stdout.write.mock.lastCall![0]).toBe(["╭───────╮", "│Content│", "╰───────╯"].join("\n"));

  rerender(<Test borderTop={false} />);

  expect(stdout.write.mock.lastCall![0]).toBe(
    [
      `${cliBoxes.round.left}Content${cliBoxes.round.right}`,
      `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
    ].join("\n"),
  );

  rerender(<Test />);

  expect(stdout.write.mock.lastCall![0]).toBe(["╭───────╮", "│Content│", "╰───────╯"].join("\n"));
});

test("hide top border", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="flex-start">
      <Text>Above</Text>
      <Box borderStyle="round" borderTop={false}>
        <Text>Content</Text>
      </Box>
      <Text>Below</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "Above",
      `${cliBoxes.round.left}Content${cliBoxes.round.right}`,
      `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
      "Below",
    ].join("\n"),
  );
});

test("hide bottom border", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="flex-start">
      <Text>Above</Text>
      <Box borderStyle="round" borderBottom={false}>
        <Text>Content</Text>
      </Box>
      <Text>Below</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "Above",
      `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
      `${cliBoxes.round.left}Content${cliBoxes.round.right}`,
      "Below",
    ].join("\n"),
  );
});

test("hide top and bottom borders", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="flex-start">
      <Text>Above</Text>
      <Box borderStyle="round" borderTop={false} borderBottom={false}>
        <Text>Content</Text>
      </Box>
      <Text>Below</Text>
    </Box>,
  );

  expect(output).toBe(
    ["Above", `${cliBoxes.round.left}Content${cliBoxes.round.right}`, "Below"].join("\n"),
  );
});

test("hide left border", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="flex-start">
      <Text>Above</Text>
      <Box borderStyle="round" borderLeft={false}>
        <Text>Content</Text>
      </Box>
      <Text>Below</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "Above",
      `${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
      `Content${cliBoxes.round.right}`,
      `${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
      "Below",
    ].join("\n"),
  );
});

test("hide right border", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="flex-start">
      <Text>Above</Text>
      <Box borderStyle="round" borderRight={false}>
        <Text>Content</Text>
      </Box>
      <Text>Below</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "Above",
      `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}`,
      `${cliBoxes.round.left}Content`,
      `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}`,
      "Below",
    ].join("\n"),
  );
});

test("hide left and right border", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="flex-start">
      <Text>Above</Text>
      <Box borderStyle="round" borderLeft={false} borderRight={false}>
        <Text>Content</Text>
      </Box>
      <Text>Below</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "Above",
      cliBoxes.round.top.repeat(7),
      "Content",
      cliBoxes.round.bottom.repeat(7),
      "Below",
    ].join("\n"),
  );
});

test("hide all borders", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="flex-start">
      <Text>Above</Text>
      <Box
        borderStyle="round"
        borderTop={false}
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
      >
        <Text>Content</Text>
      </Box>
      <Text>Below</Text>
    </Box>,
  );

  expect(output).toBe(["Above", "Content", "Below"].join("\n"));
});

test("change color of top border", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="flex-start">
      <Text>Above</Text>
      <Box borderStyle="round" borderTopColor="green">
        <Text>Content</Text>
      </Box>
      <Text>Below</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "Above",
      chalk.green(
        `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
      ),
      `${cliBoxes.round.left}Content${cliBoxes.round.right}`,
      `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
      "Below",
    ].join("\n"),
  );
});

test("change color of bottom border", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="flex-start">
      <Text>Above</Text>
      <Box borderStyle="round" borderBottomColor="green">
        <Text>Content</Text>
      </Box>
      <Text>Below</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "Above",
      `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
      `${cliBoxes.round.left}Content${cliBoxes.round.right}`,
      chalk.green(
        `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${
          cliBoxes.round.bottomRight
        }`,
      ),
      "Below",
    ].join("\n"),
  );
});

test("change color of left border", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="flex-start">
      <Text>Above</Text>
      <Box borderStyle="round" borderLeftColor="green">
        <Text>Content</Text>
      </Box>
      <Text>Below</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "Above",
      `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
      `${chalk.green(cliBoxes.round.left)}Content${cliBoxes.round.right}`,
      `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
      "Below",
    ].join("\n"),
  );
});

test("change color of right border", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="flex-start">
      <Text>Above</Text>
      <Box borderStyle="round" borderRightColor="green">
        <Text>Content</Text>
      </Box>
      <Text>Below</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "Above",
      `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
      `${cliBoxes.round.left}Content${chalk.green(cliBoxes.round.right)}`,
      `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
      "Below",
    ].join("\n"),
  );
});

test("custom border style", () => {
  const output = renderToString(
    <Box
      borderStyle={{
        topLeft: "↘",
        top: "↓",
        topRight: "↙",
        left: "→",
        bottomLeft: "↗",
        bottom: "↑",
        bottomRight: "↖",
        right: "←",
      }}
    >
      <Text>Content</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "↘↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↙",
      "→Content                                                                                           ←",
      "↗↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↖",
    ].join("\n"),
  );
});

test("dim border color", () => {
  const output = renderToString(
    <Box borderDimColor borderStyle="round">
      <Text>Content</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "\u001B[2m╭──────────────────────────────────────────────────────────────────────────────────────────────────╮\u001B[22m",
      "\u001B[2m│\u001B[22mContent                                                                                           \u001B[2m│\u001B[22m",
      "\u001B[2m╰──────────────────────────────────────────────────────────────────────────────────────────────────╯\u001B[22m",
    ].join("\n"),
  );
});

test("dim top border color", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="flex-start">
      <Text>Above</Text>
      <Box borderTopDimColor borderStyle="round">
        <Text>Content</Text>
      </Box>
      <Text>Below</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "Above",
      chalk.dim(
        `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
      ),
      `${cliBoxes.round.left}Content${cliBoxes.round.right}`,
      `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
      "Below",
    ].join("\n"),
  );
});

test("dim bottom border color", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="flex-start">
      <Text>Above</Text>
      <Box borderBottomDimColor borderStyle="round">
        <Text>Content</Text>
      </Box>
      <Text>Below</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "Above",
      `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
      `${cliBoxes.round.left}Content${cliBoxes.round.right}`,
      chalk.dim(
        `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${
          cliBoxes.round.bottomRight
        }`,
      ),
      "Below",
    ].join("\n"),
  );
});

test("dim left border color", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="flex-start">
      <Text>Above</Text>
      <Box borderLeftDimColor borderStyle="round">
        <Text>Content</Text>
      </Box>
      <Text>Below</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "Above",
      `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
      `${chalk.dim(cliBoxes.round.left)}Content${cliBoxes.round.right}`,
      `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
      "Below",
    ].join("\n"),
  );
});

test("dim right border color", () => {
  const output = renderToString(
    <Box flexDirection="column" alignItems="flex-start">
      <Text>Above</Text>
      <Box borderRightDimColor borderStyle="round">
        <Text>Content</Text>
      </Box>
      <Text>Below</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "Above",
      `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
      `${cliBoxes.round.left}Content${chalk.dim(cliBoxes.round.right)}`,
      `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
      "Below",
    ].join("\n"),
  );
});

// Regression test for https://github.com/vadimdemedes/ink/issues/840
// borderDimColor should not dim styled child Text components touching the left edge
test("borderDimColor does not dim styled child Text touching left edge", () => {
  const output = renderToString(
    <Box borderDimColor borderStyle="round" alignSelf="flex-start">
      <Text bold color="blue">
        styled text
      </Text>
    </Box>,
  );

  // The styled text should be bold and blue (not dimmed)
  // Note: Text component applies color first then bold, so the escape code order is bold+blue
  const styledText = chalk.bold(chalk.blue("styled text"));
  expect(output, "Child text should retain its color and bold styling, not be dimmed").toContain(
    styledText,
  );

  // The border should be dimmed (entire top border line is dimmed as a unit)
  const dimmedTopBorder = chalk.dim(
    cliBoxes.round.topLeft + cliBoxes.round.top.repeat(11) + cliBoxes.round.topRight,
  );
  expect(output, "Border should be dimmed").toContain(dimmedTopBorder);
});

// Concurrent mode tests
test("single node - full width box - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box borderStyle="round">
      <Text>Hello World</Text>
    </Box>,
  );

  expect(output).toBe(
    [
      "╭──────────────────────────────────────────────────────────────────────────────────────────────────╮",
      "│Hello World                                                                                       │",
      "╰──────────────────────────────────────────────────────────────────────────────────────────────────╯",
    ].join("\n"),
  );
});

test("single node - fit-content box - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box borderStyle="round" alignSelf="flex-start">
      <Text>Hello World</Text>
    </Box>,
  );

  expect(output).toBe(["╭───────────╮", "│Hello World│", "╰───────────╯"].join("\n"));
});

test("nested boxes - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box borderStyle="round" width={40} padding={1}>
      <Box borderStyle="round" justifyContent="center" padding={1}>
        <Text>Hello World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(
    [
      "╭──────────────────────────────────────╮",
      "│                                      │",
      "│ ╭─────────────╮                      │",
      "│ │             │                      │",
      "│ │ Hello World │                      │",
      "│ │             │                      │",
      "│ ╰─────────────╯                      │",
      "│                                      │",
      "╰──────────────────────────────────────╯",
    ].join("\n"),
  );
});

test("render border after update - concurrent", async () => {
  function Test({ borderColor }: { readonly borderColor?: string }) {
    return (
      <Box borderStyle="round" borderColor={borderColor}>
        <Text>Hello World</Text>
      </Box>
    );
  }

  const { getOutput, rerenderAsync } = await renderAsync(<Test />);

  expect(getOutput()).toBe(
    [
      "╭──────────────────────────────────────────────────────────────────────────────────────────────────╮",
      "│Hello World                                                                                       │",
      "╰──────────────────────────────────────────────────────────────────────────────────────────────────╯",
    ].join("\n"),
  );

  await rerenderAsync(<Test borderColor="green" />);

  expect(getOutput()).toBe(
    [
      "\u001B[32m╭──────────────────────────────────────────────────────────────────────────────────────────────────╮\u001B[39m",
      "\u001B[32m│\u001B[39mHello World                                                                                       \u001B[32m│\u001B[39m",
      "\u001B[32m╰──────────────────────────────────────────────────────────────────────────────────────────────────╯\u001B[39m",
    ].join("\n"),
  );
});
