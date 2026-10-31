import { expect, test } from "vite-plus/test";

import { render, useInput } from "#/index.ts";

import { createStdin, emitReadable } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

test("automatic exit handles legacy Ctrl+C with an undefined exit option", async () => {
  function Input() {
    useInput(() => {});
    return null;
  }

  const stdin = createStdin();
  const instance = render(<Input />, {
    stdin,
    stdout: createStdout(),
    exitOnCtrlC: undefined,
    patchConsole: false,
  });

  try {
    emitReadable(stdin, "\u0003");
    await expect(instance.waitUntilExit()).resolves.toBeUndefined();
  } finally {
    instance.unmount();
  }
});
