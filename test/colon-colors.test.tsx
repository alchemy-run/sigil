import { afterAll, beforeAll, expect, test } from "vite-plus/test";

import { chalk } from "#/ansi/chalk.ts";
import { AnsiText, Box, Text } from "#/index.ts";

import { renderToString } from "./helpers/render-to-string.ts";

const originalLevel = chalk.level;
beforeAll(() => {
  chalk.level = 3;
});
afterAll(() => {
  chalk.level = originalLevel;
});

// Ordinary `Text` strips embedded styling, so these use `AnsiText`. Sigil
// parses colon sub-parameters natively instead of normalizing them away.
for (const [colon, semicolon] of [
  ["38:5:196", "38;5;196"],
  ["48:5:21", "48;5;21"],
  ["38:2::255:0:0", "38;2;255;0;0"],
  ["48:2::0:0:255", "48;2;0;0;255"],
  ["38:2:255:0:0", "38;2;255;0;0"],
  ["38:2:0:255:0:0", "38;2;255;0;0"],
  ["1;38:5:196;48:2::0:0:255", "1;38;5;196;48;2;0;0;255"],
] as const) {
  test(`colon color ${colon} preserves layout beside a sibling`, () => {
    const view = (parameters: string) => (
      <Box width={6} borderStyle="single">
        <AnsiText>{`\u001B[${parameters}mRed\u001B[0m`}</AnsiText>
        <Text>X</Text>
      </Box>
    );

    expect(renderToString(view(colon))).toBe(renderToString(view(semicolon)));
  });
}

test("colon colors wrap and reset like semicolon colors", () => {
  const view = (parameters: string) => (
    <Box width={2}>
      <AnsiText>{`\u001B[${parameters}mABCD\u001B[0mE`}</AnsiText>
    </Box>
  );

  expect(renderToString(view("38:5:196"))).toBe(renderToString(view("38;5;196")));
});

test("colon colors leave colon-containing hyperlink targets intact", () => {
  const url = "https://example.com/38:5:196";
  const content = `\u001B]8;;${url}\u001B\\Link\u001B]8;;\u001B\\`;
  const view = (parameters: string) => (
    <AnsiText>{`\u001B[${parameters}m${content}\u001B[0m`}</AnsiText>
  );

  const output = renderToString(view("38:5:196"));
  expect(output).toContain(url);
  expect(output).toBe(renderToString(view("38;5;196")));
});

// Sigil keeps underline styles and colors instead of degrading or dropping them.
for (const [parameters, open, reset] of [
  ["4:3", "4:3", "24"],
  ["58:5:1", "58;5;1", "59"],
  ["58:2::1:2:3", "58;2;1;2;3", "59"],
] as const) {
  test(`colon parameters ${parameters} keep layout beside a sibling`, () => {
    const output = renderToString(
      <Box>
        <Box width={6}>
          <AnsiText>{`\u001B[${parameters}mab\u001B[0m`}</AnsiText>
        </Box>
        <Text>|</Text>
      </Box>,
    );

    expect(output).toBe(`\u001B[${open}mab\u001B[${reset}m    |`);
  });
}

test("underline style reset 4:0 turns the underline off", () => {
  const output = renderToString(
    <Box>
      <Box width={6}>
        <AnsiText>{"\u001B[4ma\u001B[4:0mb"}</AnsiText>
      </Box>
      <Text>|</Text>
    </Box>,
  );

  expect(output).toBe("\u001B[4ma\u001B[24mb    |");
});
