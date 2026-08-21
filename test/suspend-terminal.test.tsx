import React, { useEffect } from "react";
import { expect, test } from "vite-plus/test";

import stripAnsi from "../src/ansi/strip.ts";
import { type SuspendTerminal } from "../src/components/AppContext.ts";
import { render, useApp, useInput, useStdout, Text } from "../src/index.ts";
import { createStdin, type FakeStdin } from "./helpers/create-stdin.ts";
import createStdout, { type FakeStdout } from "./helpers/create-stdout.ts";
import term from "./helpers/term.ts";

const showCursor = "[?25h";
const hideCursor = "[?25l";
const enterAltScreen = "[?1049h";
const exitAltScreen = "[?1049l";

const delay = async (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const lastSetRawModeArg = (stdin: FakeStdin): boolean | undefined =>
  stdin.setRawMode.mock.lastCall?.[0];

// Renders an interactive app (raw mode on via useInput) and runs `run` with the
// app's suspendTerminal once mounted. Resolves after `run` settles.
const renderWithSuspend = async (
  run: (suspendTerminal: SuspendTerminal, stdin: FakeStdin) => Promise<void>,
): Promise<{ stdout: FakeStdout; stdin: FakeStdin }> => {
  const stdout = createStdout();
  const stdin = createStdin();

  let finished!: () => void;
  const done = new Promise<void>((resolve) => {
    finished = resolve;
  });

  function Example() {
    const { suspendTerminal } = useApp();
    useInput(() => {});

    useEffect(() => {
      void (async () => {
        try {
          await run(suspendTerminal, stdin);
        } finally {
          finished();
        }
      })();
    }, [suspendTerminal]);

    return <Text>hello</Text>;
  }

  const { unmount } = render(<Example />, { stdout, stdin, interactive: true });
  await done;
  await delay(50);
  unmount();

  return { stdout, stdin };
};

// Note: raw mode is captured inside the run callback (before the harness
// unmounts), because unmount's cleanup disables raw mode and would otherwise be
// the last recorded setRawMode call.
test("suspendTerminal hands the terminal to the callback, then restores Ink", async () => {
  let ranInsideCallback = false;
  let rawModeDuringCallback: boolean | undefined;
  let rawModeAfterCallback: boolean | undefined;

  const { stdout } = await renderWithSuspend(async (suspendTerminal, stdin) => {
    await suspendTerminal(async () => {
      ranInsideCallback = true;
      rawModeDuringCallback = lastSetRawModeArg(stdin);
    });
    rawModeAfterCallback = lastSetRawModeArg(stdin);
  });

  expect(ranInsideCallback).toBe(true);
  // Raw mode disabled for the child, re-enabled once Ink reclaimed the terminal.
  expect(rawModeDuringCallback).toBe(false);
  expect(rawModeAfterCallback).toBe(true);
  // Cursor shown for the child, then hidden again by the forced redraw.
  expect(stdout.getWrites().some((write) => write.includes(showCursor))).toBe(true);
  expect(stdout.getWrites().some((write) => write.includes(hideCursor))).toBe(true);
});

test("suspendTerminal restores the terminal even if the callback throws", async () => {
  let threw = false;
  let rawModeAfterThrow: boolean | undefined;

  await renderWithSuspend(async (suspendTerminal, stdin) => {
    try {
      await suspendTerminal(async () => {
        throw new Error("boom");
      });
    } catch {
      threw = true;
    }

    rawModeAfterThrow = lastSetRawModeArg(stdin);
  });

  expect(threw).toBe(true);
  // Raw mode was reclaimed despite the throw.
  expect(rawModeAfterThrow).toBe(true);
});

test("suspendTerminal returns a disposable that resumes on resume()", async () => {
  let rawModeWhileSuspended: boolean | undefined;
  let rawModeAfterResume: boolean | undefined;

  await renderWithSuspend(async (suspendTerminal, stdin) => {
    const suspension = await suspendTerminal();
    rawModeWhileSuspended = lastSetRawModeArg(stdin);
    await suspension.resume();
    rawModeAfterResume = lastSetRawModeArg(stdin);
  });

  expect(rawModeWhileSuspended).toBe(false);
  expect(rawModeAfterResume).toBe(true);
});

test("suspendTerminal disposable resumes via Symbol.asyncDispose", async () => {
  let rawModeWhileSuspended: boolean | undefined;
  let rawModeAfterDispose: boolean | undefined;

  await renderWithSuspend(async (suspendTerminal, stdin) => {
    const suspension = await suspendTerminal();
    rawModeWhileSuspended = lastSetRawModeArg(stdin);
    await suspension[Symbol.asyncDispose]();
    rawModeAfterDispose = lastSetRawModeArg(stdin);
  });

  expect(rawModeWhileSuspended).toBe(false);
  expect(rawModeAfterDispose).toBe(true);
});

test("suspendTerminal keeps Ink off the terminal while suspended", async () => {
  const stdout = createStdout();
  const stdin = createStdin();

  let writesDuringSuspend: number | undefined;

  let finished!: () => void;
  const done = new Promise<void>((resolve) => {
    finished = resolve;
  });

  function Example() {
    const { suspendTerminal } = useApp();
    const { write } = useStdout();
    useInput(() => {});

    useEffect(() => {
      void (async () => {
        try {
          await suspendTerminal(async () => {
            const before = stdout.getWrites().length;
            // A write through Ink's stdout context while suspended must be a
            // no-op so it cannot corrupt the child process's screen.
            write("output while suspended");
            writesDuringSuspend = stdout.getWrites().length - before;
          });
        } finally {
          finished();
        }
      })();
    }, [suspendTerminal, write]);

    return <Text>hello</Text>;
  }

  const { unmount } = render(<Example />, { stdout, stdin, interactive: true });
  await done;
  await delay(50);
  unmount();

  expect(writesDuringSuspend).toBe(0);
});

test("suspendTerminal runs the callback but skips the handoff when not interactive", async () => {
  const stdout = createStdout();
  const stdin = createStdin();

  let ranCallback = false;

  let finished!: () => void;
  const done = new Promise<void>((resolve) => {
    finished = resolve;
  });

  function Example() {
    const { suspendTerminal } = useApp();

    useEffect(() => {
      void (async () => {
        try {
          await suspendTerminal(async () => {
            ranCallback = true;
          });
        } finally {
          finished();
        }
      })();
    }, [suspendTerminal]);

    return <Text>hello</Text>;
  }

  const { unmount } = render(<Example />, { stdout, stdin, interactive: false });
  await done;
  await delay(20);
  unmount();

  // The callback still runs, but Ink performs no terminal handoff (no cursor
  // reveal) in non-interactive mode.
  expect(ranCallback).toBe(true);
  expect(stdout.getWrites().some((write) => write.includes(showCursor))).toBe(false);
});

test("suspendTerminal rejects a nested suspend while already suspended", async () => {
  let nestedRejected = false;

  await renderWithSuspend(async (suspendTerminal) => {
    await suspendTerminal(async () => {
      await expect(suspendTerminal(async () => {})).rejects.toThrow();
      nestedRejected = true;
    });
  });

  expect(nestedRejected).toBe(true);
});

test("suspendTerminal hands the terminal to a child process, then redraws (PTY)", async () => {
  const ps = term("suspend-terminal");
  await ps.waitForExit();

  const { output } = ps;

  // The child process wrote directly to the terminal during suspension.
  expect(output.includes("CHILD_OUTPUT")).toBe(true);
  // Ink showed the cursor when handing the terminal over.
  expect(output.includes(showCursor)).toBe(true);
  // Ink reclaimed the terminal and repainted its frame after the child output,
  // re-hiding the cursor as part of the redraw.
  const afterChild = output.slice(output.lastIndexOf("CHILD_OUTPUT") + "CHILD_OUTPUT".length);
  expect(stripAnsi(afterChild).includes("Ink frame")).toBe(true);
  expect(afterChild.includes(hideCursor)).toBe(true);
});

test("suspendTerminal exits and re-enters the alternate screen", async () => {
  const stdout = createStdout();
  const stdin = createStdin();

  let exitedAltDuringSuspend: boolean | undefined;
  let reEnteredAltAfterResume: boolean | undefined;

  let finished!: () => void;
  const done = new Promise<void>((resolve) => {
    finished = resolve;
  });

  function Example() {
    const { suspendTerminal } = useApp();
    useInput(() => {});

    useEffect(() => {
      void (async () => {
        try {
          let writesAtCallbackEnd = 0;
          await suspendTerminal(async () => {
            exitedAltDuringSuspend = stdout
              .getWrites()
              .some((write) => write.includes(exitAltScreen));
            writesAtCallbackEnd = stdout.getWrites().length;
          });
          reEnteredAltAfterResume = stdout
            .getWrites()
            .slice(writesAtCallbackEnd)
            .some((write) => write.includes(enterAltScreen));
        } finally {
          finished();
        }
      })();
    }, [suspendTerminal]);

    return <Text>hello</Text>;
  }

  const { unmount } = render(<Example />, {
    stdout,
    stdin,
    alternateScreen: true,
    interactive: true,
  });
  await done;
  await delay(50);
  unmount();

  expect(exitedAltDuringSuspend).toBe(true);
  expect(reEnteredAltAfterResume).toBe(true);
});

test("suspendTerminal rolls back so a later suspend works if handover throws", async () => {
  let firstRejected = false;
  let secondSucceeded = false;

  await renderWithSuspend(async (suspendTerminal, stdin) => {
    const rawModeController = stdin as unknown as {
      setRawMode: (value: boolean) => unknown;
    };
    const originalSetRawMode = rawModeController.setRawMode;
    // Force the pause's setRawMode(false) to throw so beginSuspend's rollback runs.
    rawModeController.setRawMode = (value: boolean) => {
      if (!value) {
        throw new Error("handover boom");
      }

      return stdin;
    };

    try {
      await suspendTerminal(async () => {});
    } catch {
      firstRejected = true;
    }

    // Stop throwing; the app must not be stuck in a suspended state.
    rawModeController.setRawMode = originalSetRawMode;

    try {
      await suspendTerminal(async () => {});
      secondSucceeded = true;
    } catch {}
  });

  expect(firstRejected).toBe(true);
  expect(secondSucceeded).toBe(true);
});
