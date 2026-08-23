// Plain createElement (no JSX) so the fixture runs identically under any
// loader — standalone tsx uses the classic JSX transform for files outside
// the tsconfig include.
import { createElement } from "react";

import { render, Box, Hyperlink, Text } from "#/index.ts";

render(
  createElement(
    Box,
    { flexDirection: "column" },
    createElement(Text, null, "Plain text"),
    createElement(Hyperlink, { url: "https://example.com" }, "Docs"),
  ),
);
