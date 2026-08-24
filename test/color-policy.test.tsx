import { expect, test } from "vite-plus/test";

import { colorState, resolveColorProfile } from "#/capabilities/index.ts";
import { render, renderToString, Text } from "#/index.ts";

import createStdout from "./helpers/create-stdout.ts";

test("resolves automatic and explicit color policy separately", () => {
  expect(resolveColorProfile(2)).toBe("ansi256");
  expect(resolveColorProfile(2, "none")).toBe("none");
  expect(resolveColorProfile(0, "truecolor")).toBe("truecolor");

  expect(colorState({ color: { level: 1 } }, "ansi256")).toEqual({
    detected: "ansi16",
    policy: "ansi256",
    effective: "ansi256",
  });
});

test("renderToString accepts a deterministic color profile", () => {
  const node = <Text color="#ff8800">Test</Text>;

  expect(renderToString(node, { colorProfile: "none" })).toBe("Test");
  expect(renderToString(node, { colorProfile: "truecolor" })).toBe(
    "\u001B[38;2;255;136;0mTest\u001B[39m",
  );
});

test("simultaneous render instances keep independent color profiles", () => {
  const plain = createStdout();
  const colored = createStdout();
  const node = <Text color="#ff8800">Test</Text>;

  const plainInstance = render(node, { stdout: plain, debug: true, colorProfile: "none" });
  const colorInstance = render(node, {
    stdout: colored,
    debug: true,
    colorProfile: "truecolor",
  });

  expect(plain.get()).toBe("Test");
  expect(colored.get()).toBe("\u001B[38;2;255;136;0mTest\u001B[39m");

  plainInstance.unmount();
  colorInstance.unmount();
});
