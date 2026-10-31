import { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

import { useState } from "react";
import { onTestFinished, expect, test, vi } from "vite-plus/test";

import { render, useApp, useCapabilities, useInput } from "#/index.ts";
import { resolveFlags } from "#/kitty-keyboard.ts";

import { createStdin as createSyncStdin, emitReadable } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

const createStdin = () =>
  Object.assign(new Readable({ read() {} }), {
    isTTY: true,
    setRawMode() {},
  });

test("associated text requests include all-key reporting", () => {
  expect(resolveFlags(["reportAssociatedText"])).toBe(24);
  expect(resolveFlags(["disambiguateEscapeCodes", "reportAssociatedText"])).toBe(25);
});

test("auto detection consumes responses without duplicating input", async () => {
  const stdin = createStdin();
  const stdout = createStdout();
  const inputs: string[] = [];
  function Example() {
    useInput((input) => {
      inputs.push(input);
    });
    return null;
  }

  const app = render(<Example />, {
    stdin,
    stdout,
    interactive: true,
    kittyKeyboard: { mode: "auto" },
  });
  onTestFinished(() => {
    app.unmount();
  });
  stdin.push("x\u001B[?0u");
  await delay(30);
  expect(inputs).toEqual(["x"]);
  expect(stdout.getWrites()).toContain("\u001B[>1u");
});

test("auto detection completes when a capability query consumes the reply", async () => {
  const stdin = createStdin();
  const stdout = createStdout();
  function Example() {
    useInput(() => {});
    useCapabilities();
    return null;
  }

  const app = render(<Example />, {
    stdin,
    stdout,
    interactive: true,
    kittyKeyboard: { mode: "auto" },
  });
  onTestFinished(() => {
    app.unmount();
  });
  await delay(30);
  // The capability query owns stdin while it waits for device attributes, so
  // it reads the kitty reply, not TerminalInput.
  stdin.push("\u001B[?0u\u001B[?1;2c");
  await delay(230);
  expect(stdout.getWrites()).toContain("\u001B[>1u");
});

test("suspension cancels pending keyboard negotiation", async () => {
  const stdin = createStdin();
  const stdout = createStdout();
  let suspendTerminal!: ReturnType<typeof useApp>["suspendTerminal"];
  function Example() {
    suspendTerminal = useApp().suspendTerminal;
    useInput(() => {});
    return null;
  }

  const app = render(<Example />, {
    stdin,
    stdout,
    interactive: true,
    alternateScreen: true,
    kittyKeyboard: { mode: "auto" },
  });
  onTestFinished(() => {
    app.unmount();
  });
  const suspension = await suspendTerminal();
  const beforeResponse = stdout.getWrites().length;
  stdin.push("\u001B[?0u");
  await delay(30);
  expect(stdout.getWrites().slice(beforeResponse)).toEqual([]);
  await suspension.resume();
  expect(stdout.getWrites()).not.toContain("\u001B[>1u");
});

test("unmount while suspended does not pop the primary keyboard stack", async () => {
  const stdin = createStdin();
  const stdout = createStdout();
  let suspendTerminal!: ReturnType<typeof useApp>["suspendTerminal"];
  function Example() {
    suspendTerminal = useApp().suspendTerminal;
    useInput(() => {});
    return null;
  }

  const app = render(<Example />, {
    stdin,
    stdout,
    interactive: true,
    alternateScreen: true,
    kittyKeyboard: { mode: "enabled" },
  });
  onTestFinished(() => {
    app.unmount();
  });
  const suspension = await suspendTerminal();
  app.unmount();
  await suspension.resume();
  expect(stdout.getWrites().filter((value) => value === "\u001B[>1u")).toHaveLength(1);
  expect(stdout.getWrites().filter((value) => value === "\u001B[<u")).toHaveLength(1);
});

test("pasted query responses remain input and do not enable the protocol", async () => {
  const stdin = createStdin();
  const stdout = createStdout();
  const inputs: string[] = [];
  function Example() {
    useInput((input) => {
      inputs.push(input);
    });
    return null;
  }

  const app = render(<Example />, {
    stdin,
    stdout,
    interactive: true,
    kittyKeyboard: { mode: "auto" },
  });
  onTestFinished(() => {
    app.unmount();
  });
  stdin.push("\u001B[200~\u001B[?0u\u001B[201~");
  await delay(30);
  expect(inputs).toEqual(["[?0u"]);
  expect(stdout.getWrites()).not.toContain("\u001B[>1u");
});

test("auto detection queries the terminal only once raw mode is enabled", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const stdout = createStdout();
  const rawModeEnabled = Promise.withResolvers<number>();
  const stdin = createSyncStdin();
  stdin.setRawMode.mockImplementation((isEnabled: boolean) => {
    if (isEnabled) {
      rawModeEnabled.resolve(stdout.getWrites().length);
    }
  });

  let showInput!: () => void;
  function Input() {
    useInput(() => {});
    return null;
  }

  function Example() {
    const [isInputShown, setIsInputShown] = useState(false);
    showInput = () => {
      setIsInputShown(true);
    };

    return isInputShown ? <Input /> : null;
  }

  const app = render(<Example />, {
    stdin,
    stdout,
    interactive: true,
    kittyKeyboard: { mode: "auto" },
  });
  onTestFinished(() => {
    app.unmount();
    vi.useRealTimers();
  });
  // Longer than the detection timeout: neither the query nor its timer may start before raw mode.
  await vi.advanceTimersByTimeAsync(250);
  expect(stdout.getWrites()).not.toContain("\u001B[?u");
  showInput();
  const writesBeforeRawMode = await rawModeEnabled.promise;
  expect(stdout.getWrites().indexOf("\u001B[?u")).toBeGreaterThanOrEqual(writesBeforeRawMode);
  emitReadable(stdin, "\u001B[?0u");
  expect(stdout.getWrites()).toContain("\u001B[>1u");
});
