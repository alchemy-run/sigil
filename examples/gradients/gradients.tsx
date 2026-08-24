import React from "react";

import { linearGradient, rgb } from "#/color/index.ts";
import { Box, render, Text } from "#/index.ts";

const sunset = linearGradient(
  [rgb(255, 95, 109), { color: rgb(255, 195, 113), offset: 0.55 }, rgb(92, 92, 255)],
  { angle: 12 },
);

render(
  <Box borderStyle="round" borderColor={sunset} backgroundColor={sunset} padding={1}>
    <Text color={linearGradient(["white", "cyanBright"])}>Structured terminal color</Text>
  </Box>,
);
