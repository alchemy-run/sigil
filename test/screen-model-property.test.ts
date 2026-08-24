import { expect, test } from "vite-plus/test";

import { graphemes } from "#/ansi/graphemes.ts";
import { stringWidth } from "#/ansi/string-width.ts";
import { Canvas } from "#/screen/canvas.ts";
import { createCell, Screen } from "#/screen/index.ts";
import { wrapStructuredText } from "#/structured-text.ts";
import { wrapText } from "#/wrap-text.ts";

const randomSource = (seed: number) => {
  let state = seed;
  return (limit: number) => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state % limit;
  };
};

const assertValidWideCells = (screen: Screen) => {
  for (let y = 0; y < screen.height; y++) {
    for (let x = 0; x < screen.width; x++) {
      const cell = screen.cellAt(x, y)!;
      if (cell.width > 0) {
        expect(x + cell.width).toBeLessThanOrEqual(screen.width);
        for (let offset = 1; offset < cell.width; offset++) {
          expect(screen.cellAt(x + offset, y)?.width).toBe(0);
        }
      } else {
        let leader = x - 1;
        while (leader >= 0 && screen.cellAt(leader, y)?.width === 0) leader--;
        expect(leader).toBeGreaterThanOrEqual(0);
        expect(leader + screen.cellAt(leader, y)!.width).toBeGreaterThan(x);
      }
    }
  }
};

test("random resize and composition sequences preserve wide-cell invariants", () => {
  const random = randomSource(0x51_61_1);
  const screen = new Screen(8, 4);
  for (let step = 0; step < 1000; step++) {
    if (random(4) === 0) screen.resize(random(13), random(8));
    else {
      const width = random(3) === 0 ? 2 : 1;
      screen.composeCell(random(17) - 2, random(12) - 2, {
        content: { grapheme: width === 2 ? "界" : String.fromCodePoint(65 + random(26)), width },
        background: {
          model: "rgb",
          red: random(256),
          green: random(256),
          blue: random(256),
          alpha: 255,
        },
      });
    }
    assertValidWideCells(screen);
  }
});

test("random nested clipping never creates partial wide graphemes", () => {
  const random = randomSource(0xc1_1f);
  for (let example = 0; example < 250; example++) {
    const canvas = new Canvas({ width: 12, height: 5 });
    const left = random(8);
    const right = left + random(13 - left);
    canvas.clip({ x1: left, x2: right, y1: random(3), y2: 3 + random(3) });
    canvas.writeCells(random(14) - 2, random(7) - 1, [
      [createCell("界", 2), createCell("x", 1), createCell("🙂", 2)],
    ]);
    canvas.unclip();
    assertValidWideCells(canvas.finish());
  }
});

test("structured wrapping matches the compatibility wrapper for random plain text", () => {
  const random = randomSource(0x57_a9);
  const alphabet = "abc def ghi jkl mno";
  for (let example = 0; example < 300; example++) {
    const text = Array.from({ length: random(80) }, () => alphabet[random(alphabet.length)]).join(
      "",
    );
    const width = 1 + random(20);
    const cells = Array.from(graphemes(text), (value) =>
      createCell(value, Math.max(1, stringWidth(value))),
    );
    const structured = wrapStructuredText([cells], width, "wrap")
      .map((line) =>
        line
          .filter((cell) => cell.width > 0)
          .map((cell) => cell.grapheme)
          .join(""),
      )
      .join("\n");
    expect(structured).toBe(wrapText(text, width, "wrap"));
  }
});
