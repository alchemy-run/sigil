/** @jsxImportSource react */
import { useEffect } from "react";
import { expect, test } from "vite-plus/test";

import {
  notify,
  setClipboard,
  setPointerShape,
  setTerminalProgress,
  setWindowTitle,
  setWorkingDirectory,
} from "#/ansi/osc.ts";
import {
  render,
  Text,
  useClipboard,
  useNotification,
  usePointerShape,
  useProgress,
  useTitle,
  useWorkingDirectory,
} from "#/index.ts";

import { createStdin } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

const Integrations = ({ value }: { readonly value: number }) => {
  const copy = useClipboard();
  const sendNotification = useNotification();
  useProgress({ state: "normal", value });
  useTitle("Alchemy");
  useWorkingDirectory("/tmp");
  usePointerShape("pointer");
  useEffect(() => {
    copy("secret");
    sendNotification("Ready");
  }, [copy, sendNotification]);
  return <Text>work</Text>;
};

test("React OSC hooks publish through the renderer-owned terminal session", async () => {
  const stdout = createStdout();
  const instance = render(<Integrations value={25} />, {
    stdin: createStdin(),
    stdout,
    stderr: stdout,
    patchConsole: false,
  });
  await instance.waitUntilRenderFlush();
  await new Promise((resolve) => setTimeout(resolve, 0));

  const output = stdout.getWrites().join("");
  expect(output).toContain(setTerminalProgress("normal", 25));
  expect(output).toContain(setWindowTitle("Alchemy"));
  expect(output).toContain(setWorkingDirectory("/tmp"));
  expect(output).toContain(setPointerShape("pointer"));
  expect(output).toContain(setClipboard("secret"));
  expect(output).toContain(notify("Ready"));

  const writesBeforeUpdate = stdout.getWrites().length;
  instance.rerender(<Integrations value={50} />);
  await instance.waitUntilRenderFlush();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const updateOutput = stdout.getWrites().slice(writesBeforeUpdate).join("");
  expect(updateOutput).toContain(setTerminalProgress("normal", 50));
  expect(updateOutput).not.toContain(setTerminalProgress("inactive"));

  instance.unmount();
  await instance.waitUntilExit();
  expect(stdout.getWrites().join("")).toContain(setTerminalProgress("inactive"));
  expect(stdout.getWrites().join("")).toContain(setWindowTitle(""));
});
