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

// Ordinary `Text` strips embedded styling, so styled input uses `AnsiText`.
test("styles spanning newlines render the same across frames", () => {
  const text = chalk.red("span 1\nspan 2");
  const expected = `${chalk.red("span 1")}\n${chalk.red("span 2")}`;

  expect(renderToString(<AnsiText>{text}</AnsiText>)).toBe(expected);
  expect(renderToString(<AnsiText>{text}</AnsiText>)).toBe(expected);
});

test("clipped multiline text with links and emoji renders the same across frames", () => {
  const content = [
    chalk.blue("🚀 Header with rocket emoji"),
    "\u001B]8;;https://example.com\u0007🔗 Link row in dashboard\u001B]8;;\u0007",
    chalk.green("✔ Status: operational"),
  ].join("\n");

  const renderFrame = () =>
    renderToString(
      <Box width={10} height={3} overflow="hidden">
        <AnsiText wrap="truncate-end">{content}</AnsiText>
      </Box>,
    );

  const first = renderFrame();
  expect(
    first
      .split("\n")
      .map((line) => line.replaceAll(/\u001B\[[\d;]*m|\u001B\]8;;[^\u0007]*\u0007/gu, "")),
  ).toEqual(["🚀 Header…", "🔗 Link r…", "✔ Status:…"]);
  expect(first).toContain("\u001B]8;;https://example.com\u0007");
  expect(renderFrame()).toBe(first);
});

test("a 120x40 dashboard with one changing row renders every frame", () => {
  const stableRows = Array.from(
    { length: 39 },
    (_, index) => `Row ${index.toString().padStart(2, "0")}: stable content across frames`,
  );

  for (let frame = 0; frame < 5; frame++) {
    const screen = [...stableRows, `Row 39: dynamic status ${frame}`].join("\n");

    expect(
      renderToString(
        <Box width={120} height={40}>
          <Text>{screen}</Text>
        </Box>,
      ),
    ).toBe(screen);
  }
});

test("a leading combining mark in text that fills an overflow box does not overwrite its border", () => {
  const output = renderToString(
    <Box width={5} height={3} borderStyle="single" overflow="hidden">
      <Text>{"́abc"}</Text>
    </Box>,
  );

  expect(output).toBe("┌───┐\n│abc│\n└───┘");
});
