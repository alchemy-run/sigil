import { expect, test } from "vite-plus/test";

import { Box, Text, render } from "#/index.ts";

import createStdout from "./helpers/create-stdout.ts";
import { reconstructTerminalLines } from "./helpers/reconstruct-terminal.ts";

// Behavioural ports of Ink's log-update tests, run against Sigil's
// ScreenPresenter through `render()`.

const history = "history1\nhistory2\nhistory3\n";
const visible = (writes: string[], rows: number): string[] =>
  reconstructTerminalLines((history + writes.join("")).replaceAll("\n", "\r\n"), rows);

for (const rows of [4, 6, 10]) {
  test(`growing a rendered Box with an empty row preserves history in a ${rows}-row terminal`, async () => {
    const stdout = createStdout(100, true, rows);
    const frame = (height: number, text: string) => (
      <Box height={height}>
        <Text>{text}</Text>
      </Box>
    );
    const instance = render(frame(1, "A"), { stdout, interactive: true, patchConsole: false });

    try {
      await instance.waitUntilRenderFlush();
      instance.rerender(frame(2, "A"));
      await instance.waitUntilRenderFlush();
      instance.rerender(frame(2, "B"));
      await instance.waitUntilRenderFlush();

      const lines = visible(stdout.getWrites(), rows);
      expect(lines.slice(0, 4)).toEqual(["history1", "history2", "history3", "B"]);
      expect(lines.slice(4).every((line) => line === "")).toBe(true);
    } finally {
      instance.unmount();
    }
  });
}

test("single-line fullscreen updates stay on the current row", async () => {
  const stdout = createStdout(100, true, 1);
  const instance = render(<Text>Before</Text>, { stdout, interactive: true, patchConsole: false });

  try {
    await instance.waitUntilRenderFlush();
    instance.rerender(<Text>After</Text>);
    await instance.waitUntilRenderFlush();

    expect(visible(stdout.getWrites(), 1)).toEqual(["history1", "history2", "history3", "After"]);
  } finally {
    instance.unmount();
  }
});

test("growing a single fullscreen line starts on the same row", async () => {
  const stdout = createStdout(100, true, 2);
  const instance = render(<Text>First</Text>, { stdout, interactive: true, patchConsole: false });

  try {
    await instance.waitUntilRenderFlush();
    instance.rerender(<Text>{"First\nSecond"}</Text>);
    await instance.waitUntilRenderFlush();

    expect(visible(stdout.getWrites(), 2)).toEqual([
      "history1",
      "history2",
      "history3",
      "First",
      "Second",
    ]);
  } finally {
    instance.unmount();
  }
});
