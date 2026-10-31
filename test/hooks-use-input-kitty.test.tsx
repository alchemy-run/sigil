import { expect, test } from "vite-plus/test";

import term from "./helpers/term.ts";

for (const [name, fixture, sequence] of [
  ["handle kitty special key modifiers without event type", "specialModifiers", "\u001B[1;9A"],
  ["handle kitty keypad navigation", "keypadNavigation", "\u001B[57420;5:2u"],
  ["handle kitty alternate key codes", "alternateKeys", "\u001B[97:65:113;6:2;65u"],
  ["handle kitty keypad associated text", "keypadText", "\u001B[57399;129;48u"],
  ["handle kitty keypad Enter", "keypadEnter", "\u001B[57414u"],
  ["kitty associated text with omitted modifiers", "associatedText", "\u001B[0;;229u"],
  // Caps Lock without Shift, with uppercase A as associated text.
  ["kitty capsLock text does not imply shift", "capsLockText", "\u001B[97;65;65u"],
] as const) {
  test(`useInput - ${name}`, async () => {
    const ps = term("use-input-kitty", [fixture]);
    ps.write(sequence);
    await ps.waitForExit();
    expect(ps.output).toContain("exited");
  });
}

test("useInput - handle kitty protocol super modifier", async () => {
  const ps = term("use-input-kitty", ["super"]);
  // 's' with super modifier (modifier 9 = super(8) + 1)
  ps.write("\u001B[115;9u");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle kitty protocol hyper modifier", async () => {
  const ps = term("use-input-kitty", ["hyper"]);
  // 'h' with hyper modifier (modifier 17 = hyper(16) + 1)
  ps.write("\u001B[104;17u");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle kitty protocol capsLock", async () => {
  const ps = term("use-input-kitty", ["capsLock"]);
  // 'a' with capsLock (modifier 65 = capsLock(64) + 1)
  ps.write("\u001B[97;65u");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle kitty protocol numLock", async () => {
  const ps = term("use-input-kitty", ["numLock"]);
  // 'a' with numLock (modifier 129 = numLock(128) + 1)
  ps.write("\u001B[97;129u");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle kitty protocol super+ctrl", async () => {
  const ps = term("use-input-kitty", ["superCtrl"]);
  // 's' with super+ctrl (modifier 13 = super(8) + ctrl(4) + 1)
  ps.write("\u001B[115;13u");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle kitty protocol press event", async () => {
  const ps = term("use-input-kitty", ["press"]);
  // 'a' press event (eventType 1 = press)
  ps.write("\u001B[97;1:1u");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle kitty protocol repeat event", async () => {
  const ps = term("use-input-kitty", ["repeat"]);
  // 'a' repeat event (eventType 2 = repeat)
  ps.write("\u001B[97;1:2u");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle kitty protocol release event", async () => {
  const ps = term("use-input-kitty", ["release"]);
  // 'a' release event (eventType 3 = release)
  ps.write("\u001B[97;1:3u");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle kitty protocol escape key", async () => {
  const ps = term("use-input-kitty", ["escapeKitty"]);
  // Escape key
  ps.write("\u001B[27u");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle kitty protocol backspace (codepoint 127)", async () => {
  const ps = term("use-input-kitty", ["backspace"]);
  ps.write("\u001B[127u");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - handle kitty protocol delete", async () => {
  const ps = term("use-input-kitty", ["delete"]);
  ps.write("\u001B[3;1:1~");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - non-printable kitty key (capslock) produces empty input", async () => {
  const ps = term("use-input-kitty", ["nonPrintable"]);
  // Capslock (codepoint 57358)
  ps.write("\u001B[57358u");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - non-printable kitty key (f13) produces empty input", async () => {
  const ps = term("use-input-kitty", ["nonPrintable"]);
  // F13 (codepoint 57376)
  ps.write("\u001B[57376u");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - non-printable kitty key (printscreen) produces empty input", async () => {
  const ps = term("use-input-kitty", ["nonPrintable"]);
  // PrintScreen (codepoint 57361)
  ps.write("\u001B[57361u");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - kitty protocol space key produces space input", async () => {
  const ps = term("use-input-kitty", ["space"]);
  // Space key (codepoint 32)
  ps.write("\u001B[32u");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - kitty protocol return key produces carriage return input", async () => {
  const ps = term("use-input-kitty", ["returnKey"]);
  // Return key (codepoint 13)
  ps.write("\u001B[13u");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});

test("useInput - kitty protocol Ctrl+letter produces input", async () => {
  const ps = term("use-input-kitty", ["ctrlLetter"]);
  // Ctrl+a uses the unshifted key code (modifier 5 = ctrl(4) + 1).
  ps.write("\u001B[97;5u");
  await ps.waitForExit();
  expect(ps.output).toContain("exited");
});
