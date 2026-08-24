import type { ComponentProps } from "react";
import { expect, test } from "vite-plus/test";

import { renderToString, Text } from "#/index.ts";
import { cellsFromAnsi } from "#/screen/index.ts";

// Semantic counterparts of fixtures in Charm's lipgloss/style_test.go. Charm
// closes runs with SGR 0 while Sigil emits channel-specific resets, so compare
// parsed cells rather than coupling either implementation to the other's bytes.
const cases: Array<{
  readonly name: string;
  readonly lipgloss: string;
  readonly props: ComponentProps<typeof Text>;
}> = [
  {
    name: "truecolor foreground",
    lipgloss: "\u001B[38;2;90;86;224mhello\u001B[m",
    props: { color: "#5A56E0" },
  },
  { name: "bold", lipgloss: "\u001B[1mhello\u001B[m", props: { bold: true } },
  { name: "italic", lipgloss: "\u001B[3mhello\u001B[m", props: { italic: true } },
  { name: "underline", lipgloss: "\u001B[4;4mhello\u001B[m", props: { underline: true } },
  { name: "faint", lipgloss: "\u001B[2mhello\u001B[m", props: { dimColor: true } },
];

for (const fixture of cases) {
  test(`matches Lip Gloss ${fixture.name} cell semantics`, () => {
    const sigil = renderToString(<Text {...fixture.props}>hello</Text>, {
      columns: 20,
      colorProfile: "truecolor",
    });
    expect(cellsFromAnsi(sigil)).toEqual(cellsFromAnsi(fixture.lipgloss));
  });
}
