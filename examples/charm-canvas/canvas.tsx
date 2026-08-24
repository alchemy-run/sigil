/** @jsxImportSource react */
// Ported from Charm Lip Gloss's canvas/compositor example (MIT).
import React from "react";

import { adaptive, perimeterGradient, type Paint } from "#/color/index.ts";
import { Box, render, Text } from "#/index.ts";

const cardBorder = perimeterGradient([
  "#FF388B", // CharmTone Cherry
  "#6B50FF", // CharmTone Charple
  "#00B875", // CharmTone Guac
  "#6B50FF",
  "#EB4268", // CharmTone Sriracha
]);

function Field({
  left,
  top,
  color,
}: {
  readonly left: number;
  readonly top: number;
  readonly color: Paint;
}) {
  return (
    <Box position="absolute" left={left} top={top} width={43} height={17}>
      <Text color={color}>{Array.from({ length: 17 }, () => "/".repeat(43)).join("\n")}</Text>
    </Box>
  );
}

function Card({
  label,
  left,
  top,
}: {
  readonly label: string;
  readonly left: number;
  readonly top: number;
}) {
  return (
    <Box
      position="absolute"
      left={left}
      top={top}
      width={16}
      height={9}
      borderStyle="round"
      borderColor={cardBorder}
      backgroundColor=""
      alignItems="center"
      justifyContent="center"
    >
      <Text color={adaptive("#4D4C57", "#FFFAF1")}>{label}</Text>
    </Box>
  );
}

function App() {
  return (
    <Box width={48} height={19}>
      <Field left={5} top={2} color={adaptive("#BFBCC8", "#201F26")} />
      <Field left={0} top={0} color={adaptive("#858392", "#3A3943")} />
      <Card label="Bitter Melon" left={22} top={1} />
      <Card label="Sriracha" left={11} top={7} />
      <Card label="Pickles" left={4} top={2} />
    </Box>
  );
}

render(<App />);
