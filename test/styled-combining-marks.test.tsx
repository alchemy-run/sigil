import { afterAll, beforeAll, expect, test } from "vite-plus/test";

import { chalk } from "#/ansi/chalk.ts";
import { stripAnsi } from "#/ansi/strip.ts";
import { Box, Text } from "#/index.ts";

import { renderToString } from "./helpers/render-to-string.ts";

const originalLevel = chalk.level;
beforeAll(() => {
  chalk.level = 3;
});
afterAll(() => {
  chalk.level = originalLevel;
});

for (const accent of ["\u0301", "̈"]) {
  test(`combining mark ${accent} survives a nested Text style boundary`, () => {
    const output = renderToString(
      <Box>
        <Text>
          e<Text color="red">{accent}</Text>
        </Text>
        <Text>X</Text>
      </Box>,
    );

    expect(stripAnsi(output)).toBe(`e${accent}X`);
  });
}

test("following text retains its color after a styled combining mark", () => {
  const output = renderToString(
    <Text>
      e<Text color="red">{"\u0301X"}</Text>Y
    </Text>,
  );
  expect(output).toBe(`e\u0301${chalk.red("X")}Y`);
});

test("a combining mark retains the style of its base character", () => {
  const output = renderToString(
    <Text>
      <Text color="blue">e</Text>
      <Text color="red">{"\u0301X"}</Text>
    </Text>,
  );
  const expected = renderToString(
    <Text>
      <Text color="blue">{"e\u0301"}</Text>
      <Text color="red">X</Text>
    </Text>,
  );
  expect(output).toBe(expected);
});

test("multiple styled marks attach to one base cell", () => {
  const output = renderToString(
    <Box>
      <Text>
        a<Text bold>{"\u0301"}</Text>
        <Text color="red">{"̈"}</Text>
      </Text>
      <Text>X</Text>
    </Box>,
  );
  expect(stripAnsi(output)).toBe("a\u0301̈X");
});

test("newlines remain between a base and a following combining mark", () => {
  const output = renderToString(
    <Text>
      e{"\n"}
      <Text color="red">{"\u0301X"}</Text>
    </Text>,
  );
  expect(stripAnsi(output).startsWith("e\n")).toBe(true);
});

test("wrapping keeps a styled accent on the preceding base character", () => {
  const output = renderToString(
    <Box width={1}>
      <Text>
        e<Text color="red">{"\u0301X"}</Text>
      </Text>
    </Box>,
  );

  expect(stripAnsi(output).normalize()).toBe("é\nX");
});

test("a styled variation selector keeps emoji presentation and width", () => {
  const output = renderToString(
    <Box>
      <Text>
        ❤<Text color="red">{"️"}</Text>
      </Text>
      <Text>X</Text>
    </Box>,
  );

  expect(stripAnsi(output)).toBe("❤️X");
});

// Sigil drops a mark with no base character: it can't occupy a cell of its
// own, and a terminal would combine it with whatever precedes it on screen.
test("a styled mark without a base character is dropped without moving its text", () => {
  const output = renderToString(
    <Text>
      <Text color="red">{"\u0301X"}</Text>Y
    </Text>,
  );

  expect(output).toBe(`${chalk.red("X")}Y`);
});
