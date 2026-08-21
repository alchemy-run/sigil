import React from "react";
import { expect, test } from "vite-plus/test";

import { Box, Text } from "../src/index.ts";
import { renderToString, renderToStringAsync } from "./helpers/render-to-string.ts";

test("display flex", () => {
  const output = renderToString(
    <Box display="flex">
      <Text>X</Text>
    </Box>,
  );
  expect(output).toBe("X");
});

test("display none", () => {
  const output = renderToString(
    <Box flexDirection="column">
      <Box display="none">
        <Text>Kitty!</Text>
      </Box>
      <Text>Doggo</Text>
    </Box>,
  );

  expect(output).toBe("Doggo");
});

// Concurrent mode tests
test("display flex - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box display="flex">
      <Text>X</Text>
    </Box>,
  );
  expect(output).toBe("X");
});

test("display none - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box flexDirection="column">
      <Box display="none">
        <Text>Kitty!</Text>
      </Box>
      <Text>Doggo</Text>
    </Box>,
  );

  expect(output).toBe("Doggo");
});
