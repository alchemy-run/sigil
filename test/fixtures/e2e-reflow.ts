// Width-shrink ghosting: rows wider than the new width are rewrapped by the
// emulator before Sigil hears about the resize, so the erase must cover the
// rewrapped footprint or the top rows survive (no JSX — see e2e-hyperlink.ts).
import { createElement } from "react";

import { render, Box, Text, useWindowSize } from "#/index.ts";

function Frame() {
  const { columns } = useWindowSize();
  return createElement(
    Box,
    { flexDirection: "column" },
    createElement(Text, null, "TOPROW alpha beta"),
    createElement(Text, null, "second row"),
    createElement(Text, null, "long line " + "x".repeat(60) + " end"),
    createElement(Text, null, "another long line " + "y".repeat(60) + " end"),
    createElement(Text, null, `footer at ${columns} columns`),
  );
}

render(createElement(Frame));
