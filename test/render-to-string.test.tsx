import React, { useEffect, useLayoutEffect, useState } from "react";
import { expect, test } from "vite-plus/test";

import { chalk } from "#/ansi/chalk.ts";
import { Box, Text, Static, Transform, Newline, Spacer, renderToString } from "#/index.ts";

// ── Basic rendering ─────────────────────────────────────

test("render simple text", () => {
  const output = renderToString(<Text>Hello World</Text>);
  expect(output).toBe("Hello World");
});

test("render text with variable", () => {
  const output = renderToString(<Text>Count: {42}</Text>);
  expect(output).toBe("Count: 42");
});

test("render nested text components", () => {
  function World() {
    return <Text>World</Text>;
  }

  const output = renderToString(
    <Text>
      Hello <World />
    </Text>,
  );

  expect(output).toBe("Hello World");
});

test("render empty fragment", () => {
  const output = renderToString(<></>); // eslint-disable-line react/jsx-no-useless-fragment
  expect(output).toBe("");
});

test("render null children", () => {
  const output = renderToString(<Text>{null}</Text>);
  expect(output).toBe("");
});

// ── Layout ──────────────────────────────────────────────

test("render box with padding", () => {
  const output = renderToString(
    <Box paddingLeft={2}>
      <Text>Padded</Text>
    </Box>,
  );

  expect(output).toBe("  Padded");
});

test("render box with flex direction row", () => {
  const output = renderToString(
    <Box>
      <Text>A</Text>
      <Text>B</Text>
      <Text>C</Text>
    </Box>,
  );

  expect(output).toBe("ABC");
});

test("render box with flex direction column", () => {
  const output = renderToString(
    <Box flexDirection="column">
      <Text>Line 1</Text>
      <Text>Line 2</Text>
    </Box>,
  );

  expect(output).toBe("Line 1\nLine 2");
});

test("render margin", () => {
  const output = renderToString(
    <Box marginLeft={2}>
      <Text>Margined</Text>
    </Box>,
  );

  expect(output).toBe("  Margined");
});

test("render gap between items", () => {
  const output = renderToString(
    <Box gap={1}>
      <Text>A</Text>
      <Text>B</Text>
    </Box>,
  );

  expect(output).toBe("A B");
});

test("render box with fixed width and height", () => {
  const output = renderToString(
    <Box width={10} height={3}>
      <Text>Hi</Text>
    </Box>,
  );

  const lines = output.split("\n");
  expect(lines.length).toBe(3);
});

test("render spacer pushes content apart", () => {
  const output = renderToString(
    <Box width={20}>
      <Text>Left</Text>
      <Spacer />
      <Text>Right</Text>
    </Box>,
  );

  expect(output).toBe("Left           Right");
});

test("render newline inserts blank line", () => {
  const output = renderToString(
    <Box flexDirection="column">
      <Text>Above</Text>
      <Newline />
      <Text>Below</Text>
    </Box>,
  );

  expect(output).toBe("Above\n\n\nBelow");
});

test("render box with border", () => {
  const output = renderToString(
    <Box borderStyle="single" width={20}>
      <Text>Bordered</Text>
    </Box>,
    { columns: 20 },
  );

  expect(output).toBe(
    ["┌──────────────────┐", "│Bordered          │", "└──────────────────┘"].join("\n"),
  );
});

// ── Styling ─────────────────────────────────────────────

test("render colored text", () => {
  const output = renderToString(<Text color="green">Green</Text>);
  expect(output).toBe(chalk.green("Green"));
});

test("render bold text", () => {
  const output = renderToString(<Text bold>Bold</Text>);
  expect(output).toBe(chalk.bold("Bold"));
});

// ── Text wrapping and columns ───────────────────────────

test("render text with wrap", () => {
  const output = renderToString(
    <Box width={7}>
      <Text wrap="wrap">Hello World</Text>
    </Box>,
  );

  expect(output).toBe("Hello\nWorld");
});

test("render text with truncate", () => {
  const output = renderToString(
    <Box width={7}>
      <Text wrap="truncate">Hello World</Text>
    </Box>,
  );

  expect(output).toBe("Hello …");
});

