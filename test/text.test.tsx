import { afterAll, expect, test } from "vite-plus/test";

import { chalk } from "#/ansi/chalk.ts";
import { stripAnsi } from "#/ansi/strip.ts";
import { render, Box, Text } from "#/index.ts";

import createStdout from "./helpers/create-stdout.ts";
import { renderToString, renderToStringAsync } from "./helpers/render-to-string.ts";
import { renderAsync } from "./helpers/test-renderer.ts";

const renderText = (text: string): string =>
  renderToString(
    <Box>
      <Text>{text}</Text>
    </Box>,
  );

test("<Text> with undefined children", () => {
  const output = renderToString(<Text />);
  expect(output).toBe("");
});

test("<Text> with null children", () => {
  const output = renderToString(<Text>{null}</Text>);
  expect(output).toBe("");
});

test("text with standard color", () => {
  const output = renderToString(<Text color="green">Test</Text>);
  expect(output).toBe(chalk.green("Test"));
});

test("text with dim+bold", () => {
  const originalLevel = chalk.level;
  chalk.level = 3;
  afterAll(() => {
    chalk.level = originalLevel;
  });

  const output = renderToString(
    <Text dimColor bold>
      Test
    </Text>,
  );

  expect(stripAnsi(output)).toBe("Test");
  expect(output).not.toBe("Test"); // Ensure ANSI codes are present
});

test("text with dimmed color", () => {
  const output = renderToString(
    <Text dimColor color="green">
      Test
    </Text>,
  );

  expect(output).toBe(chalk.green(chalk.dim("Test")));
});

test("text with hex color", () => {
  const output = renderToString(<Text color="#FF8800">Test</Text>);
  expect(output).toBe(chalk.hex("#FF8800")("Test"));
});

test("text with rgb color", () => {
  const output = renderToString(<Text color="rgb(255, 136, 0)">Test</Text>);
  expect(output).toBe(chalk.rgb(255, 136, 0)("Test"));
});

test("text with ansi256 color", () => {
  const output = renderToString(<Text color="ansi256(194)">Test</Text>);
  expect(output).toBe(chalk.ansi256(194)("Test"));
});

test("text with standard background color", () => {
  const output = renderToString(<Text backgroundColor="green">Test</Text>);
  expect(output).toBe(chalk.bgGreen("Test"));
});

test("text with hex background color", () => {
  const output = renderToString(<Text backgroundColor="#FF8800">Test</Text>);
  expect(output).toBe(chalk.bgHex("#FF8800")("Test"));
});

test("text with rgb background color", () => {
  const output = renderToString(<Text backgroundColor="rgb(255, 136, 0)">Test</Text>);

  expect(output).toBe(chalk.bgRgb(255, 136, 0)("Test"));
});

test("text with ansi256 background color", () => {
  const output = renderToString(<Text backgroundColor="ansi256(194)">Test</Text>);

  expect(output).toBe(chalk.bgAnsi256(194)("Test"));
});

test("text with inversion", () => {
  const output = renderToString(<Text inverse>Test</Text>);
  expect(output).toBe(chalk.inverse("Test"));
});

// See https://github.com/vadimdemedes/ink/issues/867
test("text with empty-to-nonempty sibling does not wrap", () => {
  function Test({ show }: { readonly show?: boolean }) {
    return (
      <Box>
        <Text>
          {show ? "x" : ""}
          {"hello"}
        </Text>
      </Box>
    );
  }

  const stdout = createStdout();
  const { rerender } = render(<Test />, { stdout, debug: true });
  expect(stdout.write.mock.lastCall![0]).toBe("hello");

  rerender(<Test show />);
  expect(stdout.write.mock.lastCall![0]).toBe("xhello");
});

test("remeasure text when text is changed", () => {
  function Test({ add }: { readonly add?: boolean }) {
    return (
      <Box>
        <Text>{add ? "abcx" : "abc"}</Text>
      </Box>
    );
  }

  const stdout = createStdout();
  const { rerender } = render(<Test />, { stdout, debug: true });
  expect(stdout.write.mock.lastCall![0]).toBe("abc");

  rerender(<Test add />);
  expect(stdout.write.mock.lastCall![0]).toBe("abcx");
});

