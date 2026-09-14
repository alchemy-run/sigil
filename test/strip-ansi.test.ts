import { stripVTControlCharacters } from "node:util";

import { expect, test } from "vite-plus/test";

import { stripAnsi } from "#/ansi/strip.ts";

// Why Sigil wraps node's stripVTControlCharacters instead of using it directly.
//
// Node's regex (lib/internal/util/inspect.js) is a vendored copy of an old
// `ansi-regex`, whose CSI branch only accepts semicolon-separated parameters:
// `(?:\d{1,4}(?:;\d{0,4})*)?<finalByte>`. ITU T.416 / ISO 8613-6 also allows
// colon-separated sub-parameters for SGR — the form modern terminals emit for
// truecolor, e.g. `CSI 38:2::R:G:Bm`. Upstream ansi-regex fixed this in
// chalk/ansi-regex#62 (Aug 2025); node's copy predates the fix.
//
// The failure mode is worse than "not stripped": the regex matches a PREFIX of
// the sequence (`ESC[3` + final byte `8`) and strips that, leaking the rest of
// the sequence (`:2::255:100:0m`) into the "visible" text.

const semicolonSgr = "A\u001B[38;2;255;100;0mcolor\u001B[39mB";
const colonSgr = "A\u001B[38:2::255:100:0mcolor\u001B[39mB";

// Node 24.21+ ships the upstream fix (nodejs/node#65379). The wrapper stays
// until the minimum supported Node has it; the leak test only documents the
// old behavior on runtimes that still have it.
const nodeStripsColonSgr = stripVTControlCharacters(colonSgr) === "AcolorB";

test("both strippers agree on semicolon-separated SGR", () => {
  expect(stripVTControlCharacters(semicolonSgr)).toBe("AcolorB");
  expect(stripAnsi(semicolonSgr)).toBe("AcolorB");
});

test.skipIf(nodeStripsColonSgr)(
  "node's stripVTControlCharacters leaks colon-separated SGR parameters",
  () => {
    // `ESC[38` is consumed as a (bogus) complete sequence; the remainder of
    // the real sequence survives as text. This documents pre-fix node
    // behavior so the wrapper's reason for existing stays visible.
    expect(stripVTControlCharacters(colonSgr)).toBe("A:2::255:100:0mcolorB");
  },
);

test("stripAnsi removes colon-separated SGR before delegating to node", () => {
  // Sigil preserves colon SGR in its output (see sanitize-ansi.ts), so its
  // stripper must understand them: colonSgrRegex removes them first, then
  // node's stripVTControlCharacters handles everything else.
  expect(stripAnsi(colonSgr)).toBe("AcolorB");
});

test("stripAnsi also handles the C1 (8-bit CSI) colon form", () => {
  const c1ColonSgr = "A\u009B38:2::255:100:0mcolor\u009B0mB";

  expect(stripAnsi(c1ColonSgr)).toBe("AcolorB");
});
