import { expect, test } from "vite-plus/test";

import term from "./helpers/term.ts";

test("useInput - handle up arrow", async () => {
  const ps = term("use-input", ["upArrow"]);
  ps.write("\u001B[A");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle down arrow", async () => {
  const ps = term("use-input", ["downArrow"]);
  ps.write("\u001B[B");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle left arrow", async () => {
  const ps = term("use-input", ["leftArrow"]);
  ps.write("\u001B[D");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle right arrow", async () => {
  const ps = term("use-input", ["rightArrow"]);
  ps.write("\u001B[C");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handles rapid arrows and enter in one chunk", async () => {
  const ps = term("use-input", ["rapidArrowsEnter"]);
  ps.write("\u001B[B\u001B[B\u001B[B\r");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle meta + up arrow", async () => {
  const ps = term("use-input", ["upArrowMeta"]);
  ps.write("\u001B\u001B[A");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle meta + down arrow", async () => {
  const ps = term("use-input", ["downArrowMeta"]);
  ps.write("\u001B\u001B[B");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle meta + left arrow", async () => {
  const ps = term("use-input", ["leftArrowMeta"]);
  ps.write("\u001B\u001B[D");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle meta + right arrow", async () => {
  const ps = term("use-input", ["rightArrowMeta"]);
  ps.write("\u001B\u001B[C");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle ctrl + up arrow", async () => {
  const ps = term("use-input", ["upArrowCtrl"]);
  ps.write("\u001B[1;5A");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle ctrl + down arrow", async () => {
  const ps = term("use-input", ["downArrowCtrl"]);
  ps.write("\u001B[1;5B");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle ctrl + left arrow", async () => {
  const ps = term("use-input", ["leftArrowCtrl"]);
  ps.write("\u001B[1;5D");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle ctrl + right arrow", async () => {
  const ps = term("use-input", ["rightArrowCtrl"]);
  ps.write("\u001B[1;5C");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle page down", async () => {
  const ps = term("use-input", ["pageDown"]);
  ps.write("\u001B[6~");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle page up", async () => {
  const ps = term("use-input", ["pageUp"]);
  ps.write("\u001B[5~");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle home", async () => {
  const ps = term("use-input", ["home"]);
  ps.write("\u001B[H");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle end", async () => {
  const ps = term("use-input", ["end"]);
  ps.write("\u001B[F");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});
