/** @jsxImportSource react */
// This fixture deliberately imports `ink`, as an independently published Ink
// component would. The test config aliases that package name to Sigil's root.
// @ts-expect-error The dependency name is intentionally provided only by the test alias.
import { Box, Text } from "ink";

export function Status({ state }: { readonly state: "ready" | "busy" }) {
  return (
    <Box borderStyle="round" paddingX={1}>
      <Text bold color={state === "ready" ? "green" : "yellow"}>
        {state}
      </Text>
    </Box>
  );
}
