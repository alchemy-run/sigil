import { test, expect } from "vite-plus/test";

import { tokenizeAnsi } from "#/ansi-tokenizer.ts";

test("tokenize plain text", () => {
  expect(tokenizeAnsi("hello")).toEqual([{ type: "text", value: "hello" }]);
});

test("tokenize ESC CSI SGR sequence", () => {
  const tokens = tokenizeAnsi("A\u001B[31mB");

  expect(tokens.map((token) => token.type)).toEqual(["text", "csi", "text"]);
  expect(tokens[0]).toEqual({ type: "text", value: "A" });
  expect(tokens[2]).toEqual({ type: "text", value: "B" });

  const csiToken = tokens[1];
  if (csiToken?.type !== "csi") {
    expect.fail("Expected a CSI token");
  }

  expect(csiToken.value).toBe("\u001B[31m");
  expect(csiToken.parameterString).toBe("31");
  expect(csiToken.intermediateString).toBe("");
  expect(csiToken.finalCharacter).toBe("m");
});

test("tokenize C1 CSI sequence", () => {
  const tokens = tokenizeAnsi("A\u009B2 qB");
  const csiToken = tokens[1];

  if (csiToken?.type !== "csi") {
    expect.fail("Expected a CSI token");
  }

  expect(csiToken.value).toBe("\u009B2 q");
  expect(csiToken.parameterString).toBe("2");
  expect(csiToken.intermediateString).toBe(" ");
  expect(csiToken.finalCharacter).toBe("q");
});

test("tokenize OSC control string with ST terminator", () => {
  const tokens = tokenizeAnsi("A\u001B]8;;https://example.com\u001B\\B");
  const oscToken = tokens[1];

  expect(tokens.map((token) => token.type)).toEqual(["text", "osc", "text"]);
  if (oscToken?.type !== "osc") {
    expect.fail("Expected an OSC token");
  }

  expect(oscToken.value).toBe("\u001B]8;;https://example.com\u001B\\");
});

test("tokenize tmux DCS passthrough as one control string token", () => {
  const tokens = tokenizeAnsi(
    "A\u001BPtmux;\u001B\u001B]8;;https://example.com\u001B\u001B\\\u001B\\B",
  );
  const dcsToken = tokens[1];

  expect(tokens.map((token) => token.type)).toEqual(["text", "dcs", "text"]);
  if (dcsToken?.type !== "dcs") {
    expect.fail("Expected a DCS token");
  }

  expect(dcsToken.value).toBe(
    "\u001BPtmux;\u001B\u001B]8;;https://example.com\u001B\u001B\\\u001B\\",
  );
});

test("tokenize incomplete CSI as invalid and stop", () => {
  const tokens = tokenizeAnsi("A\u001B[");

  expect(tokens).toEqual([
    { type: "text", value: "A" },
    { type: "invalid", value: "\u001B[" },
  ]);
});

test("tokenize incomplete ESC intermediate sequence as invalid and stop", () => {
  const tokens = tokenizeAnsi("A\u001B#");

  expect(tokens).toEqual([
    { type: "text", value: "A" },
    { type: "invalid", value: "\u001B#" },
  ]);
});

test("ignore lone ESC before non-final byte", () => {
  const tokens = tokenizeAnsi("A\u001B\u0007B");

  expect(tokens).toEqual([
    { type: "text", value: "A" },
    { type: "text", value: "\u0007B" },
  ]);
});

test("tokenize ESC ST sequence as ESC token", () => {
  const tokens = tokenizeAnsi("A\u001B\\B");
  const escToken = tokens[1];

  expect(tokens.map((token) => token.type)).toEqual(["text", "esc", "text"]);
  if (escToken?.type !== "esc") {
    expect.fail("Expected an ESC token");
  }

  expect(escToken.value).toBe("\u001B\\");
  expect(escToken.intermediateString).toBe("");
  expect(escToken.finalCharacter).toBe("\\");
});

test("tokenize C1 OSC with C1 ST terminator", () => {
  const tokens = tokenizeAnsi("A\u009D8;;https://example.com\u009CB");
  const oscToken = tokens[1];

  expect(tokens.map((token) => token.type)).toEqual(["text", "osc", "text"]);
  if (oscToken?.type !== "osc") {
    expect.fail("Expected an OSC token");
  }

  expect(oscToken.value).toBe("\u009D8;;https://example.com\u009C");
});

test("tokenize C1 OSC with ESC ST terminator", () => {
  const tokens = tokenizeAnsi("A\u009D8;;https://example.com\u001B\\B");
  const oscToken = tokens[1];

  expect(tokens.map((token) => token.type)).toEqual(["text", "osc", "text"]);
  if (oscToken?.type !== "osc") {
    expect.fail("Expected an OSC token");
  }

  expect(oscToken.value).toBe("\u009D8;;https://example.com\u001B\\");
});

test("tokenize C1 SGR CSI sequence", () => {
  const tokens = tokenizeAnsi("A\u009B31mB");
  const csiToken = tokens[1];

  expect(tokens.map((token) => token.type)).toEqual(["text", "csi", "text"]);
  if (csiToken?.type !== "csi") {
    expect.fail("Expected a CSI token");
  }

  expect(csiToken.value).toBe("\u009B31m");
  expect(csiToken.parameterString).toBe("31");
  expect(csiToken.intermediateString).toBe("");
  expect(csiToken.finalCharacter).toBe("m");
});

test("tokenize incomplete C1 CSI as invalid and stop", () => {
  const tokens = tokenizeAnsi("A\u009B31");

  expect(tokens).toEqual([
    { type: "text", value: "A" },
    { type: "invalid", value: "\u009B31" },
  ]);
});

