import { expect, test } from "vite-plus/test";

import { Text, Transform } from "#/index.ts";

import { renderToString } from "./helpers/render-to-string.ts";

test("nested transforms receive each explicit line with its line index", () => {
  const output = renderToString(
    <Text>
      <Transform transform={(line, index) => line.replaceAll("x", () => String(index))}>
        <Text>{"xx\nxx"}</Text>
      </Transform>
    </Text>,
  );

  expect(output).toBe("00\n11");
});

test("nested transform line indices do not depend on preceding siblings", () => {
  const output = renderToString(
    <Text>
      prefix
      <Transform transform={(line, index) => line.replaceAll("x", () => String(index))}>
        <Text>xx</Text>
      </Transform>
    </Text>,
  );

  expect(output).toBe("prefix00");
});
