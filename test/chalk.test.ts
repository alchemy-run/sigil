import { expect, test } from "vite-plus/test";

import { chalk, createChalk } from "#/ansi/chalk.ts";

test("styles text and chains like chalk", () => {
  const styled = createChalk({ level: 3 });
  expect(styled.red("x")).toBe("\u001B[31mx\u001B[39m");
  expect(styled.bold.red("x")).toBe("\u001B[1m\u001B[31mx\u001B[39m\u001B[22m");
  expect(styled.dim.hex("#e28a5b")("x")).toBe(
    "\u001B[2m\u001B[38;2;226;138;91mx\u001B[39m\u001B[22m",
  );
  expect(styled.bgHex("#000000").white.bold("x")).toBe(
    "\u001B[48;2;0;0;0m\u001B[37m\u001B[1mx\u001B[22m\u001B[39m\u001B[49m",
  );
  // The root is a style too, applying nothing.
  expect(styled("x")).toBe("x");
});

test("instances keep independent levels", () => {
  const plain = createChalk({ level: 0 });
  const colored = createChalk({ level: 3 });
  expect(plain.bold.red("x")).toBe("x");
  expect(colored.red("x")).toBe("\u001B[31mx\u001B[39m");

  const originalLevel = chalk.level;
  try {
    chalk.level = 0;
    expect(colored.red("x")).toBe("\u001B[31mx\u001B[39m");
  } finally {
    chalk.level = originalLevel;
  }
});

test("level is shared by every style chained off an instance", () => {
  const styled = createChalk({ level: 3 });
  const brand = styled.bold.hex("#ff0000");
  styled.level = 0;
  expect(brand("x")).toBe("x");
  brand.level = 2;
  expect(styled.level).toBe(2);
  expect(brand("x")).toBe("\u001B[1m\u001B[38;5;196mx\u001B[39m\u001B[22m");
});

test("accepts a color profile and downsamples hex and rgb to it", () => {
  expect(createChalk({ level: "none" }).hex("#ff0000")("x")).toBe("x");
  expect(createChalk({ level: "ansi16" }).hex("#ff0000")("x")).toBe("\u001B[91mx\u001B[39m");
  expect(createChalk({ level: "ansi256" }).rgb(255, 0, 0)("x")).toBe("\u001B[38;5;196mx\u001B[39m");
  expect(createChalk({ level: "truecolor" }).bgRgb(1, 2, 3)("x")).toBe(
    "\u001B[48;2;1;2;3mx\u001B[49m",
  );
});

test("detects the level for a stream", () => {
  const forced = process.env.FORCE_COLOR;
  try {
    delete process.env.FORCE_COLOR;
    expect(createChalk({ stream: { isTTY: false } }).level).toBe(0);
  } finally {
    if (forced === undefined) delete process.env.FORCE_COLOR;
    else process.env.FORCE_COLOR = forced;
  }
});

test("re-opens styles after nested closes and around line breaks", () => {
  const styled = createChalk({ level: 1 });
  expect(styled.red(`a${styled.blue("b")}c`)).toBe(
    "\u001B[31ma\u001B[34mb\u001B[39m\u001B[31mc\u001B[39m",
  );
  expect(styled.bgRed("a\nb")).toBe("\u001B[41ma\u001B[49m\n\u001B[41mb\u001B[49m");
});
