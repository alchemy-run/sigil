import { expect, test } from "vite-plus/test";

import { createInputParser, type InputEvent } from "#/input-parser.ts";

const parseChunks = (chunks: readonly string[]): InputEvent[] => {
  const parser = createInputParser();
  const events: InputEvent[] = [];

  for (const chunk of chunks) {
    events.push(...parser.push(chunk));
  }

  return events;
};

test("passes through plain text chunks", () => {
  expect(parseChunks(["hello", " ", "world"])).toEqual(["hello", " ", "world"]);
});

test("keeps plain text and control sequences separate", () => {
  expect(parseChunks(["a\u001B[Ab"])).toEqual(["a", "\u001B[A", "b"]);
});

test("parses multiple standard CSI keys in one chunk", () => {
  expect(parseChunks(["\u001B[A\u001B[B\u001B[C\u001B[D"])).toEqual([
    "\u001B[A",
    "\u001B[B",
    "\u001B[C",
    "\u001B[D",
  ]);
});

test("parses CSI sequences with parameters", () => {
  expect(parseChunks(["\u001B[1;5A\u001B[5~\u001B[6~"])).toEqual([
    "\u001B[1;5A",
    "\u001B[5~",
    "\u001B[6~",
  ]);
});

test("parses kitty protocol sequence as one key event", () => {
  expect(parseChunks(["\u001B[97;5u"])).toEqual(["\u001B[97;5u"]);
});

test("parses SS3 sequences as one key event", () => {
  expect(parseChunks(["\u001BOA\u001BOB\u001BOC\u001BOD"])).toEqual([
    "\u001BOA",
    "\u001BOB",
    "\u001BOC",
    "\u001BOD",
  ]);
});

test("does not consume a following escape as SS3 final byte", () => {
  expect(parseChunks(["\u001BO\u001B[A"])).toEqual(["\u001BO", "\u001B[A"]);
});

test("parses meta+CSI sequence with double escape", () => {
  expect(parseChunks(["\u001B\u001B[A"])).toEqual(["\u001B\u001B[A"]);
});

test("parses escaped printable code points", () => {
  expect(parseChunks(["\u001Bx\u001B1"])).toEqual(["\u001Bx", "\u001B1"]);
});

test("parses escaped supplementary code points", () => {
  expect(parseChunks(["\u001B😀"])).toEqual(["\u001B😀"]);
});

test("preserves legacy ESC[[... sequences in a mixed chunk", () => {
  expect(parseChunks(["\u001B[[A\u001B[[5~"])).toEqual(["\u001B[[A", "\u001B[[5~"]);
});

test("preserves legacy ESC[[... sequences across chunks", () => {
  expect(parseChunks(["\u001B[[", "A\u001B[[5~"])).toEqual(["\u001B[[A", "\u001B[[5~"]);
});

test("parses legacy and standard CSI sequences mixed together", () => {
  expect(parseChunks(["\u001B[[A\u001B[B\u001B[[6~\u001B[1;5D"])).toEqual([
    "\u001B[[A",
    "\u001B[B",
    "\u001B[[6~",
    "\u001B[1;5D",
  ]);
});

test("holds incomplete CSI sequence until final byte arrives", () => {
  const parser = createInputParser();

  expect(parser.push("\u001B[")).toEqual([]);
  expect(parser.hasPendingEscape()).toEqual(true);
  expect(parser.push("1;5")).toEqual([]);
  expect(parser.push("A")).toEqual(["\u001B[1;5A"]);
});

test("holds incomplete legacy ESC[[... sequence until final byte arrives", () => {
  const parser = createInputParser();

  expect(parser.push("\u001B[[")).toEqual([]);
  expect(parser.push("5")).toEqual([]);
  expect(parser.push("~")).toEqual(["\u001B[[5~"]);
});

test("holds incomplete SS3 sequence until final byte arrives", () => {
  const parser = createInputParser();

  expect(parser.push("\u001BO")).toEqual([]);
  expect(parser.push("A")).toEqual(["\u001BOA"]);
});

test("holds incomplete double-escape CSI sequence until final byte arrives", () => {
  const parser = createInputParser();

  expect(parser.push("\u001B\u001B[")).toEqual([]);
  expect(parser.push("A")).toEqual(["\u001B\u001B[A"]);
});

test("keeps pending plain escape and can flush it", () => {
  const parser = createInputParser();

  expect(parser.push("\u001B")).toEqual([]);
  expect(parser.hasPendingEscape()).toEqual(true);
  expect(parser.flushPendingEscape()).toEqual("\u001B");
  expect(parser.hasPendingEscape()).toEqual(false);
});

