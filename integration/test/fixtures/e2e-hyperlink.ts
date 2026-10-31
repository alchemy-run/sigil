import { render, Box, Hyperlink, Text } from "@alchemy.run/sigil";
// Plain createElement (no JSX) so the fixture runs identically under any
// loader — a standalone TS runner may use the classic JSX transform for files outside
// the tsconfig include.
import { createElement } from "react";

render(
  createElement(
    Box,
    { flexDirection: "column" },
    createElement(Text, null, "Plain text"),
    createElement(Hyperlink, { url: "https://example.com" }, "Docs"),
  ),
);
