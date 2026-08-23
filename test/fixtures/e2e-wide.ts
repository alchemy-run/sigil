// Wide-character alignment: emoji are 2 cells in Sigil's layout, and the
// emulator must agree or the border tears (no JSX — see e2e-hyperlink.ts).
import { createElement } from "react";

import { render, Box, Text } from "#/index.ts";

render(
  createElement(
    Box,
    { borderStyle: "round", width: 16, flexDirection: "column" },
    createElement(Text, null, "🦄 snake"),
    createElement(Text, null, "plain"),
    createElement(Text, null, "✨✨ twice"),
  ),
);
