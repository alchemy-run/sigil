import { expect, test } from "vite-plus/test";

import { AnsiText, Box, Text } from "#/index.ts";
import { sanitizeAnsi } from "#/sanitize-ansi.ts";

import { renderToString } from "./helpers/render-to-string.ts";

for (const control of ["\r", "\b", "\v", "\f"]) {
  test(`text removes cursor control ${JSON.stringify(control)}`, () => {
    const output = renderToString(
      <Box borderStyle="single" width={6}>
        <Text>{`a${control}b`}</Text>
      </Box>,
    );

    expect(output).toBe("┌────┐\n│ab  │\n└────┘");
  });

  test(`AnsiText removes cursor control ${JSON.stringify(control)}`, () => {
    const output = renderToString(
      <Box borderStyle="single" width={6}>
        <AnsiText>{`a${control}b`}</AnsiText>
      </Box>,
    );

    expect(output).toBe("┌────┐\n│ab  │\n└────┘");
  });
}

for (const [name, control] of [
  ["NUL", "\u0000"],
  ["SOH", "\u0001"],
  ["BEL", "\u0007"],
  ["SUB", "\u001A"],
  ["US", "\u001F"],
  ["DEL", "\u007F"],
]) {
  test(`text removes ${name} inside a bordered box`, () => {
    const output = renderToString(
      <Box borderStyle="single" width={6}>
        <Text>{`a${control}b`}</Text>
      </Box>,
    );

    expect(output).toBe("┌────┐\n│ab  │\n└────┘");
  });

  test(`text with ${name} keeps the sibling in the next column`, () => {
    const output = renderToString(
      <Box>
        <Box width={10}>
          <Text>{`a${control}b`}</Text>
        </Box>
        <Text>|</Text>
      </Box>,
    );

    expect(output).toBe("ab        |");
  });

  test(`AnsiText with ${name} keeps the sibling in the next column`, () => {
    const output = renderToString(
      <Box>
        <Box width={10}>
          <AnsiText>{`a${control}b`}</AnsiText>
        </Box>
        <Text>|</Text>
      </Box>,
    );

    expect(output).toBe("ab        |");
  });

  test(`sanitizeAnsi strips ${name}`, () => {
    expect(sanitizeAnsi(`a${control}b`)).toBe("ab");
  });
}

test("sanitizing cursor controls preserves tabs, newlines, and styles", () => {
  expect(sanitizeAnsi("\u001B[31ma\rb\bc\vd\fe\t\nf\u001B[0m")).toBe(
    "\u001B[31mabcde\t\nf\u001B[0m",
  );
});

test("cursor controls inside OSC payloads remain untouched", () => {
  const hyperlink = "\u001B]8;;https://example.com/\rpath\u0007";
  expect(sanitizeAnsi(`${hyperlink}a\rb\u001B]8;;\u0007`)).toBe(`${hyperlink}ab\u001B]8;;\u0007`);
});

test("text does not let an OSC hyperlink smuggle escape sequences to the terminal", () => {
  const text = "\u001B]8;;\u001B]52;c;SGVsbG8=\u0007\u0007a\u001B]8;;\u009B2J\u0007b";

  expect(renderToString(<Text>{text}</Text>)).toBe("ab");
  expect(renderToString(<AnsiText>{text}</AnsiText>)).toBe("ab");
});
