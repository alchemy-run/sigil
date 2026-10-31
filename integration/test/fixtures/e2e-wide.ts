import { render, Box, Text } from "@alchemy.run/sigil";
// Wide-character alignment: emoji are 2 cells in Sigil's layout, and the
// emulator must agree or the border tears (no JSX — see e2e-hyperlink.ts).
import { createElement } from "react";

render(
  createElement(
    Box,
    { borderStyle: "round", width: 16, flexDirection: "column" },
    createElement(Text, null, "🦄 snake"),
    createElement(Text, null, "plain"),
    createElement(Text, null, "✨✨ twice"),
  ),
);
