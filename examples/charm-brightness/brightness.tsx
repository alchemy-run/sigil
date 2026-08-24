/** @jsxImportSource react */
// Ported from Charm Lip Gloss's brightness example (MIT).
import React from "react";

import { adaptive, darken, lighten, rgb, type ColorInput } from "#/color/index.ts";
import { Box, render, Text } from "#/index.ts";
import type { Color } from "#/screen/index.ts";

const colors: ReadonlyArray<readonly [name: string, color: Color]> = [
  ["Red", rgb(255, 0, 0)],
  ["Blue", rgb(0, 102, 255)],
  ["Green", rgb(0, 255, 0)],
  ["Gray", rgb(128, 128, 128)],
];

function Scale({
  label,
  color,
  direction,
}: {
  readonly label: string;
  readonly color: Color;
  readonly direction: "lighter" | "darker";
}) {
  return (
    <Box>
      <Box width={12}>
        <Text>{label}</Text>
      </Box>
      {Array.from({ length: 20 }, (_, index) => {
        const amount = 0.05 * (index + 1);
        const shade: ColorInput =
          direction === "lighter" ? lighten(color, amount) : darken(color, amount);
        return (
          <Text key={index} color={shade}>
            ██
          </Text>
        );
      })}
    </Box>
  );
}

function App() {
  return (
    <Box flexDirection="column" padding={1}>
      {colors.map(([name, color]) => (
        <Box key={name} flexDirection="column" marginBottom={1}>
          <Text bold color={adaptive("#2D3748", "#E2E8F0")}>
            {name}
          </Text>
          <Scale label="Lightened:" color={color} direction="lighter" />
          <Scale label="Darkened:" color={color} direction="darker" />
        </Box>
      ))}
    </Box>
  );
}

render(<App />);
