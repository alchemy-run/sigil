import { expect, onTestFinished, test } from "vite-plus/test";

import { Box, Text, Static, render } from "#/index.ts";

import createStdout from "./helpers/create-stdout.ts";
import { reconstructTerminalLines } from "./helpers/reconstruct-terminal.ts";

for (const height of [0, 1, 2]) {
  test(`runtime Static preserves ${height} blank rows in debug output`, async () => {
    const stdout = createStdout();
    const instance = render(
      <>
        <Static items={["blank"]}>{(item) => <Box key={item} height={height} />}</Static>
        <Text>after</Text>
      </>,
      { stdout, debug: true, patchConsole: false },
    );
    onTestFinished(() => {
      instance.unmount();
    });
    await instance.waitUntilRenderFlush();

    expect(stdout.get()).toBe("\n".repeat(height) + "after");
  });

  test(`runtime Static preserves ${height} blank rows in non-interactive output`, async () => {
    const stdout = createStdout(100, false);
    const instance = render(
      <>
        <Static items={["blank"]}>{(item) => <Box key={item} height={height} />}</Static>
        <Text>after</Text>
      </>,
      { stdout, interactive: false, patchConsole: false },
    );
    onTestFinished(() => {
      instance.unmount();
    });
    await instance.waitUntilRenderFlush();
    instance.unmount();
    await instance.waitUntilExit();

    expect(stdout.getWrites().join("")).toBe("\n".repeat(height) + "after\n");
  });
}

// Sigil has a single cell-diffing renderer, so Ink's `incrementalRendering` variants collapse into one case.
test("a blank Static append survives a later live update", async () => {
  const stdout = createStdout(100, true);
  stdout.rows = 8;
  const view = (items: string[], label: string) => (
    <>
      <Static items={items}>
        {(item) =>
          item === "blank" ? <Box key={item} height={1} /> : <Text key={item}>{item}</Text>
        }
      </Static>
      <Text>{label}</Text>
    </>
  );
  const instance = render(view(["first"], "live"), {
    stdout,
    interactive: true,
    patchConsole: false,
  });
  onTestFinished(() => {
    instance.unmount();
  });
  await instance.waitUntilRenderFlush();
  instance.rerender(view(["first", "blank"], "live"));
  await instance.waitUntilRenderFlush();
  instance.rerender(view(["first", "blank", "last"], "live"));
  await instance.waitUntilRenderFlush();
  instance.rerender(view(["first", "blank", "last"], "updated"));
  await instance.waitUntilRenderFlush();

  const lines = reconstructTerminalLines(stdout.getWrites().join("").replaceAll("\n", "\r\n"), 8);
  expect(lines.slice(0, 4)).toEqual(["first", "", "last", "updated"]);
});
