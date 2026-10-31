import { expect, test } from "vite-plus/test";

import { ansiEscapes } from "#/ansi/escapes.ts";

import { reconstructTerminalLines } from "./helpers/reconstruct-terminal.ts";
import term from "./helpers/term.ts";

test("#973: static item taller than viewport keeps its last line", async () => {
  const rows = 6;
  const ps = term("issue-973-static-commit", [String(rows)], { rows, stripSyncSequences: true });
  await ps.waitForExit();

  const visibleLines = reconstructTerminalLines(ps.output, rows).filter((line) => line.length > 0);

  expect(
    visibleLines,
    `Last static line must stay visible, got ${JSON.stringify(visibleLines)}`,
  ).toContain("line 6");
  expect(visibleLines, `Live region must render, got ${JSON.stringify(visibleLines)}`).toContain(
    "INPUT BOX",
  );
  expect(ps.output).not.toContain(ansiEscapes.clearTerminal);
});
