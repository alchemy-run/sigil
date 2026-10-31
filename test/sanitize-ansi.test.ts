import { expect, test } from "vite-plus/test";

import { stripAnsi } from "#/ansi/strip.ts";
import { sanitizeAnsi } from "#/sanitize-ansi.ts";

test("preserve plain text", () => {
  expect(sanitizeAnsi("hello")).toBe("hello");
});

test("preserve SGR sequences", () => {
  const output = sanitizeAnsi("A\u001B[38:2::255:100:0mcolor\u001B[0mB");

  expect(output).toContain("\u001B[38:2::255:100:0m");
  expect(stripAnsi(output)).toBe("AcolorB");
});

test("preserve empty SGR parameters", () => {
  const input = "A\u001B[mB\u001B[;1mC";

  expect(sanitizeAnsi(input)).toBe(input);
});

test("defer SGR sequences until after combining marks", () => {
  expect(sanitizeAnsi("e\u001B[31m\u001B[1ḿX\u001B[39m")).toBe("é\u001B[31m\u001B[1mX\u001B[39m");
});

test("defer a trailing SGR sequence past a combining mark", () => {
  expect(sanitizeAnsi("e\u001B[31ḿ")).toBe("é\u001B[31m");
});

test("keep deferred SGR sequences before a following hyperlink", () => {
  expect(sanitizeAnsi("e\u001B[31ḿ\u001B]8;;https://example.com\u001B\\X")).toBe(
    "é\u001B[31m\u001B]8;;https://example.com\u001B\\X",
  );
});

test("strip cursor controls before checking for combining marks", () => {
  expect(sanitizeAnsi("e\u001B[31m\ŕX")).toBe("é\u001B[31mX");
});

test("preserve OSC hyperlinks", () => {
  const output = sanitizeAnsi("\u001B]8;;https://example.com\u001B\\link\u001B]8;;\u001B\\");

  expect(output).toContain("\u001B]8;;https://example.com");
  expect(stripAnsi(output)).toBe("link");
});

test("preserve OSC hyperlinks terminated by C1 ST", () => {
  const output = sanitizeAnsi("\u001B]8;;https://example.com\u009Clink\u001B]8;;\u009C");

  expect(output).toContain("\u001B]8;;https://example.com\u009C");
  expect(stripAnsi(output)).toBe("link");
});

test("preserve C1 OSC hyperlinks terminated by C1 ST", () => {
  const input = "\u009D8;;https://example.com\u009Clink\u009D8;;\u009C";
  const output = sanitizeAnsi(input);

  expect(output).toContain("\u009D8;;https://example.com\u009C");
  expect(output).toBe(input);
});

test("preserve C1 OSC hyperlinks terminated by ESC ST", () => {
  const input = "\u009D8;;https://example.com\u001B\\link\u009D8;;\u001B\\";
  const output = sanitizeAnsi(input);

  expect(output).toContain("\u009D8;;https://example.com\u001B\\");
  expect(output).toBe(input);
});

test("preserve C1 OSC hyperlinks terminated by BEL", () => {
  const input = "\u009D8;;https://example.com\u0007link\u009D8;;\u0007";
  const output = sanitizeAnsi(input);

  expect(output).toContain("\u009D8;;https://example.com\u0007");
  expect(output).toBe(input);
});

test("preserve OSC hyperlinks with parameters", () => {
  const input = "\u001B]8;id=docs;https://example.com\u001B\\link\u001B]8;;\u001B\\";

  expect(sanitizeAnsi(input)).toBe(input);
});

for (const [name, payload] of [
  ["an OSC 52 clipboard write", "\u001B]52;c;SGVsbG8=\u0007"],
  ["an ESC-escaped OSC 52 clipboard write", "\u001B\u001B]52;c;SGVsbG8=\u0007"],
  ["a C1 OSC 52 clipboard write", "\u009D52;c;SGVsbG8=\u0007"],
  ["a screen clear", "\u001B[2J"],
  ["a C1 screen clear", "\u009B2J"],
  ["a DCS sequence", "\u001BPq#0\u001B\\"],
]) {
  test(`strip OSC hyperlinks whose payload smuggles ${name}`, () => {
    const output = sanitizeAnsi(`\u001B]8;;${payload}\u0007link\u001B]8;;\u0007`);

    expect(output).toBe("link\u001B]8;;\u0007");
  });
}

test("strip OSC sequences other than hyperlinks", () => {
  const output = sanitizeAnsi("A\u001B]0;title\u0007B\u009D52;c;SGVsbG8=\u0007C");

  expect(output).toBe("ABC");
});

test("strip non-SGR CSI sequences as complete units", () => {
  const output = sanitizeAnsi("A\u001B[>4;2mB\u001B[2 qC");

  expect(output).not.toContain("4;2m");
  expect(output).not.toContain(" q");
  expect(stripAnsi(output)).toBe("ABC");
});

test("strip C1 non-SGR CSI sequences as complete units", () => {
  const output = sanitizeAnsi("A\u009B>4;2mB\u009B2 qC");

  expect(output).not.toContain("4;2m");
  expect(output).not.toContain(" q");
  expect(stripAnsi(output)).toBe("ABC");
});

test("preserve C1 SGR CSI sequences", () => {
  const output = sanitizeAnsi("A\u009B31mgreen\u009B0mB");

  expect(output).toContain("\u009B31m");
  expect(stripAnsi(output)).toBe("AgreenB");
});

