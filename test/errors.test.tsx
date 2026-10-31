import { setImmediate } from "node:timers/promises";
import vm from "node:vm";

import { useEffect } from "react";
import { expect, onTestFinished, test } from "vite-plus/test";

import { stripAnsi } from "#/ansi/strip.ts";
import { render, useStdin, Text } from "#/index.ts";
import { patchConsole } from "#/patch-console.ts";

import createStdout from "./helpers/create-stdout.ts";

let restore = () => {};

test.beforeAll(() => {
  restore = patchConsole(() => {});
});

test.afterAll(() => {
  restore();
});

test("catch and display error", () => {
  const stdout = createStdout();

  const Test = () => {
    throw new Error("Oh no");
  };

  render(<Test />, { stdout });

  const writes = stdout
    .getWrites()
    .filter((w) => w.length > 0 && !w.startsWith("\u001B[?25") && !w.startsWith("\u001B[?2026"));
  const lastContentWrite = writes.at(-1)!;

  expect(stripAnsi(lastContentWrite).split("\n").slice(0, 14).join("\n")).toMatchInlineSnapshot(`
    "
      ERROR  Oh no

     test/errors.test.tsx:27:11

     24:   const stdout = createStdout();
     25:
     26:   const Test = () => {
     27:     throw new Error("Oh no");
     28:   };
     29:
     30:   render(<Test />, { stdout });

     - Test (test/errors.test.tsx:27:11)"
  `);
});

test("does not emit unhandledRejection when render exits with an error and waitUntilExit is unused", async () => {
  const stdout = createStdout();
  const unhandledRejectionReasons: unknown[] = [];
  const onUnhandledRejection = (reason: unknown) => {
    unhandledRejectionReasons.push(reason);
  };

  process.on("unhandledRejection", onUnhandledRejection);

  try {
    const Test = () => {
      throw new Error("Oh no");
    };

    render(<Test />, { stdout });

    await setImmediate();
    await setImmediate();

    expect(unhandledRejectionReasons.length).toBe(0);
  } finally {
    process.off("unhandledRejection", onUnhandledRejection);
  }
});

test("ErrorBoundary catches and displays nested component errors", () => {
  const stdout = createStdout();

  const NestedComponent = () => {
    throw new Error("Nested component error");
  };

  function Parent() {
    return (
      <Text>
        Before error
        <NestedComponent />
      </Text>
    );
  }

  render(<Parent />, { stdout });

  const writes = stdout
    .getWrites()
    .filter((w) => w.length > 0 && !w.startsWith("\u001B[?25") && !w.startsWith("\u001B[?2026"));
  const lastContentWrite = writes.at(-1)!;
  const output = stripAnsi(lastContentWrite);
  expect(output, "Error label should be displayed").toContain("ERROR");
  expect(output, "Error message should be shown").toContain("Nested component error");
});

test("clean up raw mode when error is thrown", async () => {
  const stdout = createStdout();

  // Track setRawMode calls
  const setRawModeCalls: boolean[] = [];
  const originalSetRawMode = process.stdin.setRawMode?.bind(process.stdin);

  // Only run this test if raw mode is supported
  if (!process.stdin.isTTY) {
    expect(true, "Skipping test - stdin is not a TTY").toBe(true); // TODO: ported from t.fail()
    return;
  }

  process.stdin.setRawMode = (mode: boolean) => {
    setRawModeCalls.push(mode);

    return originalSetRawMode?.(mode) ?? process.stdin;
  };

  function Test() {
    const { setRawMode } = useStdin();

    useEffect(() => {
      setRawMode(true);
      // Throw after enabling raw mode
      throw new Error("Error after raw mode enabled");
    }, [setRawMode]);

    return <Text>Test</Text>;
  }

  const app = render(<Test />, { stdout });

  await expect(app.waitUntilExit()).rejects.toThrow();

  // Restore original setRawMode
  if (originalSetRawMode) {
    process.stdin.setRawMode = originalSetRawMode;
  }

  // Verify raw mode was enabled then disabled
  expect(setRawModeCalls, "Raw mode should have been enabled").toContain(true);
  expect(setRawModeCalls.includes(false), "Raw mode should have been disabled on cleanup").toBe(
    true,
  );
});

test("display thrown strings and reject waitUntilExit with the original message", async () => {
  const stdout = createStdout();

  function Test(): React.JSX.Element {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw "Unable to load configuration";
  }

  const app = render(<Test />, { stdout });
  onTestFinished(() => {
    app.unmount();
  });
  await expect(app.waitUntilExit()).rejects.toThrow("Unable to load configuration");

  const output = stripAnsi(stdout.getWrites().join(""));
  expect(output).toContain("ERROR");
  expect(output).toContain("Unable to load configuration");
});

test("display thrown undefined and reject waitUntilExit", async () => {
  const stdout = createStdout();

  function Test(): React.JSX.Element {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw undefined;
  }

  const app = render(<Test />, { stdout });
  onTestFinished(() => {
    app.unmount();
  });
  await expect(app.waitUntilExit()).rejects.toThrow("undefined");

  const output = stripAnsi(stdout.getWrites().join(""));
  expect(output).toContain("ERROR  undefined");
});

test("waitUntilExit preserves the original component error", async () => {
  const stdout = createStdout();
  const error = new Error("Original component error");

  function Test(): React.JSX.Element {
    throw error;
  }

  const app = render(<Test />, { stdout });
  onTestFinished(() => {
    app.unmount();
  });
  await expect(app.waitUntilExit()).rejects.toBe(error);
});

test("waitUntilExit preserves a component error from another realm", async () => {
  const stdout = createStdout();
  const error = vm.runInNewContext('new Error("Cross-realm component error")') as Error;

  function Test(): React.JSX.Element {
    throw error;
  }

  const app = render(<Test />, { stdout });
  onTestFinished(() => {
    app.unmount();
  });
  await expect(app.waitUntilExit()).rejects.toBe(error);
});
