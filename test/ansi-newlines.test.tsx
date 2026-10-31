import { expect, test } from "vite-plus/test";

import { AnsiText } from "#/index.ts";

import { renderToString } from "./helpers/render-to-string.ts";

for (const [name, open, close] of [
  ["foreground", "\u001B[31m", "\u001B[39m"],
  ["background", "\u001B[44m", "\u001B[49m"],
  ["bold", "\u001B[1m", "\u001B[22m"],
] as const) {
  test(`raw ANSI ${name} continues across explicit newlines`, () => {
    const actual = renderToString(<AnsiText>{`${open}A\nB${close}`}</AnsiText>);
    const expected = renderToString(<AnsiText>{`${open}A${close}\n${open}B${close}`}</AnsiText>);
    expect(actual).toBe(expected);
  });

  test(`raw ANSI ${name} stops at a reset on a later line`, () => {
    const actual = renderToString(<AnsiText>{`${open}A\nB${close}\nC`}</AnsiText>);
    const expected = renderToString(<AnsiText>{`${open}A${close}\n${open}B${close}\nC`}</AnsiText>);
    expect(actual).toBe(expected);
  });
}
