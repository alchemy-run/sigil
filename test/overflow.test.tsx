import { expect, test } from "vite-plus/test";

import { Box, Text } from "#/index.ts";

import { renderToString, renderToStringAsync } from "./helpers/render-to-string.ts";

test("overflowX - single text node in a box inside overflow container", () => {
  const output = renderToString(
    <Box width={6} overflowX="hidden">
      <Box width={16} flexShrink={0}>
        <Text>Hello World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("Hello");
});

test("overflowX - single text node inside overflow container with border", () => {
  const output = renderToString(
    <Box width={6} overflowX="hidden" borderStyle="round">
      <Box width={16} flexShrink={0}>
        <Text>Hello World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(["╭────╮", "│Hell│", "╰────╯"].join("\n"));
});

test("overflowX - single text node in a box with border inside overflow container", () => {
  const output = renderToString(
    <Box width={6} overflowX="hidden">
      <Box width={16} flexShrink={0} borderStyle="round">
        <Text>Hello World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(["╭─────", "│Hello", "╰─────"].join("\n"));
});

test("overflowX - multiple text nodes in a box inside overflow container", () => {
  const output = renderToString(
    <Box width={6} overflowX="hidden">
      <Box width={12} flexShrink={0}>
        <Text>Hello </Text>
        <Text>World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("Hello");
});

test("overflowX - multiple text nodes in a box inside overflow container with border", () => {
  const output = renderToString(
    <Box width={8} overflowX="hidden" borderStyle="round">
      <Box width={12} flexShrink={0}>
        <Text>Hello </Text>
        <Text>World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(["╭──────╮", "│Hello │", "╰──────╯"].join("\n"));
});

test("overflowX - multiple text nodes in a box with border inside overflow container", () => {
  const output = renderToString(
    <Box width={8} overflowX="hidden">
      <Box width={12} flexShrink={0} borderStyle="round">
        <Text>Hello </Text>
        <Text>World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(["╭───────", "│HelloWo", "│", "╰───────"].join("\n"));
});

test("overflowX - multiple boxes inside overflow container", () => {
  const output = renderToString(
    <Box width={6} overflowX="hidden">
      <Box width={6} flexShrink={0}>
        <Text>Hello </Text>
      </Box>
      <Box width={6} flexShrink={0}>
        <Text>World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("Hello");
});

test("overflowX - multiple boxes inside overflow container with border", () => {
  const output = renderToString(
    <Box width={8} overflowX="hidden" borderStyle="round">
      <Box width={6} flexShrink={0}>
        <Text>Hello </Text>
      </Box>
      <Box width={6} flexShrink={0}>
        <Text>World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(["╭──────╮", "│Hello │", "╰──────╯"].join("\n"));
});

test("overflowX - box before left edge of overflow container", () => {
  const output = renderToString(
    <Box width={6} overflowX="hidden">
      <Box marginLeft={-12} width={6} flexShrink={0}>
        <Text>Hello</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("");
});

test("overflowX - box before left edge of overflow container with border", () => {
  const output = renderToString(
    <Box width={6} overflowX="hidden" borderStyle="round">
      <Box marginLeft={-12} width={6} flexShrink={0}>
        <Text>Hello</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(["╭────╮", "│    │", "╰────╯"].join("\n"));
});

test("overflowX - box intersecting with left edge of overflow container", () => {
  const output = renderToString(
    <Box width={6} overflowX="hidden">
      <Box marginLeft={-3} width={12} flexShrink={0}>
        <Text>Hello World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("lo Wor");
});

test("overflowX - box intersecting with left edge of overflow container with border", () => {
  const output = renderToString(
    <Box width={8} overflowX="hidden" borderStyle="round">
      <Box marginLeft={-3} width={12} flexShrink={0}>
        <Text>Hello World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(["╭──────╮", "│lo Wor│", "╰──────╯"].join("\n"));
});

test("overflowX - box after right edge of overflow container", () => {
  const output = renderToString(
    <Box width={6} overflowX="hidden">
      <Box marginLeft={6} width={6} flexShrink={0}>
        <Text>Hello</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("");
});

test("overflowX - box intersecting with right edge of overflow container", () => {
  const output = renderToString(
    <Box width={6} overflowX="hidden">
      <Box marginLeft={3} width={6} flexShrink={0}>
        <Text>Hello</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("   Hel");
});

test("overflowY - single text node inside overflow container", () => {
  const output = renderToString(
    <Box height={1} overflowY="hidden">
      <Text>Hello{"\n"}World</Text>
    </Box>,
  );

  expect(output).toBe("Hello");
});

test("overflowY - single text node inside overflow container with border", () => {
  const output = renderToString(
    <Box width={20} height={3} overflowY="hidden" borderStyle="round">
      <Text>Hello{"\n"}World</Text>
    </Box>,
  );

  expect(output).toBe(
    ["╭──────────────────╮", "│Hello             │", "╰──────────────────╯"].join("\n"),
  );
});

test("overflowY - multiple boxes inside overflow container", () => {
  const output = renderToString(
    <Box height={2} overflowY="hidden" flexDirection="column">
      <Box flexShrink={0}>
        <Text>Line #1</Text>
      </Box>
      <Box flexShrink={0}>
        <Text>Line #2</Text>
      </Box>
      <Box flexShrink={0}>
        <Text>Line #3</Text>
      </Box>
      <Box flexShrink={0}>
        <Text>Line #4</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("Line #1\nLine #2");
});

test("overflowY - multiple boxes inside overflow container with border", () => {
  const output = renderToString(
    <Box width={9} height={4} overflowY="hidden" flexDirection="column" borderStyle="round">
      <Box flexShrink={0}>
        <Text>Line #1</Text>
      </Box>
      <Box flexShrink={0}>
        <Text>Line #2</Text>
      </Box>
      <Box flexShrink={0}>
        <Text>Line #3</Text>
      </Box>
      <Box flexShrink={0}>
        <Text>Line #4</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(["╭───────╮", "│Line #1│", "│Line #2│", "╰───────╯"].join("\n"));
});

test("overflowY - box above top edge of overflow container", () => {
  const output = renderToString(
    <Box height={1} overflowY="hidden">
      <Box marginTop={-2} height={2} flexShrink={0}>
        <Text>Hello{"\n"}World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("");
});

test("overflowY - box above top edge of overflow container with border", () => {
  const output = renderToString(
    <Box width={7} height={3} overflowY="hidden" borderStyle="round">
      <Box marginTop={-3} height={2} flexShrink={0}>
        <Text>Hello{"\n"}World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(["╭─────╮", "│     │", "╰─────╯"].join("\n"));
});

test("overflowY - box intersecting with top edge of overflow container", () => {
  const output = renderToString(
    <Box height={1} overflowY="hidden">
      <Box marginTop={-1} height={2} flexShrink={0}>
        <Text>Hello{"\n"}World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("World");
});

test("overflowY - box intersecting with top edge of overflow container with border", () => {
  const output = renderToString(
    <Box width={7} height={3} overflowY="hidden" borderStyle="round">
      <Box marginTop={-1} height={2} flexShrink={0}>
        <Text>Hello{"\n"}World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(["╭─────╮", "│World│", "╰─────╯"].join("\n"));
});

test("overflowY - box below bottom edge of overflow container", () => {
  const output = renderToString(
    <Box height={1} overflowY="hidden">
      <Box marginTop={1} height={2} flexShrink={0}>
        <Text>Hello{"\n"}World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("");
});

test("overflowY - box below bottom edge of overflow container with border", () => {
  const output = renderToString(
    <Box width={7} height={3} overflowY="hidden" borderStyle="round">
      <Box marginTop={2} height={2} flexShrink={0}>
        <Text>Hello{"\n"}World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(["╭─────╮", "│     │", "╰─────╯"].join("\n"));
});

test("overflowY - box intersecting with bottom edge of overflow container", () => {
  const output = renderToString(
    <Box height={1} overflowY="hidden">
      <Box height={2} flexShrink={0}>
        <Text>Hello{"\n"}World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("Hello");
});

test("overflowY - box intersecting with bottom edge of overflow container with border", () => {
  const output = renderToString(
    <Box width={7} height={3} overflowY="hidden" borderStyle="round">
      <Box height={2} flexShrink={0}>
        <Text>Hello{"\n"}World</Text>
      </Box>
    </Box>,
  );

  expect(output).toBe(["╭─────╮", "│Hello│", "╰─────╯"].join("\n"));
});

test("overflow - single text node inside overflow container", () => {
  const output = renderToString(
    <Box paddingBottom={1}>
      <Box width={6} height={1} overflow="hidden">
        <Box width={12} height={2} flexShrink={0}>
          <Text>Hello{"\n"}World</Text>
        </Box>
      </Box>
    </Box>,
  );

  expect(output).toBe("Hello\n");
});

test("overflow - single text node inside overflow container with border", () => {
  const output = renderToString(
    <Box paddingBottom={1}>
      <Box width={8} height={3} overflow="hidden" borderStyle="round">
        <Box width={12} height={2} flexShrink={0}>
          <Text>Hello{"\n"}World</Text>
        </Box>
      </Box>
    </Box>,
  );

  expect(output).toBe(`${["╭──────╮", "│Hello │", "╰──────╯"].join("\n")}\n`);
});

test("overflow - multiple boxes inside overflow container", () => {
  const output = renderToString(
    <Box paddingBottom={1}>
      <Box width={4} height={1} overflow="hidden">
        <Box width={2} height={2} flexShrink={0}>
          <Text>TL{"\n"}BL</Text>
        </Box>
        <Box width={2} height={2} flexShrink={0}>
          <Text>TR{"\n"}BR</Text>
        </Box>
      </Box>
    </Box>,
  );

  expect(output).toBe("TLTR\n");
});

test("overflow - multiple boxes inside overflow container with border", () => {
  const output = renderToString(
    <Box paddingBottom={1}>
      <Box width={6} height={3} overflow="hidden" borderStyle="round">
        <Box width={2} height={2} flexShrink={0}>
          <Text>TL{"\n"}BL</Text>
        </Box>
        <Box width={2} height={2} flexShrink={0}>
          <Text>TR{"\n"}BR</Text>
        </Box>
      </Box>
    </Box>,
  );

  expect(output).toBe(`${["╭────╮", "│TLTR│", "╰────╯"].join("\n")}\n`);
});

test("overflow - box intersecting with top left edge of overflow container", () => {
  const output = renderToString(
    <Box width={4} height={4} overflow="hidden">
      <Box marginTop={-2} marginLeft={-2} width={4} height={4} flexShrink={0}>
        <Text>
          AAAA{"\n"}BBBB{"\n"}CCCC{"\n"}DDDD
        </Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("CC\nDD\n\n");
});

test("overflow - box intersecting with top right edge of overflow container", () => {
  const output = renderToString(
    <Box width={4} height={4} overflow="hidden">
      <Box marginTop={-2} marginLeft={2} width={4} height={4} flexShrink={0}>
        <Text>
          AAAA{"\n"}BBBB{"\n"}CCCC{"\n"}DDDD
        </Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("  CC\n  DD\n\n");
});

test("overflow - box intersecting with bottom left edge of overflow container", () => {
  const output = renderToString(
    <Box width={4} height={4} overflow="hidden">
      <Box marginTop={2} marginLeft={-2} width={4} height={4} flexShrink={0}>
        <Text>
          AAAA{"\n"}BBBB{"\n"}CCCC{"\n"}DDDD
        </Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("\n\nAA\nBB");
});

test("overflow - box intersecting with bottom right edge of overflow container", () => {
  const output = renderToString(
    <Box width={4} height={4} overflow="hidden">
      <Box marginTop={2} marginLeft={2} width={4} height={4} flexShrink={0}>
        <Text>
          AAAA{"\n"}BBBB{"\n"}CCCC{"\n"}DDDD
        </Text>
      </Box>
    </Box>,
  );

  expect(output).toBe("\n\n  AA\n  BB");
});

test("nested overflow", () => {
  const output = renderToString(
    <Box paddingBottom={1}>
      <Box width={4} height={4} overflow="hidden" flexDirection="column">
        <Box width={2} height={2} overflow="hidden">
          <Box width={4} height={4} flexShrink={0}>
            <Text>
              AAAA{"\n"}BBBB{"\n"}CCCC{"\n"}DDDD
            </Text>
          </Box>
        </Box>

        <Box width={4} height={3}>
          <Text>
            XXXX{"\n"}YYYY{"\n"}ZZZZ
          </Text>
        </Box>
      </Box>
    </Box>,
  );

  expect(output).toBe("AA\nBB\nXXXX\nYYYY\n");
});

// See https://github.com/vadimdemedes/ink/pull/564#issuecomment-1637022742
test("out of bounds writes do not crash", () => {
  const output = renderToString(<Box width={12} height={10} borderStyle="round" />, {
    columns: 10,
  });

  const expected = [
    "╭──────────╮",
    "│          │",
    "│          │",
    "│          │",
    "│          │",
    "│          │",
    "│          │",
    "│          │",
    "│          │",
    "╰──────────╯",
  ]
    .join("\n")
    .split("\n")
    .map((line, index) => {
      return index === 0 || index === 9 ? line : `${line.slice(0, 10)}${line[11] ?? ""}`;
    })
    .join("\n");

  expect(output).toBe(expected);
});

// Concurrent mode tests
test("overflowX - single text node in a box inside overflow container - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box width={6} overflowX="hidden">
      <Box width={16} flexShrink={0}>
        <Text>Hello World</Text>
      </Box>
    </Box>,
  );
  expect(output).toBe("Hello");
});

test("overflowY - single text node inside overflow container - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box height={1} overflowY="hidden">
      <Text>Hello{"\n"}World</Text>
    </Box>,
  );
  expect(output).toBe("Hello");
});

test("overflow - single text node inside overflow container - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box paddingBottom={1}>
      <Box width={6} height={1} overflow="hidden">
        <Box width={12} height={2} flexShrink={0}>
          <Text>Hello{"\n"}World</Text>
        </Box>
      </Box>
    </Box>,
  );
  expect(output).toBe("Hello\n");
});

test("nested overflow - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box paddingBottom={1}>
      <Box width={4} height={4} overflow="hidden" flexDirection="column">
        <Box width={2} height={2} overflow="hidden">
          <Box width={4} height={4} flexShrink={0}>
            <Text>
              AAAA{"\n"}BBBB{"\n"}CCCC{"\n"}DDDD
            </Text>
          </Box>
        </Box>

        <Box width={4} height={3}>
          <Text>
            XXXX{"\n"}YYYY{"\n"}ZZZZ
          </Text>
        </Box>
      </Box>
    </Box>,
  );
  expect(output).toBe("AA\nBB\nXXXX\nYYYY\n");
});
