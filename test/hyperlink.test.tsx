import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { BEL, OSC } from "#/ansi/escapes.ts";
import { createSupportsHyperlinks } from "#/ansi/supports-hyperlinks.ts";
import { Hyperlink, Text } from "#/index.ts";

import { renderToString } from "./helpers/render-to-string.ts";

const OSC8_OPEN = `${OSC}8;;https://example.com${BEL}`;
const OSC8_CLOSE = `${OSC}8;;${BEL}`;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Hyperlink", () => {
  test("wraps text in OSC 8 sequences when supported", () => {
    vi.stubEnv("FORCE_HYPERLINK", "1");

    const output = renderToString(<Hyperlink url="https://example.com">Docs</Hyperlink>);

    expect(output).toBe(`${OSC8_OPEN}Docs${OSC8_CLOSE}`);
  });

  test("gives each wrapped line its own complete pair", () => {
    vi.stubEnv("FORCE_HYPERLINK", "1");

    const output = renderToString(
      <Hyperlink url="https://example.com">some very long link text</Hyperlink>,
      { columns: 10 },
    );

    const lines = output.split("\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.startsWith(OSC8_OPEN)).toBe(true);
      expect(line.endsWith(OSC8_CLOSE)).toBe(true);
    }
  });

  test("falls back to appending the URL when unsupported", () => {
    vi.stubEnv("FORCE_HYPERLINK", "0");

    const output = renderToString(<Hyperlink url="https://example.com">Docs</Hyperlink>);

    expect(output).not.toContain(`${OSC}8;`);
    expect(output).toContain("Docs");
    expect(output).toContain("(https://example.com)");
  });

  test("renders the text alone with fallback disabled", () => {
    vi.stubEnv("FORCE_HYPERLINK", "0");

    const output = renderToString(
      <Hyperlink url="https://example.com" fallback={false}>
        Docs
      </Hyperlink>,
    );

    expect(output).not.toContain(`${OSC}8;`);
    expect(output).not.toContain("https://example.com");
    expect(output).toContain("Docs");
  });

  test("passes Text styling through", () => {
    vi.stubEnv("FORCE_HYPERLINK", "1");

    const output = renderToString(
      <Hyperlink url="https://example.com" bold>
        Docs
      </Hyperlink>,
    );
    const plain = renderToString(<Text bold>Docs</Text>);

    expect(output).toBe(`${OSC8_OPEN}${plain}${OSC8_CLOSE}`);
  });
});

describe("createSupportsHyperlinks", () => {
  const tty = { isTTY: true };

  const stubClean = () => {
    for (const key of [
      "FORCE_HYPERLINK",
      "CI",
      "TEAMCITY_VERSION",
      "WT_SESSION",
      "TERM",
      "TERM_PROGRAM",
      "TERM_PROGRAM_VERSION",
      "VTE_VERSION",
    ]) {
      vi.stubEnv(key, undefined);
    }

    // Keep color support on so the color gate doesn't short-circuit.
    vi.stubEnv("FORCE_COLOR", "true");
  };

  test("respects FORCE_HYPERLINK overrides", () => {
    stubClean();
    vi.stubEnv("FORCE_HYPERLINK", "1");
    expect(createSupportsHyperlinks(tty)).toBe(true);

    vi.stubEnv("FORCE_HYPERLINK", "0");
    expect(createSupportsHyperlinks(tty)).toBe(false);
  });

  test("rejects non-TTY streams and CI", () => {
    stubClean();
    vi.stubEnv("TERM", "xterm-kitty");
    expect(createSupportsHyperlinks({ isTTY: false })).toBe(false);

    vi.stubEnv("CI", "1");
    expect(createSupportsHyperlinks(tty)).toBe(false);
  });

  test("detects capable terminals", () => {
    stubClean();
    vi.stubEnv("TERM", "xterm-kitty");
    expect(createSupportsHyperlinks(tty)).toBe(true);

    stubClean();
    vi.stubEnv("WT_SESSION", "some-guid");
    expect(createSupportsHyperlinks(tty)).toBe(true);

    stubClean();
    vi.stubEnv("TERM_PROGRAM", "iTerm.app");
    vi.stubEnv("TERM_PROGRAM_VERSION", "3.4.0");
    expect(createSupportsHyperlinks(tty)).toBe(true);

    stubClean();
    vi.stubEnv("TERM_PROGRAM", "iTerm.app");
    vi.stubEnv("TERM_PROGRAM_VERSION", "3.0.0");
    expect(createSupportsHyperlinks(tty)).toBe(false);

    stubClean();
    vi.stubEnv("TERM_PROGRAM", "vscode");
    vi.stubEnv("TERM_PROGRAM_VERSION", "1.80.0");
    expect(createSupportsHyperlinks(tty)).toBe(true);

    stubClean();
    vi.stubEnv("VTE_VERSION", "6003");
    expect(createSupportsHyperlinks(tty)).toBe(true);

    stubClean();
    vi.stubEnv("VTE_VERSION", "0.50.0");
    expect(createSupportsHyperlinks(tty)).toBe(false);
  });

  test("defaults to false for unknown terminals", () => {
    stubClean();
    vi.stubEnv("TERM", "xterm-256color");
    expect(createSupportsHyperlinks(tty)).toBe(false);
  });
});
