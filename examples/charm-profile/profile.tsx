/** @jsxImportSource react */
// Adapted from Charm Lip Gloss's SSH color-profile example (MIT). Sigil's
// stream-scoped session performs the same negotiation for the local terminal.
import React from "react";

import { adaptive, perProfile } from "#/color/index.ts";
import { Box, render, Text, useCapabilities } from "#/index.ts";

const profileAccent = perProfile(
  { ansi16: "magentaBright", ansi256: "ansi256(171)", truecolor: "#D290E4" },
  "white",
);

function Swatch({ name, color }: { readonly name: string; readonly color: string }) {
  return <Text color={color}>{name}</Text>;
}

function App() {
  const capabilities = useCapabilities();
  const { terminal, color, theme, supports } = capabilities;
  return (
    <Box
      minHeight={14}
      padding={2}
      alignItems="center"
      justifyContent="center"
      backgroundColor={adaptive("ansi256(254)", "ansi256(234)")}
    >
      <Box flexDirection="column">
        <Text bold>
          Profile:{" "}
          <Text color={profileAccent}>
            {color.depth}-bit / level {color.level}
          </Text>
        </Text>
        <Text dimColor>
          Terminal: {terminal.name ?? terminal.term ?? "unknown"}
          {terminal.version ? ` ${terminal.version}` : ""}
        </Text>
        <Box marginTop={1} gap={1}>
          <Text bold>bold</Text>
          <Text dimColor>faint</Text>
          <Text italic>italic</Text>
          <Text underline>underline</Text>
          <Text strikethrough>strikethrough</Text>
        </Box>
        <Box gap={1}>
          <Swatch name="red" color="#E88388" />
          <Swatch name="green" color="#A8CC8C" />
          <Swatch name="yellow" color="#DBAB79" />
          <Swatch name="blue" color="#71BEF2" />
          <Swatch name="magenta" color="#D290E4" />
          <Swatch name="cyan" color="#66C2CD" />
          <Swatch name="gray" color="#B9BFCA" />
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text>
            <Text bold>Appearance:</Text> {theme.appearance ?? "unknown"}
          </Text>
          <Text>
            <Text bold>Hyperlinks:</Text> {String(supports.hyperlinks)}
          </Text>
          <Text>
            <Text bold>Synchronized output:</Text> {String(supports.synchronizedOutput)}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

render(<App />);
