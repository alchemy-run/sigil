import { afterAll, beforeAll, expect, test } from "vite-plus/test";

import { chalk } from "#/ansi/chalk.ts";
import { Text } from "#/index.ts";

import { renderToString } from "./helpers/render-to-string.ts";

const originalLevel = chalk.level;
beforeAll(() => {
  chalk.level = 3;
});
afterAll(() => {
  chalk.level = originalLevel;
});

const renderColor = (color: string, type: "foreground" | "background") =>
  renderToString(
    type === "foreground" ? (
      <Text color={color}>Test</Text>
    ) : (
      <Text backgroundColor={color}>Test</Text>
    ),
  );

for (const type of ["foreground", "background"] as const) {
  test(`RGB ${type} colors allow whitespace around components`, () => {
    const prefix = type === "foreground" ? 38 : 48;
    const reset = type === "foreground" ? 39 : 49;
    const expected = `\u001B[${prefix};2;232;131;136mTest\u001B[${reset}m`;

    for (const color of [
      "rgb(232 , 131 , 136)",
      "rgb(  232,  131,  136  )",
      "rgb(\t232\t,\n131\n,\t136\t)",
    ]) {
      expect(renderColor(color, type)).toBe(expected);
    }
  });
}

for (const color of [
  "level",
  "constructor",
  "toString",
  "bold",
  "bgRed",
  "unknown",
  "rgb(23 2, 131, 136)",
  "rgb(232, , 136)",
]) {
  for (const type of ["foreground", "background"] as const) {
    test(`ignores invalid ${type} color ${color}`, () => {
      expect(renderColor(color, type)).toBe("Test");
    });
  }
}