test("remeasure text when text nodes are changed", () => {
  function Test({ add }: { readonly add?: boolean }) {
    return (
      <Box>
        <Text>
          abc
          {add ? <Text>x</Text> : null}
        </Text>
      </Box>
    );
  }

  const stdout = createStdout();

  const { rerender } = render(<Test />, { stdout, debug: true });
  expect(stdout.write.mock.lastCall![0]).toBe("abc");

  rerender(<Test add />);
  expect(stdout.write.mock.lastCall![0]).toBe("abcx");
});

// See https://github.com/vadimdemedes/ink/issues/743
// Without the fix, the output was ''.
test('text with content "constructor" wraps correctly', () => {
  const output = renderToString(<Text>constructor</Text>);
  expect(output).toBe("constructor");
});

// See https://github.com/vadimdemedes/ink/issues/362
test("strip ANSI cursor movement sequences from text", () => {
  // \x1b[1A = cursor up, \x1b[2K = clear line, \x1b[1B = cursor down
  // \x1b[32m = green (SGR, preserved), \x1b[0m = reset (SGR, preserved)
  const input = "\u001B[1A\u001B[2KStarting client ... \u001B[32mdone\u001B[0m\u001B[1B";

  const output = renderToString(
    <Box>
      <Text>{input}</Text>
    </Box>,
  );

  expect(output).not.toContain("\u001B[1A");
  expect(output).not.toContain("\u001B[2K");
  expect(output).not.toContain("\u001B[1B");
  expect(stripAnsi(output)).toBe("Starting client ... done");
});

test("strip ANSI cursor position and erase sequences from text", () => {
  const output = renderToString(
    <Box>
      <Text>{"Hello\u001B[5;10HWorld\u001B[2J!"}</Text>
    </Box>,
  );

  expect(output).not.toContain("\u001B[5;10H");
  expect(output).not.toContain("\u001B[2J");
  expect(stripAnsi(output)).toBe("HelloWorld!");
});

test("strip SGR color sequences from ordinary text", () => {
  const output = renderToString(
    <Box>
      <Text>{"\u001B[32mgreen\u001B[0m normal"}</Text>
    </Box>,
  );

  expect(output).toBe("green normal");
});

test("strip OSC hyperlink sequences from ordinary text", () => {
  const output = renderText("\u001B]8;;https://example.com\u0007link\u001B]8;;\u0007");

  expect(output).toBe("link");
});

test("strip ST-terminated OSC hyperlinks from ordinary text", () => {
  const output = renderText("\u001B]8;;https://example.com\u001B\\link\u001B]8;;\u001B\\");

  expect(output).toBe("link");
});

test("strip C1 OSC hyperlinks from ordinary text", () => {
  // C1 introducers are normalized to their 7-bit form: C1 bytes are not
  // interpreted as control characters by many terminals in UTF-8 mode, so the
  // ESC form is the robust way to preserve the link.
  const input = "\u009D8;;https://example.com\u0007link\u009D8;;\u0007";
  const output = renderText(input);

  expect(output).toBe("link");
});

test("strip ST-terminated C1 OSC hyperlinks from ordinary text", () => {
  const input = "\u009D8;;https://example.com\u001B\\link\u009D8;;\u001B\\";
  const output = renderText(input);

  expect(output).toBe("link");
});

test("strip colon-form SGR sequences from ordinary text", () => {
  const output = renderText("A\u001B[38:2::255:100:0mcolor\u001B[0mB");

  expect(output).toBe("AcolorB");
});

test("strip complete non-SGR CSI sequences without leaking parameters", () => {
  const input = "A\u001B[>4;2mB\u001B[2 qC";
  const output = renderText(input);

  expect(output).not.toContain("4;2m");
  expect(output).not.toContain(" q");
  expect(stripAnsi(output)).toBe("ABC");
});

