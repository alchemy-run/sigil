import { expect, test } from "vite-plus/test";

import term from "./helpers/term.ts";

test("usePaste - receives bracketed paste as single text blob", async () => {
  const ps = term("use-paste", ["basic"]);
  ps.write("\u001B[200~hello world\u001B[201~");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
  expect(ps.output, "bracketed paste mode was enabled").toContain("\u001B[?2004h");
  expect(ps.output.includes("\u001B[?2004l"), "bracketed paste mode was disabled on exit").toBe(
    true,
  );
});

test("usePaste - paste content with escape sequences is delivered verbatim", async () => {
  const ps = term("use-paste", ["escapeSequences"]);
  ps.write("\u001B[200~hello\u001B[Aworld\u001B[201~");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("usePaste - useInput does not receive bracketed paste content", async () => {
  const ps = term("use-paste", ["noUseInput"]);
  ps.write("\u001B[200~hello\u001B[201~");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("usePaste - multiple simultaneous hooks both receive the same paste event", async () => {
  const ps = term("use-paste", ["multipleHooks"]);
  ps.write("\u001B[200~hello\u001B[201~");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});
