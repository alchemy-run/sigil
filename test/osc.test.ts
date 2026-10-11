import { expect, test } from "vite-plus/test";

import { OSC, ST } from "#/ansi/escapes.ts";
import {
  clearClipboard,
  clearProgramStatus,
  notify,
  queryClipboard,
  queryProgramStatus,
  setClipboard,
  setPointerShape,
  setProgramStatus,
  setTerminalProgress,
  setWindowTitle,
  setWorkingDirectory,
  tmuxPassthrough,
} from "#/ansi/osc.ts";

test("builds OSC 52 clipboard operations", () => {
  expect(setClipboard("hello 👋")).toBe(`${OSC}52;c;aGVsbG8g8J+Riw==${ST}`);
  expect(queryClipboard("primary")).toBe(`${OSC}52;p;?${ST}`);
  expect(clearClipboard("selection")).toBe(`${OSC}52;s;${ST}`);
});

test("builds terminal progress states and clamps percentages", () => {
  expect(setTerminalProgress("normal", 42.4)).toBe(`${OSC}9;4;1;42${ST}`);
  expect(setTerminalProgress("normal", 200)).toBe(`${OSC}9;4;1;100${ST}`);
  expect(setTerminalProgress("error")).toBe(`${OSC}9;4;2${ST}`);
  expect(setTerminalProgress("indeterminate")).toBe(`${OSC}9;4;3${ST}`);
  expect(setTerminalProgress("inactive")).toBe(`${OSC}9;4;0${ST}`);
});

test("builds common safe OSC integrations", () => {
  expect(setWindowTitle("build\u001B]2;injected")).toBe(`${OSC}2;build]2;injected${ST}`);
  expect(notify("9;collision")).toBe(`${OSC}9; 9;collision${ST}`);
  expect(setPointerShape("pointer")).toBe(`${OSC}22;pointer${ST}`);
  expect(setWorkingDirectory("/tmp/a b")).toBe(`${OSC}7;file:///tmp/a%20b${ST}`);
});

test("builds OSC 7501 program status reports", () => {
  expect(setProgramStatus({ state: "idle" })).toBe(`${OSC}7501;state=idle${ST}`);
  expect(
    setProgramStatus({
      state: "blocked",
      kind: "permission",
      app: "terraform",
      msg: "Apply 3 to add, 1 to change, 0 to destroy?",
    }),
  ).toBe(
    `${OSC}7501;state=blocked:kind=permission:app=terraform:msg=QXBwbHkgMyB0byBhZGQsIDEgdG8gY2hhbmdlLCAwIHRvIGRlc3Ryb3k/${ST}`,
  );
  expect(
    setProgramStatus({ state: "working", id: "deploy/us-east", progress: 41.6, title: "us" }),
  ).toBe(`${OSC}7501;state=working:id=deploy/us-east:progress=42:title=dXM=${ST}`);
  expect(clearProgramStatus("deploy")).toBe(`${OSC}7501;state=clear:id=deploy${ST}`);
  expect(clearProgramStatus()).toBe(`${OSC}7501;state=clear${ST}`);
  expect(queryProgramStatus()).toBe(`${OSC}7501;?${ST}`);
});

test("drops OSC 7501 keys that do not apply to the state", () => {
  expect(setProgramStatus({ state: "done", kind: "auth", progress: 100 })).toBe(
    `${OSC}7501;state=done${ST}`,
  );
  expect(setProgramStatus({ state: "working", progress: 250 })).toBe(
    `${OSC}7501;state=working:progress=100${ST}`,
  );
  expect(setProgramStatus({ state: "working", progress: Number.NaN })).toBe(
    `${OSC}7501;state=working${ST}`,
  );
});

test("sanitizes and bounds OSC 7501 text", () => {
  const decode = (sequence: string, key: string) =>
    Buffer.from(new RegExp(`${key}=([^:\u001B]*)`).exec(sequence)![1], "base64").toString();
  expect(
    decode(setProgramStatus({ state: "error", msg: "\n bad\u001B]0;x\r\nline\t" }), "msg"),
  ).toBe("bad ]0;x line");
  const long = decode(setProgramStatus({ state: "idle", msg: "é".repeat(2000) }), "msg");
  expect(Buffer.byteLength(long)).toBe(2048);
  expect(long).toBe("é".repeat(1024));
  expect(
    Buffer.byteLength(decode(setProgramStatus({ state: "idle", title: "x".repeat(500) }), "title")),
  ).toBe(192);
});

test("rejects malformed OSC 7501 ids and omits invalid app names", () => {
  for (const id of ["", "a//b", "has space", "a:b", "x".repeat(33), "a/b/c/d/e/f/g/h/i"])
    expect(() => setProgramStatus({ state: "idle", id })).toThrow(/id/);
  expect(setProgramStatus({ state: "idle", app: "claude code" })).toBe(
    `${OSC}7501;state=idle${ST}`,
  );
  expect(() => clearProgramStatus("bad/")).toThrow(/id/);
});

test("wraps OSC sequences for tmux passthrough", () => {
  expect(tmuxPassthrough(`${OSC}52;c;YQ==${ST}`)).toBe(
    "\u001BPtmux;\u001B\u001B]52;c;YQ==\u001B\u001B\\\u001B\\",
  );
});