test("strip complete C1 non-SGR CSI sequences without leaking parameters", () => {
  const output = renderText("A\u009B>4;2mB\u009B2 qC");

  expect(output).not.toContain("4;2m");
  expect(output).not.toContain(" q");
  expect(stripAnsi(output)).toBe("ABC");
});

test("strip complete ESC control sequences with intermediates", () => {
  const output = renderText("A\u001B#8B\u001BcC");

  expect(output).not.toContain("\u001B#8");
  expect(output).not.toContain("\u001Bc");
  expect(stripAnsi(output)).toBe("ABC");
});

test("strip tmux DCS passthrough wrappers without leaking payload", () => {
  const wrappedHyperlinkStart = "\u001BPtmux;\u001B\u001B]8;;https://example.com\u0007\u001B\\";
  const wrappedHyperlinkEnd = "\u001BPtmux;\u001B\u001B]8;;\u0007\u001B\\";
  const output = renderText(`${wrappedHyperlinkStart}link${wrappedHyperlinkEnd}`);

  expect(output).not.toContain("tmux;");
  expect(output).not.toContain("\u001BP");
  expect(output).not.toContain("\u001B\\");
  expect(stripAnsi(output)).toBe("link");
});

test("strip tmux DCS passthrough wrappers with ST-terminated OSC payload", () => {
  const wrappedHyperlinkStart =
    "\u001BPtmux;\u001B\u001B]8;;https://example.com\u001B\u001B\\\u001B\\";
  const wrappedHyperlinkEnd = "\u001BPtmux;\u001B\u001B]8;;\u001B\u001B\\\u001B\\";
  const output = renderText(`${wrappedHyperlinkStart}link${wrappedHyperlinkEnd}`);

  expect(output).not.toContain("tmux;");
  expect(output).not.toContain("\u001B\\");
  expect(stripAnsi(output)).toBe("link");
});

test("strip C1 DCS control strings as complete units", () => {
  const output = renderText("A\u0090payload\u001B\\B\u0090payload\u009CC");

  expect(output).not.toContain("payload");
  expect(stripAnsi(output)).toBe("ABC");
});

test("strip PM and APC control strings as complete units", () => {
  const output = renderText("A\u001B^pm-payload\u001B\\B\u001B_apc-payload\u001B\\C");

  expect(output).not.toContain("pm-payload");
  expect(output).not.toContain("apc-payload");
  expect(stripAnsi(output)).toBe("ABC");
});

test("strip C1 PM and APC control strings as complete units", () => {
  const output = renderText("A\u009Epm-payload\u009CB\u009Fapc-payload\u009CC");

  expect(output).not.toContain("pm-payload");
  expect(output).not.toContain("apc-payload");
  expect(stripAnsi(output)).toBe("ABC");
});

test("strip ESC SOS control strings as complete units", () => {
  const output = renderText("A\u001BXpayload\u001B\\B");

  expect(output).not.toContain("payload");
  expect(stripAnsi(output)).toBe("AB");
});

test("strip C1 SOS control strings as complete units", () => {
  const output = renderText("A\u0098payload\u001B\\B\u0098payload\u009CC");

  expect(output).not.toContain("payload");
  expect(stripAnsi(output)).toBe("ABC");
});

test("strip malformed SOS control strings to avoid payload leaks", () => {
  const output = renderText("A\u001BXpayload\u0007B\u0098payload");

  expect(output).not.toContain("payload");
  expect(stripAnsi(output)).toBe("A");
});

test("strip SGR sequences around stripped SOS control strings", () => {
  const output = renderText("A\u001B[32mgreen\u001B[0m\u001BXpayload\u001B\\B");

  expect(output).not.toContain("payload");
  expect(output).toBe("AgreenB");
});

test("strip tmux DCS passthrough containing BEL until the final ST terminator", () => {
  const input = "A\u001BPtmux;\u001B\u001B]0;title\u0007\u001B\\B";
  const output = renderText(input);

  expect(output).not.toContain("tmux;");
  expect(output).not.toContain("title");
  expect(stripAnsi(output)).toBe("AB");
});

