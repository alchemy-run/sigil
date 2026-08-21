import { expect, test } from "vite-plus/test";

import term from "./helpers/term.ts";

test("useInput - discrete priority keeps states in sync with useTransition during rapid input", async () => {
  const ps = term("use-input-discrete-priority");
  // Simulate rapid delete key repeat at ~30ms intervals.
  // State starts pre-populated with "abcde". Send 5 rapid deletes
  // to clear it, then wait for transitions to settle and check state.
  const delay = async (ms: number) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  const pressDeleteKey = () => {
    ps.write("\u001B[3~");
  };

  // Use escape sequence for delete key (raw \x7F gets processed by pty)
  for (const delayMilliseconds of [0, 30, 60, 90, 120]) {
    setTimeout(() => {
      pressDeleteKey();
    }, delayMilliseconds);
  }

  await delay(200);

  // Wait for all transitions to settle, then press Enter to report state
  await delay(2000);
  ps.write("\r");
  await ps.waitForExit();
  const finalMatch = /FINAL .+/.exec(ps.output);
  console.log("Output:", finalMatch?.[0] ?? ps.output.slice(-300));
  expect(ps.output.includes('FINAL query:"" deferred:""')).toBe(true);
});

test("useInput - handle lowercase character", async () => {
  const ps = term("use-input", ["lowercase"]);
  ps.write("q");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - handle uppercase character", async () => {
  const ps = term("use-input", ["uppercase"]);
  ps.write("Q");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - \\r should not count as an uppercase character", async () => {
  const ps = term("use-input", ["uppercase"]);
  ps.write("\r");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - pasted carriage return", async () => {
  const ps = term("use-input", ["pastedCarriageReturn"]);
  ps.write("\rtest");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - pasted tab", async () => {
  const ps = term("use-input", ["pastedTab"]);
  ps.write("\ttest");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - receives bracketed paste when no usePaste handler is active", async () => {
  const ps = term("use-input", ["bracketedPaste"]);
  ps.write("\u001B[200~hello\u001B[201~");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - handle escape", async () => {
  const ps = term("use-input", ["escape"]);
  ps.write("\u001B");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - escape does not set meta", async () => {
  const ps = term("use-input", ["escapeNoMeta"]);
  ps.write("\u001B");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - handle ctrl", async () => {
  const ps = term("use-input", ["ctrl"]);
  ps.write("\u0006");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - handle meta", async () => {
  const ps = term("use-input", ["meta"]);
  ps.write("\u001Bm");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - handle meta + backspace (0x7F)", async () => {
  const ps = term("use-input", ["metaBackspace"]);
  ps.write("\u001B\u007F");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - flushes ESC[ prefix as literal input", async () => {
  const ps = term("use-input", ["escapeBracketPrefix"]);
  ps.write("\u001B[");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - handle meta + O with pending flush", async () => {
  const ps = term("use-input", ["metaUpperO"]);
  ps.write("\u001BO");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - handle tab", async () => {
  const ps = term("use-input", ["tab"]);
  ps.write("\t");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - handle shift + tab", async () => {
  const ps = term("use-input", ["shiftTab"]);
  ps.write("\u001B[Z");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - handle backspace", async () => {
  const ps = term("use-input", ["backspace"]);
  ps.write("\u0008");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - handle delete", async () => {
  const ps = term("use-input", ["delete"]);
  ps.write("\u001B[3~");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - handle remove (delete)", async () => {
  const ps = term("use-input", ["remove"]);
  ps.write("\u001B[3~");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - handle option + return (macOS)", async () => {
  const ps = term("use-input", ["returnMeta"]);
  ps.write("\u001B\r");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - handle Ctrl+F1 without crashing", async () => {
  const ps = term("use-input", ["ctrlF1"]);
  ps.write("\u001B[1;5P");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});

test("useInput - handle unmapped ctrl escape sequence without crashing", async () => {
  const ps = term("use-input", ["unmappedCtrlSequence"]);
  // ESC [ 1 ; 5 I — focus-in with ctrl modifier, not in keyName map
  ps.write("\u001B[1;5I");
  await ps.waitForExit();
  expect(ps.output.includes("exited")).toBe(true);
});