test("default columns is 80", () => {
  const longText = "A".repeat(100);
  const output = renderToString(<Text>{longText}</Text>);

  const lines = output.split("\n");
  expect(lines.length).toBe(2);
  expect(lines[0]).toBe("A".repeat(80));
  expect(lines[1]).toBe("A".repeat(20));
});

test("custom columns option", () => {
  const longText = "A".repeat(50);
  const output = renderToString(<Text>{longText}</Text>, { columns: 30 });

  const lines = output.split("\n");
  expect(lines.length).toBe(2);
  expect(lines[0]).toBe("A".repeat(30));
  expect(lines[1]).toBe("A".repeat(20));
});

// ── Components ──────────────────────────────────────────

test("render Transform component", () => {
  const output = renderToString(
    <Transform transform={(text) => text.toUpperCase()}>
      <Text>hello</Text>
    </Transform>,
  );

  expect(output).toBe("HELLO");
});

test("render Static component with items", () => {
  const items = ["A", "B", "C"];

  const output = renderToString(
    <Box flexDirection="column">
      <Static items={items}>{(item) => <Text key={item}>{item}</Text>}</Static>
      <Text>Dynamic</Text>
    </Box>,
  );

  expect(output).toBe("A\nB\nC\nDynamic");
});

test("render static-only output has no trailing newline", () => {
  const items = ["A", "B"];

  const output = renderToString(
    <Static items={items}>{(item) => <Text key={item}>{item}</Text>}</Static>,
  );

  expect(output).toBe("A\nB");
});

test("render static + dynamic output has exactly one newline between parts", () => {
  const items = ["A", "B"];

  const output = renderToString(
    <Box flexDirection="column">
      <Static items={items}>{(item) => <Text key={item}>{item}</Text>}</Static>
      <Text>Dynamic</Text>
    </Box>,
  );

  expect(output).toBe("A\nB\nDynamic");
});

// ── Effect behavior ─────────────────────────────────────

test("captures initial render output before effect-driven state updates", () => {
  function App() {
    const [text, setText] = useState("Initial");

    useEffect(() => {
      setText("Updated");
    }, []);

    return <Text>{text}</Text>;
  }

  const output = renderToString(<App />);
  expect(output).toBe("Initial");
});

test("useLayoutEffect state updates are reflected in output", () => {
  function App() {
    const [text, setText] = useState("Initial");

    useLayoutEffect(() => {
      setText("Layout Updated");
    }, []);

    return <Text>{text}</Text>;
  }

  const output = renderToString(<App />);
  expect(output).toBe("Layout Updated");
});

test("runs effect cleanup on teardown", () => {
  let cleanupRan = false;

  function App() {
    useEffect(() => {
      return () => {
        cleanupRan = true;
      };
    }, []);

    return <Text>Cleanup test</Text>;
  }

  const output = renderToString(<App />);
  expect(output).toBe("Cleanup test");
  expect(cleanupRan).toBe(true);
});

// ── Error handling ──────────────────────────────────────

test("component that throws propagates the error", () => {
  function Broken(): React.JSX.Element {
    throw new Error("Component error");
  }

  expect(() => renderToString(<Broken />)).toThrow("Component error");
});

test("text outside Text component throws", () => {
  expect(() => renderToString(<Box>{"raw text"}</Box>)).toThrow(
    `Text string "raw text" must be rendered inside <Text> component`,
  );
});

test("subsequent calls work after a component error", () => {
  function Broken(): React.JSX.Element {
    throw new Error("Boom");
  }

  expect(() => renderToString(<Broken />)).toThrow("Boom");
  const output = renderToString(<Text>Still works</Text>);
  expect(output).toBe("Still works");
});

// ── Independence ────────────────────────────────────────

test("can be called multiple times independently", () => {
  const output1 = renderToString(<Text>First</Text>);
  const output2 = renderToString(<Text>Second</Text>);

  expect(output1).toBe("First");
  expect(output2).toBe("Second");
});

// ── Deeply nested tree ──────────────────────────────────

test("render deeply nested component tree", () => {
  const output = renderToString(
    <Box flexDirection="column">
      <Box paddingLeft={1}>
        <Box>
          <Text bold>
            {"Nested "}
            <Text color="green">deep</Text>
          </Text>
        </Box>
      </Box>
    </Box>,
  );

  expect(output).toContain("Nested");
  expect(output).toContain("deep");
});