test("strip incomplete DCS passthrough sequences to avoid payload leaks", () => {
  const incompleteSequence = "\u001BPtmux;\u001B";
  const output = renderText(`${incompleteSequence}link`);

  expect(output).not.toContain("tmux;");
  expect(stripAnsi(output)).toBe("");
});

test("strip incomplete C1 DCS control strings to avoid payload leaks", () => {
  const output = renderText("A\u0090payload");

  expect(output).not.toContain("payload");
  expect(stripAnsi(output)).toBe("A");
});

test("strip incomplete OSC control strings to avoid payload leaks", () => {
  const output = renderText("A\u001B]8;;https://example.comlink");

  expect(output).not.toContain("https://example.com");
  expect(stripAnsi(output)).toBe("A");
});

test("strip incomplete C1 OSC control strings to avoid payload leaks", () => {
  const output = renderText("A\u009D8;;https://example.comlink");

  expect(output).not.toContain("https://example.com");
  expect(stripAnsi(output)).toBe("A");
});

test("strip incomplete ESC control sequences with intermediates to avoid payload leaks", () => {
  const output = renderText("A\u001B#");

  expect(output).not.toContain("\u001B#");
  expect(stripAnsi(output)).toBe("A");
});

test("strip malformed ESC control sequences with intermediates and non-final bytes", () => {
  const output = renderText("A\u001B#\u0007payload");

  expect(output).not.toContain("payload");
  expect(stripAnsi(output)).toBe("A");
});

test("strip standalone ST bytes from text output", () => {
  const output = renderText("A\u009CB");

  expect(output).not.toContain("\u009C");
  expect(stripAnsi(output)).toBe("AB");
});

test("strip standalone C1 control characters from text output", () => {
  const output = renderText("A\u0085B\u008EC");

  expect(output).not.toContain("\u0085");
  expect(output).not.toContain("\u008E");
  expect(stripAnsi(output)).toBe("ABC");
});

// Concurrent mode tests
test("<Text> with undefined children - concurrent", async () => {
  const output = await renderToStringAsync(<Text />);
  expect(output).toBe("");
});

test("<Text> with null children - concurrent", async () => {
  const output = await renderToStringAsync(<Text>{null}</Text>);
  expect(output).toBe("");
});

test("text with standard color - concurrent", async () => {
  const output = await renderToStringAsync(<Text color="green">Test</Text>);
  expect(output).toBe(chalk.green("Test"));
});

test("text with dim+bold - concurrent", async () => {
  const originalLevel = chalk.level;
  chalk.level = 3;
  afterAll(() => {
    chalk.level = originalLevel;
  });

  const output = await renderToStringAsync(
    <Text dimColor bold>
      Test
    </Text>,
  );

  expect(stripAnsi(output)).toBe("Test");
  expect(output).not.toBe("Test"); // Ensure ANSI codes are present
});

test("text with hex color - concurrent", async () => {
  const output = await renderToStringAsync(<Text color="#FF8800">Test</Text>);
  expect(output).toBe(chalk.hex("#FF8800")("Test"));
});

test("text with inversion - concurrent", async () => {
  const output = await renderToStringAsync(<Text inverse>Test</Text>);
  expect(output).toBe(chalk.inverse("Test"));
});

test("remeasure text when text is changed - concurrent", async () => {
  function Test({ add }: { readonly add?: boolean }) {
    return (
      <Box>
        <Text>{add ? "abcx" : "abc"}</Text>
      </Box>
    );
  }

  const { getOutput, rerenderAsync } = await renderAsync(<Test />);
  expect(getOutput()).toBe("abc");

  await rerenderAsync(<Test add />);
  expect(getOutput()).toBe("abcx");
});

test("remeasure text when text nodes are changed - concurrent", async () => {
  function Test({ add }: { readonly add?: boolean }) {
    return (
      <Box>
        <Text>
          abc
          {add ? <Text>x</Text> : null}
        </Text>
      </Box>
    );
  }

  const { getOutput, rerenderAsync } = await renderAsync(<Test />);
  expect(getOutput()).toBe("abc");

  await rerenderAsync(<Test add />);
  expect(getOutput()).toBe("abcx");
});