test("flushes pending CSI prefix as literal input", () => {
  const parser = createInputParser();

  expect(parser.push("\u001B[")).toEqual([]);
  expect(parser.hasPendingEscape()).toEqual(true);
  expect(parser.flushPendingEscape()).toEqual("\u001B[");
  expect(parser.hasPendingEscape()).toEqual(false);
  expect(parser.push("A")).toEqual(["A"]);
});

test("reset clears pending input state", () => {
  const parser = createInputParser();

  expect(parser.push("\u001B[")).toEqual([]);
  parser.reset();
  expect(parser.push("A")).toEqual(["A"]);
});

test("treats invalid CSI continuation as escaped code point plus plain text", () => {
  expect(parseChunks(["\u001B[\n"])).toEqual(["\u001B[", "\n"]);
});

test("parses mixed text and many key events in one read", () => {
  expect(parseChunks(["start\u001B[A mid \u001BOH end\u001B[[5~"])).toEqual([
    "start",
    "\u001B[A",
    " mid ",
    "\u001BOH",
    " end",
    "\u001B[[5~",
  ]);
});

test("flushes pending SS3 prefix as literal input", () => {
  const parser = createInputParser();

  expect(parser.push("\u001BO")).toEqual([]);
  expect(parser.hasPendingEscape()).toEqual(true);
  expect(parser.flushPendingEscape()).toEqual("\u001BO");
  expect(parser.push("x")).toEqual(["x"]);
});

test("flushes pending legacy CSI prefix as literal input", () => {
  const parser = createInputParser();

  expect(parser.push("\u001B[[")).toEqual([]);
  expect(parser.hasPendingEscape()).toEqual(true);
  expect(parser.flushPendingEscape()).toEqual("\u001B[[");
  expect(parser.push("x")).toEqual(["x"]);
});

test("parses meta+SS3 sequence with double escape", () => {
  expect(parseChunks(["\u001B\u001BOA"])).toEqual(["\u001B\u001BOA"]);
});

test("holds incomplete double-escape SS3 sequence until final byte arrives", () => {
  const parser = createInputParser();

  expect(parser.push("\u001B\u001BO")).toEqual([]);
  expect(parser.hasPendingEscape()).toEqual(true);
  expect(parser.push("A")).toEqual(["\u001B\u001BOA"]);
});

test("emits double escape as single event for non-control character", () => {
  expect(parseChunks(["\u001B\u001Bx"])).toEqual(["\u001B\u001B", "x"]);
});

test("empty chunk produces no events", () => {
  expect(parseChunks([""])).toEqual([]);
});

test("empty chunk does not disturb pending state", () => {
  const parser = createInputParser();

  expect(parser.push("\u001B[")).toEqual([]);
  expect(parser.push("")).toEqual([]);
  expect(parser.hasPendingEscape()).toEqual(true);
  expect(parser.push("A")).toEqual(["\u001B[A"]);
});

test("plain text followed by incomplete escape holds escape as pending", () => {
  const parser = createInputParser();

  expect(parser.push("hello\u001B")).toEqual(["hello"]);
  expect(parser.hasPendingEscape()).toEqual(true);
  expect(parser.flushPendingEscape()).toEqual("\u001B");
});

const deleteAndBackspaceCases = [
  {
    title: "splits batched 0x7F backspace characters into individual events",
    chunks: ["\u007F\u007F\u007F"],
    events: ["\u007F", "\u007F", "\u007F"],
  },
  {
    title: "splits batched backspace characters into individual events",
    chunks: ["\u0008\u0008\u0008"],
    events: ["\u0008", "\u0008", "\u0008"],
  },
  {
    title: "splits mixed 0x7F and 0x08 backspace characters",
    chunks: ["\u007F\u0008\u007F"],
    events: ["\u007F", "\u0008", "\u007F"],
  },
  {
    title: "splits mixed printable text and 0x7F backspace characters",
    chunks: ["abc\u007F\u007F\u007F"],
    events: ["abc", "\u007F", "\u007F", "\u007F"],
  },
  {
    title: "single 0x7F backspace character is preserved as individual event",
    chunks: ["\u007F"],
    events: ["\u007F"],
  },
  {
    title: "single backspace character is preserved as individual event",
    chunks: ["\u0008"],
    events: ["\u0008"],
  },
  {
    title: "splits trailing 0x7F backspace from text",
    chunks: ["abc\u007F"],
    events: ["abc", "\u007F"],
  },
  {
    title: "splits 0x7F backspace characters before escape sequences",
    chunks: ["\u007F\u007F\u001B[A"],
    events: ["\u007F", "\u007F", "\u001B[A"],
  },
  {
    title: "splits 0x7F backspace characters after escape sequences",
    chunks: ["\u001B[A\u007F\u007F"],
    events: ["\u001B[A", "\u007F", "\u007F"],
  },
  {
    title: "splits 0x7F backspace characters between escape sequences",
    chunks: ["\u001B[A\u007F\u001B[B"],
    events: ["\u001B[A", "\u007F", "\u001B[B"],
  },
  {
    title: "splits backspace characters around escape sequences",
    chunks: ["\u0008\u001B[A\u0008"],
    events: ["\u0008", "\u001B[A", "\u0008"],
  },
  {
    title: "splits interleaved text and 0x7F backspace characters",
    chunks: ["ab\u007Fcd"],
    events: ["ab", "\u007F", "cd"],
  },
  {
    title: "does not split pasted carriage return from text",
    chunks: ["\rtest"],
    events: ["\rtest"],
  },
  {
    title: "does not split pasted tab from text",
    chunks: ["\ttest"],
    events: ["\ttest"],
  },
] as const;

