import React from "react";
import { expect, test } from "vite-plus/test";

import stringWidth from "../src/ansi/string-width.ts";
import stripAnsi from "../src/ansi/strip.ts";
import { Box, Text } from "../src/index.ts";
import { renderToString } from "./helpers/render-to-string.ts";

test("wide characters do not add extra space inside fixed-width Box", () => {
  const output = renderToString(
    <Box flexDirection="column">
      <Box>
        <Box width={2}>
          <Text>🍔</Text>
        </Box>
        <Text>|</Text>
      </Box>
      <Box>
        <Box width={2}>
          <Text>⏳</Text>
        </Box>
        <Text>|</Text>
      </Box>
    </Box>,
  );

  const lines = output.split("\n");
  expect(lines.length).toBe(2);
  expect(lines[0]).toBe("🍔|");
  expect(lines[1]).toBe("⏳|");
});

test("CJK characters occupy correct width in fixed-width Box", () => {
  const output = renderToString(
    <Box>
      <Box width={4}>
        <Text>你好</Text>
      </Box>
      <Text>|</Text>
    </Box>,
  );

  expect(output).toBe("你好|");
});

test("mixed ASCII and wide characters align correctly", () => {
  const output = renderToString(
    <Box flexDirection="column">
      <Box>
        <Box width={6}>
          <Text>ab🍔cd</Text>
        </Box>
        <Text>|</Text>
      </Box>
      <Box>
        <Box width={6}>
          <Text>abcdef</Text>
        </Box>
        <Text>|</Text>
      </Box>
    </Box>,
  );

  const lines = output.split("\n");
  expect(lines.length).toBe(2);
  expect(lines[0]).toBe("ab🍔cd|");
  expect(lines[1]).toBe("abcdef|");
});

test("ANSI styled text does not affect layout width", () => {
  const output = renderToString(
    <Box>
      <Box width={5}>
        <Text color="red">hello</Text>
      </Box>
      <Text>|</Text>
    </Box>,
  );

  const stripped = stripAnsi(output);
  expect(stripped).toBe("hello|");
});

test("empty Text does not affect sibling layout", () => {
  const output = renderToString(
    <Box>
      <Text />
      <Text>hello</Text>
    </Box>,
  );

  expect(output).toBe("hello");
});

test("truncate CJK text at end", () => {
  const output = renderToString(
    <Box width={20}>
      <Text wrap="truncate">あいうえおかきくけこ|end</Text>
    </Box>,
  );

  const stripped = stripAnsi(output);
  expect(stringWidth(stripped) <= 20).toBe(true);
});

test("truncate CJK text in the middle", () => {
  const output = renderToString(
    <Box width={20}>
      <Text wrap="truncate-middle">あいうえおかきくけこ|end</Text>
    </Box>,
  );

  const stripped = stripAnsi(output);
  expect(stringWidth(stripped) <= 20).toBe(true);
});

test("truncate CJK text at start", () => {
  const output = renderToString(
    <Box width={20}>
      <Text wrap="truncate-start">あいうえおかきくけこ|end</Text>
    </Box>,
  );

  const stripped = stripAnsi(output);
  expect(stringWidth(stripped) <= 20).toBe(true);
});

test("truncate CJK text does not exceed Box width", () => {
  const output = renderToString(
    <Box>
      <Box width={20}>
        <Text wrap="truncate">あいうえおかきくけこ|end</Text>
      </Box>
      <Text>|</Text>
    </Box>,
  );

  const lines = output.split("\n");
  expect(lines.length).toBe(1);

  const stripped = stripAnsi(lines[0]);
  expect(stripped.endsWith("|")).toBe(true);
});

test("overlay on 2nd cell of CJK character clears the full character", () => {
  // Absolute overlay at left=9 lands on the 2nd cell of お (columns 8-9).
  // お should be replaced by a space so the terminal doesn't render
  // a half-visible wide character.
  const output = renderToString(
    <Box width={20} height={1}>
      <Text>あいうえおかきくけこ</Text>
      <Box position="absolute" left={9}>
        <Text>XYZ</Text>
      </Box>
    </Box>,
    { columns: 20 },
  );

  const lines = output.split("\n");
  expect(stringWidth(lines[0])).toBe(20);
  expect(stripAnsi(lines[0])).toBe("あいうえ XYZきくけこ");
});

test("overlay on 1st cell of CJK character clears trailing placeholder", () => {
  // Absolute overlay at left=10 lands on the 1st cell of か (columns 10-11).
  // か's trailing placeholder at column 11 should be cleared to a space.
  const output = renderToString(
    <Box width={20} height={1}>
      <Text>あいうえおかきくけこ</Text>
      <Box position="absolute" left={10}>
        <Text>X</Text>
      </Box>
    </Box>,
    { columns: 20 },
  );

  const lines = output.split("\n");
  expect(stringWidth(lines[0])).toBe(20);
  expect(stripAnsi(lines[0])).toBe("あいうえおX きくけこ");
});

test("CJK overlay on 2nd cell of CJK clears both sides", () => {
  // Absolute overlay at left=5 (2nd cell of う at columns 4-5).
  // 漢字テスト (10 cols) also ends at column 14, overwriting the 1st cell
  // of く (14-15), so く's trailing placeholder must be cleaned too.
  const output = renderToString(
    <Box width={20} height={1}>
      <Text>あいうえおかきくけこ</Text>
      <Box position="absolute" left={5}>
        <Text>漢字テスト</Text>
      </Box>
    </Box>,
    { columns: 20 },
  );

  const lines = output.split("\n");
  expect(stringWidth(lines[0])).toBe(20);
  expect(stripAnsi(lines[0])).toBe("あい 漢字テスト けこ");
});

test("clipped empty write does not corrupt existing wide characters", () => {
  // When a write is clipped to an empty string, the boundary cleanup
  // must not run, otherwise it would destroy a wide character that
  // isn't actually being overwritten.
  const output = renderToString(
    <Box width={4} height={1} overflowX="hidden">
      <Text>あい</Text>
      <Box position="absolute" left={-1} width={1}>
        <Text>Z</Text>
      </Box>
    </Box>,
    { columns: 4 },
  );

  expect(stripAnsi(output)).toBe("あい");
});
