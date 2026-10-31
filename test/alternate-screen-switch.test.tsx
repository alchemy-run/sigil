import { expect, onTestFinished, test } from "vite-plus/test";

import { ansiEscapes } from "#/ansi/escapes.ts";
import { Box, Static, Text, render } from "#/index.ts";

import createStdout from "./helpers/create-stdout.ts";
import { reconstructTerminalLines } from "./helpers/reconstruct-terminal.ts";

function App({ items, label }: { readonly items: string[]; readonly label: string }) {
  return (
    <Box flexDirection="column">
      <Static items={items}>{(item) => <Text key={item}>{item}</Text>}</Static>
      <Text>{label}</Text>
    </Box>
  );
}

const mainScreenLines = (writes: string) => {
  // Drop everything written inside the alternate screen: the terminal
  // discards that buffer when it is left.
  let main = "";
  let rest = writes;
  for (;;) {
    const enter = rest.indexOf(ansiEscapes.enterAlternativeScreen);
    if (enter === -1) break;
    main += rest.slice(0, enter);
    const exit = rest.indexOf(ansiEscapes.exitAlternativeScreen, enter);
    rest = exit === -1 ? "" : rest.slice(exit + ansiEscapes.exitAlternativeScreen.length);
  }
  main += rest;
  return reconstructTerminalLines(main.replaceAll("\n", "\r\n"), 10).filter(Boolean);
};

test("setAlternateScreen switches buffers on a live instance", async () => {
  const stdout = createStdout(40, true, 10);
  const instance = render(<App items={["log 1"]} label="inline" />, {
    stdout,
    interactive: true,
    patchConsole: false,
  });
  onTestFinished(() => {
    instance.unmount();
  });
  await instance.waitUntilRenderFlush();

  instance.setAlternateScreen(true);
  instance.rerender(<App items={["log 1", "log 2"]} label="fullscreen" />);
  await instance.waitUntilRenderFlush();

  let output = stdout.getWrites().join("");
  expect(output).toContain(ansiEscapes.enterAlternativeScreen);
  const afterEnter = output.slice(output.lastIndexOf(ansiEscapes.enterAlternativeScreen));
  expect(afterEnter).toContain("fullscreen");

  // Already in the alternate screen: no second switch.
  instance.setAlternateScreen(true);
  expect(stdout.getWrites().join("").split(ansiEscapes.enterAlternativeScreen)).toHaveLength(2);

  instance.setAlternateScreen(false);
  instance.rerender(<App items={["log 1", "log 2"]} label="inline again" />);
  await instance.waitUntilRenderFlush();

  output = stdout.getWrites().join("");
  expect(output).toContain(ansiEscapes.exitAlternativeScreen);
  // The inline frame was erased before entering, the <Static> row produced
  // in the alternate screen reached history, and the live frame repainted.
  expect(mainScreenLines(output)).toEqual(["log 1", "log 2", "inline again"]);
});

test("setAlternateScreen is ignored when the output is not an interactive TTY", async () => {
  const stdout = createStdout(40, false);
  const instance = render(<App items={[]} label="plain" />, { stdout });
  onTestFinished(() => {
    instance.unmount();
  });
  await instance.waitUntilRenderFlush();

  instance.setAlternateScreen(true);
  await instance.waitUntilRenderFlush();
  expect(stdout.getWrites().join("")).not.toContain(ansiEscapes.enterAlternativeScreen);
});

test("leaving the alternate screen writes a replaced <Static>'s output", async () => {
  const stdout = createStdout(40, true, 10);
  const tree = (key: string, items: string[]) => (
    <Box flexDirection="column">
      <Static key={key} items={items}>
        {(item) => <Text key={item}>{item}</Text>}
      </Static>
      <Text>live</Text>
    </Box>
  );
  const instance = render(tree("a", ["long original log"]), {
    stdout,
    interactive: true,
    patchConsole: false,
  });
  onTestFinished(() => {
    instance.unmount();
  });
  await instance.waitUntilRenderFlush();

  instance.setAlternateScreen(true);
  instance.rerender(tree("b", ["new"]));
  await instance.waitUntilRenderFlush();
  instance.setAlternateScreen(false);
  await instance.waitUntilRenderFlush();

  expect(mainScreenLines(stdout.getWrites().join(""))).toEqual([
    "long original log",
    "new",
    "live",
  ]);
});

test("setAlternateScreen erases screen-reader output from the main screen", async () => {
  const stdout = createStdout(40, true, 10);
  const instance = render(<Text>old</Text>, {
    stdout,
    interactive: true,
    patchConsole: false,
    isScreenReaderEnabled: true,
  });
  onTestFinished(() => {
    instance.unmount();
  });
  await instance.waitUntilRenderFlush();

  instance.setAlternateScreen(true);
  instance.rerender(<Text>new</Text>);
  await instance.waitUntilRenderFlush();
  instance.setAlternateScreen(false);
  await instance.waitUntilRenderFlush();

  expect(mainScreenLines(stdout.getWrites().join(""))).toEqual(["new"]);
});
