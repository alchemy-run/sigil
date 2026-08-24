import { expect, test } from "vite-plus/test";

import {
  darken,
  lighten,
  linearGradient,
  perimeterGradient,
  rgb,
  samplePaint,
} from "#/color/index.ts";
import { Box, renderToString, Text } from "#/index.ts";
import { createCell, Screen } from "#/screen/index.ts";

const gradient = linearGradient([rgb(255, 0, 0), rgb(0, 0, 255)]);

test("samples linear-gradient endpoints across final bounds", () => {
  expect(samplePaint(gradient, 2, 4, { x: 2, y: 4, width: 5, height: 1 })).toEqual(rgb(255, 0, 0));
  expect(samplePaint(gradient, 6, 4, { x: 2, y: 4, width: 5, height: 1 })).toEqual(rgb(0, 0, 255));
});

test("renders native text foreground gradients before profile quantization", () => {
  const truecolor = renderToString(<Text color={gradient}>abcd</Text>, {
    colorProfile: "truecolor",
  });
  expect(truecolor).toContain("\u001B[38;2;255;0;0m");
  expect(truecolor).toContain("\u001B[38;2;0;0;255m");

  const ansi16 = renderToString(<Text color={gradient}>abcd</Text>, { colorProfile: "ansi16" });
  expect(ansi16).not.toContain("38;2");
  expect(ansi16).toContain("\u001B[91m");
  expect(ansi16).toContain("\u001B[94m");
});

test("renders Box background gradients beneath child text", () => {
  const output = renderToString(
    <Box width={4} backgroundColor={gradient}>
      <Text>text</Text>
    </Box>,
    { columns: 4, colorProfile: "truecolor" },
  );
  expect(output).toContain("\u001B[48;2;255;0;0m");
  expect(output).toContain("\u001B[48;2;0;0;255m");
});

test("samples border gradients over the laid-out border rectangle", () => {
  const vertical = linearGradient([rgb(255, 0, 0), rgb(0, 0, 255)], { angle: 90 });
  const output = renderToString(
    <Box width={4} height={3} borderStyle="single" borderColor={vertical} />,
    { columns: 4, colorProfile: "truecolor" },
  );
  expect(output.split("\n")[0]).toContain("\u001B[38;2;255;0;0m");
  expect(output.split("\n")[2]).toContain("\u001B[38;2;0;0;255m");
});

test("matches Lip Gloss's clockwise CIELAB border blend", () => {
  const blend = perimeterGradient(["#FF388B", "#6B50FF", "#00B875", "#6B50FF", "#EB4268"]);
  const bounds = { x: 0, y: 0, width: 16, height: 9 };
  const perimeter = [
    ...Array.from({ length: 16 }, (_, x) => [x, 0]),
    ...Array.from({ length: 7 }, (_, row) => [15, row + 1]),
    ...Array.from({ length: 16 }, (_, column) => [15 - column, 8]),
    ...Array.from({ length: 7 }, (_, row) => [0, 7 - row]),
  ] as const;
  const actual = perimeter.map(([x, y]) => {
    const color = samplePaint(blend, x, y, bounds);
    if (!color || color.model !== "rgb") throw new Error("Expected an RGB perimeter color");
    return `#${[color.red, color.green, color.blue]
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")}`.toUpperCase();
  });

  // Captured from Lip Gloss Blend1D(46, Cherry, Charple, Guac, Charple, Sriracha).
  expect(actual).toEqual([
    "#FF388B",
    "#F73A95",
    "#EE3DA0",
    "#E43FAA",
    "#DA41B5",
    "#CF43BF",
    "#C345CA",
    "#B647D4",
    "#A84ADF",
    "#974CEA",
    "#844EF5",
    "#6B50FF",
    "#6B50FF",
    "#6D5CF3",
    "#6E68E7",
    "#6D72DB",
    "#6B7CCE",
    "#6785C2",
    "#628EB6",
    "#5B97A9",
    "#52A09D",
    "#45A890",
    "#31B083",
    "#00B875",
    "#00B875",
    "#34AF84",
    "#48A692",
    "#559DA0",
    "#5E94AE",
    "#658ABC",
    "#6A80C9",
    "#6D75D7",
    "#6E6AE4",
    "#6D5DF2",
    "#6B50FF",
    "#6B50FF",
    "#854EF0",
    "#994CE0",
    "#A94AD1",
    "#B648C2",
    "#C246B2",
    "#CC45A3",
    "#D54494",
    "#DD4386",
    "#E54277",
    "#EB4268",
  ]);
  expect(
    samplePaint(
      perimeterGradient(
        blend.stops.map((stop) => stop.color),
        { offset: 1 },
      ),
      0,
      0,
      bounds,
    ),
  ).toEqual(rgb(235, 66, 104));
});

test("composites alpha against a known destination channel", () => {
  const screen = new Screen(1, 1);
  screen.setCell(
    0,
    0,
    createCell(" ", 1, {
      background: rgb(0, 0, 255),
      underline: "none",
      attributes: 0,
    }),
  );
  screen.composeCell(0, 0, { background: rgb(255, 0, 0, 128) });
  expect(screen.cellAt(0, 0)?.style.background).toEqual(rgb(128, 0, 127));
});

test("lightens and darkens colors perceptually with clamped endpoints", () => {
  const color = rgb(200, 80, 40);
  expect(lighten(color, 0)).toEqual(color);
  expect(lighten(color, 1)).toEqual(rgb(255, 255, 255));
  expect(darken(color, 0)).toEqual(color);
  expect(darken(color, 1)).toEqual(rgb(0, 0, 0));
});
