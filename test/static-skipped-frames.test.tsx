import { useLayoutEffect } from "react";
import { expect, onTestFinished, test } from "vite-plus/test";

import { Box, Static, Text, render, useApp } from "#/index.ts";

import createStdout from "./helpers/create-stdout.ts";

// <Static> keeps new items in the tree only for the commit that adds them, so
// a commit whose frame is skipped must still capture them.

function App({ items }: { readonly items: string[] }) {
  return (
    <Box flexDirection="column">
      <Static items={items}>{(item) => <Text key={item}>{item}</Text>}</Static>
      <Text>live</Text>
    </Box>
  );
}

const occurrences = (output: string, text: string) => output.split(text).length - 1;

test("<Static> items added while a resize settles are written once", async () => {
  const stdout = createStdout(40, true, 10);
  const instance = render(<App items={[]} />, { stdout, interactive: true, patchConsole: false });
  onTestFinished(() => {
    instance.unmount();
  });
  await instance.waitUntilRenderFlush();

  stdout.columns = 30;
  stdout.emit("resize");
  instance.rerender(<App items={["added mid-resize"]} />);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await instance.waitUntilRenderFlush();
  instance.unmount();

  expect(occurrences(stdout.getWrites().join(""), "added mid-resize")).toBe(1);
});

test("<Static> items added while suspended are written once on resume", async () => {
  const stdout = createStdout(40, true, 10);
  let suspendTerminal!: ReturnType<typeof useApp>["suspendTerminal"];
  function Suspendable({ items }: { readonly items: string[] }) {
    const app = useApp();
    useLayoutEffect(() => {
      suspendTerminal = app.suspendTerminal;
    }, [app]);
    return <App items={items} />;
  }

  const instance = render(<Suspendable items={[]} />, {
    stdout,
    interactive: true,
    patchConsole: false,
  });
  onTestFinished(() => {
    instance.unmount();
  });
  await instance.waitUntilRenderFlush();

  const suspension = await suspendTerminal();
  instance.rerender(<Suspendable items={["added while suspended"]} />);
  await instance.waitUntilRenderFlush();
  expect(stdout.getWrites().join("")).not.toContain("added while suspended");

  await suspension.resume();
  instance.unmount();
  expect(occurrences(stdout.getWrites().join(""), "added while suspended")).toBe(1);
});
