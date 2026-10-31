import { expect, test } from "vite-plus/test";

import { Box, Text, render } from "#/index.ts";

import createStdout from "./helpers/create-stdout.ts";
import { reconstructTerminalLines } from "./helpers/reconstruct-terminal.ts";

// Behavioural port of Ink's log-update-sparse tests: changed rows must be
// cleared before painting, so no stale text survives on Sigil's screen.
test("shorter, empty, and styled rows remove old trailing content", async () => {
  const stdout = createStdout(10, true, 4);
  const frame = (row: React.ReactNode) => (
    <Box flexDirection="column">
      <Text>top</Text>
      {row}
      <Text>end</Text>
    </Box>
  );
  const instance = render(frame(<Text>long text</Text>), {
    stdout,
    interactive: true,
    patchConsole: false,
  });

  try {
    for (const [row, expected] of [
      [<Text color="red">red</Text>, "red"],
      [<Text>x</Text>, "x"],
      [<Text> </Text>, ""],
    ] as const) {
      instance.rerender(frame(row));
      await instance.waitUntilRenderFlush();
      const lines = reconstructTerminalLines(
        stdout.getWrites().join("").replaceAll("\n", "\r\n"),
        4,
      );
      expect(lines.slice(0, 3)).toEqual(["top", expected, "end"]);
    }
  } finally {
    instance.unmount();
  }
});
