import { expect, test } from "vite-plus/test";

import { chalk } from "#/ansi/chalk.ts";
import { styledCharsFromTokens, styledCharsToString, tokenize } from "#/ansi/tokenize.ts";
import { Box, Text } from "#/index.ts";
import { wrapText } from "#/wrap-text.ts";

import { renderToString } from "./helpers/render-to-string.ts";

test("wraps styled native text without an ANSI round trip", () => {
  const output = renderToString(
    <Box width={5}>
      <Text color="red">hello world</Text>
    </Box>,
  );

  expect(output).toBe(chalk.red("hello\n \nworld"));
});

test("uses the outer Text style for a middle truncation marker", () => {
  const output = renderToString(
    <Box width={7}>
      <Text color="red" wrap="truncate-middle">
        <Text color="blue">Hello World</Text>
      </Text>
    </Box>,
  );
  const legacy = chalk.red(wrapText(chalk.blue("Hello World"), 7, "truncate-middle"));
  const expected = styledCharsToString(styledCharsFromTokens(tokenize(legacy)));

  expect(output).toBe(expected);
});
