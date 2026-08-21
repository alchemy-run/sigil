import React from "react";
import { expect, test } from "vite-plus/test";

import stripAnsi from "../src/ansi/strip.ts";
import { render, Text, type CapturedOutputSource } from "../src/index.ts";
import createStdout, { type FakeStdout } from "./helpers/create-stdout.ts";

const getFrames = (stdout: FakeStdout): string[] =>
  stdout
    .getWrites()
    .filter((w) => w.length > 0 && !w.startsWith("\u001B[?25") && !w.startsWith("\u001B[?2026"));

test("patchConsole: 'stdio' splices direct stream writes above the frame", async () => {
  const stdout = createStdout();
  const { unmount, waitUntilRenderFlush } = render(<Text>UI frame</Text>, {
    stdout,
    interactive: true,
    patchConsole: "stdio",
  });
  await waitUntilRenderFlush();

  const writesBefore = stdout.getWrites().length;
  stdout.write("direct hello\n");
  await waitUntilRenderFlush();

  const spliced = getFrames(stdout).slice(0).join("");
  expect(stripAnsi(spliced).includes("direct hello"), "captured write is displayed").toBe(true);

  // The frame is restored after the spliced output.
  const afterWrite = stdout.getWrites().slice(writesBefore).join("");
  expect(
    stripAnsi(afterWrite).includes("UI frame"),
    "frame is repainted after external output",
  ).toBe(true);
  const output = stripAnsi(afterWrite);
  expect(
    output.indexOf("direct hello") < output.lastIndexOf("UI frame"),
    "external output lands above the repainted frame",
  ).toBe(true);

  unmount();
});

test("patchConsole: 'stdio' line-buffers partial chunks", async () => {
  const stdout = createStdout();
  const { unmount, waitUntilRenderFlush } = render(<Text>UI</Text>, {
    stdout,
    interactive: true,
    patchConsole: "stdio",
  });
  await waitUntilRenderFlush();

  const writesBefore = stdout.getWrites().length;
  stdout.write("par");
  stdout.write("tial\n");
  await waitUntilRenderFlush();

  const afterWrite = stripAnsi(stdout.getWrites().slice(writesBefore).join(""));
  expect(afterWrite.includes("partial\n"), "chunks are joined into a complete line").toBe(true);
  expect(afterWrite.includes("par\n"), "a partial chunk is not displayed on its own").toBe(false);

  unmount();
});

test("patchConsole: 'stdio' flushes a trailing partial line at unmount", async () => {
  const stdout = createStdout();
  const { unmount, waitUntilExit } = render(<Text>UI</Text>, {
    stdout,
    interactive: true,
    patchConsole: "stdio",
  });

  stdout.write("no newline yet");
  unmount();
  await waitUntilExit();

  expect(
    stripAnsi(stdout.getWrites().join("")).includes("no newline yet"),
    "the buffered tail is displayed before teardown",
  ).toBe(true);
});

test("onCapturedOutput observes chunks and can take ownership", async () => {
  const stdout = createStdout();
  const captured: Array<{ stream: string; data: string; source: CapturedOutputSource }> = [];

  const { unmount, waitUntilRenderFlush } = render(<Text>UI</Text>, {
    stdout,
    interactive: true,
    patchConsole: "stdio",
    onCapturedOutput(stream, data, source) {
      captured.push({ stream, data, source });
      return data.includes("suppress-me");
    },
  });
  await waitUntilRenderFlush();

  stdout.write("suppress-me\n");
  stdout.write("show-me\n");
  console.log("from console");
  await waitUntilRenderFlush();

  expect(
    captured.map((entry) => entry.source),
    "callback sees direct writes and console output with their sources",
  ).toEqual(["stdio", "stdio", "console"]);
  expect(captured[0].data.includes("suppress-me")).toBe(true);
  expect(captured[2].stream).toBe("stdout");

  const output = stripAnsi(stdout.getWrites().join(""));
  expect(output.includes("suppress-me"), "owned chunks are not displayed by Ink").toBe(false);
  expect(output.includes("show-me"), "unowned chunks still get the default display").toBe(true);
  expect(output.includes("from console"), "console output still gets the default display").toBe(
    true,
  );

  unmount();
});

test("patchConsole: 'stdio' restores stream writes on unmount", async () => {
  const stdout = createStdout();
  const originalWrite = stdout.write;

  const { unmount, waitUntilExit } = render(<Text>UI</Text>, {
    stdout,
    interactive: true,
    patchConsole: "stdio",
  });

  expect(stdout.write, "write is patched while mounted").not.toBe(originalWrite);

  unmount();
  await waitUntilExit();

  expect(stdout.write, "write is restored after unmount").toBe(originalWrite);
});

test("resize handling still works with patchConsole: 'stdio'", async () => {
  const stdout = createStdout(40);
  (stdout as any).rows = 10;

  function WindowLabel() {
    return <Text>W{stdout.columns}</Text>;
  }

  const { unmount, waitUntilRenderFlush } = render(<WindowLabel />, {
    stdout,
    interactive: true,
    patchConsole: "stdio",
  });
  await waitUntilRenderFlush();

  const writesBefore = stdout.getWrites().length;
  (stdout as any).rows = 20;
  stdout.emit("resize");
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });

  // The resize listener must fire through the render passthrough: a height
  // change forces a full rewrite of the frame.
  const afterResize = stripAnsi(stdout.getWrites().slice(writesBefore).join(""));
  expect(afterResize.includes("W40"), "resize listener fired and the frame was rewritten").toBe(
    true,
  );

  unmount();
});