test("strip private-parameter m-sequences that are not SGR", () => {
  const output = sanitizeAnsi("A\u001B[>4;2mB");

  expect(output).not.toContain("\u001B[>4;2m");
  expect(stripAnsi(output)).toBe("AB");
});

test("strip tmux DCS passthrough wrappers with escaped ST payload terminators", () => {
  const wrappedHyperlinkStart =
    "\u001BPtmux;\u001B\u001B]8;;https://example.com\u001B\u001B\\\u001B\\";
  const wrappedHyperlinkEnd = "\u001BPtmux;\u001B\u001B]8;;\u001B\u001B\\\u001B\\";
  const output = sanitizeAnsi(`${wrappedHyperlinkStart}link${wrappedHyperlinkEnd}`);

  expect(output).not.toContain("tmux;");
  expect(output).not.toContain("\u001BP");
  expect(stripAnsi(output)).toBe("link");
});

test("strip incomplete DCS passthrough sequences to avoid payload leaks", () => {
  const output = sanitizeAnsi("A\u001BPtmux;\u001Blink");

  expect(output).not.toContain("tmux;");
  expect(stripAnsi(output)).toBe("A");
});

test("strip DCS control strings with BEL in payload until ST terminator", () => {
  const output = sanitizeAnsi("A\u001BPpayload\u0007still-payload\u001B\\B");

  expect(output).not.toContain("payload");
  expect(output).not.toContain("still-payload");
  expect(stripAnsi(output)).toBe("AB");
});

test("strip ESC SOS control strings as complete units", () => {
  const output = sanitizeAnsi("A\u001BXpayload\u001B\\B");

  expect(output).not.toContain("payload");
  expect(stripAnsi(output)).toBe("AB");
});

test("strip ESC SOS control strings with C1 ST terminator", () => {
  const output = sanitizeAnsi("A\u001BXpayload\u009CB");

  expect(output).not.toContain("payload");
  expect(stripAnsi(output)).toBe("AB");
});

test("strip C1 SOS control strings as complete units with C1 ST terminator", () => {
  const output = sanitizeAnsi("A\u0098payload\u009CB");

  expect(output).not.toContain("payload");
  expect(stripAnsi(output)).toBe("AB");
});

test("strip C1 SOS control strings as complete units with ESC ST terminator", () => {
  const output = sanitizeAnsi("A\u0098payload\u001B\\B");

  expect(output).not.toContain("payload");
  expect(stripAnsi(output)).toBe("AB");
});

test("strip ESC SOS with BEL terminator as malformed control string", () => {
  const output = sanitizeAnsi("A\u001BXpayload\u0007B");

  expect(output).not.toContain("payload");
  expect(stripAnsi(output)).toBe("A");
});

test("strip C1 SOS with BEL terminator as malformed control string", () => {
  const output = sanitizeAnsi("A\u0098payload\u0007B");

  expect(output).not.toContain("payload");
  expect(stripAnsi(output)).toBe("A");
});

test("strip incomplete ESC SOS control strings to avoid payload leaks", () => {
  const output = sanitizeAnsi("A\u001BXpayload");

  expect(output).not.toContain("payload");
  expect(stripAnsi(output)).toBe("A");
});

test("strip incomplete C1 SOS control strings to avoid payload leaks", () => {
  const output = sanitizeAnsi("A\u0098payload");

  expect(output).not.toContain("payload");
  expect(stripAnsi(output)).toBe("A");
});

test("strip SOS with escaped ESC in payload until final ST terminator", () => {
  const output = sanitizeAnsi("A\u001BXfoo\u001B\u001B\\bar\u001B\\B");

  expect(output).not.toContain("foo");
  expect(output).not.toContain("bar");
  expect(stripAnsi(output)).toBe("AB");
});

test("preserve SGR around stripped SOS control strings", () => {
  const output = sanitizeAnsi("A\u001B[31mR\u001B[0m\u001BXpayload\u001B\\B");

  expect(output).toContain("\u001B[31m");
  expect(output).toContain("\u001B[0m");
  expect(output).not.toContain("payload");
  expect(stripAnsi(output)).toBe("ARB");
});

test("strip ESC ST sequences", () => {
  const output = sanitizeAnsi("A\u001B\\B");

  expect(output).not.toContain("\u001B\\");
  expect(stripAnsi(output)).toBe("AB");
});

test("strip malformed ESC control sequences with intermediates and non-final bytes", () => {
  const output = sanitizeAnsi("A\u001B#\u0007payload");

  expect(output).not.toContain("payload");
  expect(stripAnsi(output)).toBe("A");
});

test("strip incomplete CSI after preserving prior SGR content", () => {
  const output = sanitizeAnsi("A\u001B[31mB\u001B[");

  expect(output).toContain("\u001B[31m");
  expect(stripAnsi(output)).toBe("AB");
});

test("strip standalone ST bytes", () => {
  const output = sanitizeAnsi("A\u009CB");

  expect(output).not.toContain("\u009C");
  expect(stripAnsi(output)).toBe("AB");
});

test("strip standalone C1 control characters", () => {
  const output = sanitizeAnsi("A\u0085B\u008EC");

  expect(output).not.toContain("\u0085");
  expect(output).not.toContain("\u008E");
  expect(stripAnsi(output)).toBe("ABC");
});
