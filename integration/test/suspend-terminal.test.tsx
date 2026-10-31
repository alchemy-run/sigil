import { stripAnsi } from "@alchemy.run/sigil/ansi";
import { expect, test } from "vite-plus/test";

import term from "./helpers/term.ts";

const showCursor = "\u001B[?25h";
const hideCursor = "\u001B[?25l";

test("suspendTerminal hands the terminal to a child process, then redraws (PTY)", async () => {
  const ps = term("suspend-terminal");
  await ps.waitForExit();

  const { output } = ps;

  // The child process wrote directly to the terminal during suspension.
  expect(output).toContain("CHILD_OUTPUT");
  // Ink showed the cursor when handing the terminal over.
  expect(output).toContain(showCursor);
  // Ink reclaimed the terminal and repainted its frame after the child output,
  // re-hiding the cursor as part of the redraw.
  const afterChild = output.slice(output.lastIndexOf("CHILD_OUTPUT") + "CHILD_OUTPUT".length);
  expect(stripAnsi(afterChild)).toContain("Ink frame");
  expect(afterChild).toContain(hideCursor);
});