test("tokenize incomplete C1 OSC as invalid and stop", () => {
  const tokens = tokenizeAnsi("A\u009D8;;https://example.com");

  expect(tokens).toEqual([
    { type: "text", value: "A" },
    { type: "invalid", value: "\u009D8;;https://example.com" },
  ]);
});

test("tokenize DCS with BEL in payload until ST terminator", () => {
  const tokens = tokenizeAnsi("A\u001BPpayload\u0007still-payload\u001B\\B");
  const dcsToken = tokens[1];

  expect(tokens.map((token) => token.type)).toEqual(["text", "dcs", "text"]);
  if (dcsToken?.type !== "dcs") {
    expect.fail("Expected a DCS token");
  }

  expect(dcsToken.value).toContain("\u0007");
  expect(dcsToken.value.endsWith("\u001B\\")).toBe(true);
});

test("tokenize C1 OSC control string with BEL terminator", () => {
  const tokens = tokenizeAnsi("A\u009D8;;https://example.com\u0007B");
  const oscToken = tokens[1];

  expect(tokens.map((token) => token.type)).toEqual(["text", "osc", "text"]);
  if (oscToken?.type !== "osc") {
    expect.fail("Expected an OSC token");
  }

  expect(oscToken.value).toBe("\u009D8;;https://example.com\u0007");
});

test("tokenize ESC SOS control string with ST terminator", () => {
  const tokens = tokenizeAnsi("A\u001BXpayload\u001B\\B");
  const sosToken = tokens[1];

  expect(tokens.map((token) => token.type)).toEqual(["text", "sos", "text"]);
  if (sosToken?.type !== "sos") {
    expect.fail("Expected an SOS token");
  }

  expect(sosToken.value).toBe("\u001BXpayload\u001B\\");
});

test("tokenize ESC SOS control string with C1 ST terminator", () => {
  const tokens = tokenizeAnsi("A\u001BXpayload\u009CB");
  const sosToken = tokens[1];

  expect(tokens.map((token) => token.type)).toEqual(["text", "sos", "text"]);
  if (sosToken?.type !== "sos") {
    expect.fail("Expected an SOS token");
  }

  expect(sosToken.value).toBe("\u001BXpayload\u009C");
});

test("tokenize C1 SOS control string with C1 ST terminator", () => {
  const tokens = tokenizeAnsi("A\u0098payload\u009CB");
  const sosToken = tokens[1];

  expect(tokens.map((token) => token.type)).toEqual(["text", "sos", "text"]);
  if (sosToken?.type !== "sos") {
    expect.fail("Expected an SOS token");
  }

  expect(sosToken.value).toBe("\u0098payload\u009C");
});

test("tokenize C1 SOS control string with ESC ST terminator", () => {
  const tokens = tokenizeAnsi("A\u0098payload\u001B\\B");
  const sosToken = tokens[1];

  expect(tokens.map((token) => token.type)).toEqual(["text", "sos", "text"]);
  if (sosToken?.type !== "sos") {
    expect.fail("Expected an SOS token");
  }

  expect(sosToken.value).toBe("\u0098payload\u001B\\");
});

test("tokenize ESC SOS with BEL terminator as invalid and stop", () => {
  const tokens = tokenizeAnsi("A\u001BXpayload\u0007B");

  expect(tokens).toEqual([
    { type: "text", value: "A" },
    { type: "invalid", value: "\u001BXpayload\u0007B" },
  ]);
});

test("tokenize C1 SOS with BEL terminator as invalid and stop", () => {
  const tokens = tokenizeAnsi("A\u0098payload\u0007B");

  expect(tokens).toEqual([
    { type: "text", value: "A" },
    { type: "invalid", value: "\u0098payload\u0007B" },
  ]);
});

test("tokenize incomplete C1 SOS as invalid and stop", () => {
  const tokens = tokenizeAnsi("A\u0098payload");

  expect(tokens).toEqual([
    { type: "text", value: "A" },
    { type: "invalid", value: "\u0098payload" },
  ]);
});

test("tokenize incomplete ESC SOS as invalid and stop", () => {
  const tokens = tokenizeAnsi("A\u001BXpayload");

  expect(tokens).toEqual([
    { type: "text", value: "A" },
    { type: "invalid", value: "\u001BXpayload" },
  ]);
});

test("tokenize SOS with escaped ESC in payload until final ST terminator", () => {
  const tokens = tokenizeAnsi("A\u001BXfoo\u001B\u001B\\bar\u001B\\B");
  const sosToken = tokens[1];

  expect(tokens.map((token) => token.type)).toEqual(["text", "sos", "text"]);
  if (sosToken?.type !== "sos") {
    expect.fail("Expected an SOS token");
  }

  expect(sosToken.value).toContain("\u001B\u001B\\");
  expect(sosToken.value.endsWith("\u001B\\")).toBe(true);
});

test("tokenize standalone C1 controls as c1 tokens", () => {
  const tokens = tokenizeAnsi("A\u0085B\u008EC");
  const c1Token1 = tokens[1];
  const c1Token2 = tokens[3];

  expect(tokens.map((token) => token.type)).toEqual(["text", "c1", "text", "c1", "text"]);
  if (c1Token1?.type !== "c1") {
    expect.fail("Expected a C1 token");
  }

  if (c1Token2?.type !== "c1") {
    expect.fail("Expected a C1 token");
  }

  expect(c1Token1.value).toBe("\u0085");
  expect(c1Token2.value).toBe("\u008E");
});