for (const testCase of deleteAndBackspaceCases) {
  test(testCase.title, () => {
    expect(parseChunks(testCase.chunks)).toEqual(testCase.events);
  });
}

test("assembles CSI sequence from single-byte chunks", () => {
  const parser = createInputParser();

  expect(parser.push("\u001B")).toEqual([]);
  expect(parser.push("[")).toEqual([]);
  expect(parser.push("1")).toEqual([]);
  expect(parser.push(";")).toEqual([]);
  expect(parser.push("5")).toEqual([]);
  expect(parser.push("A")).toEqual(["\u001B[1;5A"]);
});

test("emits paste event for bracketed paste sequence", () => {
  expect(parseChunks(["\u001B[200~hello world\u001B[201~"])).toEqual([{ paste: "hello world" }]);
});

test("emits paste event for multiline bracketed paste", () => {
  expect(parseChunks(["\u001B[200~line1\nline2\u001B[201~"])).toEqual([{ paste: "line1\nline2" }]);
});

test("paste content with escape sequences is delivered verbatim", () => {
  expect(parseChunks(["\u001B[200~hello\u001B[Aworld\u001B[201~"])).toEqual([
    { paste: "hello\u001B[Aworld" },
  ]);
});

test("emits normal events before and after bracketed paste", () => {
  expect(parseChunks(["before\u001B[200~pasted\u001B[201~after"])).toEqual([
    "before",
    { paste: "pasted" },
    "after",
  ]);
});

test("emits multiple paste events in one chunk", () => {
  expect(parseChunks(["\u001B[200~first\u001B[201~mid\u001B[200~second\u001B[201~"])).toEqual([
    { paste: "first" },
    "mid",
    { paste: "second" },
  ]);
});

test("holds incomplete bracketed paste as pending", () => {
  const parser = createInputParser();

  expect(parser.push("\u001B[200~hello")).toEqual([]);
  expect(parser.hasPendingEscape()).toEqual(false);
  expect(parser.push(" world\u001B[201~")).toEqual([{ paste: "hello world" }]);
});

test("assembles bracketed paste from chunk-by-chunk delivery", () => {
  const parser = createInputParser();

  expect(parser.push("\u001B[200~")).toEqual([]);
  expect(parser.push("hello")).toEqual([]);
  expect(parser.push("\u001B[201~")).toEqual([{ paste: "hello" }]);
});

test("emits empty paste for adjacent paste markers", () => {
  expect(parseChunks(["\u001B[200~\u001B[201~"])).toEqual([{ paste: "" }]);
});

test("handles pasteStart split before the tilde (\\u001B[200 without ~)", () => {
  const parser = createInputParser();

  // Chunk ends exactly at the 5th byte of the 6-byte pasteStart sequence.
  // Keep waiting for the final `~` to avoid splitting bracketed paste input.
  expect(parser.push("\u001B[200")).toEqual([]);
  expect(parser.hasPendingEscape()).toEqual(false);
  expect(parser.push("~hello\u001B[201~")).toEqual([{ paste: "hello" }]);
});

test("hasPendingEscape returns true for length-3 pasteStart prefix (\\u001B[2)", () => {
  const parser = createInputParser();

  expect(parser.push("\u001B[2")).toEqual([]);
  expect(parser.hasPendingEscape()).toEqual(true);
});

test("hasPendingEscape returns true for length-4 pasteStart prefix (\\u001B[20)", () => {
  const parser = createInputParser();

  expect(parser.push("\u001B[20")).toEqual([]);
  expect(parser.hasPendingEscape()).toEqual(true);
});

test("paste event delivers backspace chars verbatim without splitting", () => {
  expect(parseChunks(["\u001B[200~\u007F\u0008\u007F\u001B[201~"])).toEqual([
    { paste: "\u007F\u0008\u007F" },
  ]);
});
