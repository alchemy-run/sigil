import { expect, test } from "vite-plus/test";

import { tokenize } from "#/ansi/tokenize.ts";
import { cellsFromAnsi, createCell, serializeLine, type Cell } from "#/screen/index.ts";

test("round-trips generated truecolor cell runs through the canonical ANSI grammar", () => {
  let state = 0x5eeda11;
  const random = () => (state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0) / 2 ** 32;
  for (let example = 0; example < 250; example++) {
    const cells: Cell[] = Array.from({ length: 1 + Math.floor(random() * 20) }, () => {
      const styled = random() > 0.3;
      return createCell(String.fromCodePoint(33 + Math.floor(random() * 90)), 1, {
        ...(styled
          ? {
              foreground: {
                model: "rgb" as const,
                red: Math.floor(random() * 256),
                green: Math.floor(random() * 256),
                blue: Math.floor(random() * 256),
                alpha: 255,
              },
            }
          : {}),
        underline: random() > 0.8 ? "single" : "none",
        attributes: random() > 0.8 ? 1 : 0,
      });
    });
    const encoded = serializeLine(cells, { colorProfile: "truecolor", trimEnd: false });
    expect(cellsFromAnsi(encoded)).toEqual(cells);
  }
});

test("the ANSI tokenizer never throws for malformed byte-like input", () => {
  let state = 17;
  for (let example = 0; example < 1000; example++) {
    let input = "";
    const length = state % 80;
    for (let index = 0; index < length; index++) {
      state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0;
      input += String.fromCharCode(state & 0xff);
    }
    expect(() => tokenize(input)).not.toThrow();
  }
});
