import { useEffect } from "react";
import { expect, onTestFinished, test } from "vite-plus/test";

import { render, useApp, useInput, usePaste } from "#/index.ts";

import { act } from "./helpers/act.ts";
import { createStdin, emitReadable, type FakeStdin } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

const setRawModeArgs = (stdin: FakeStdin): boolean[] =>
  stdin.setRawMode.mock.calls.map((args) => args[0]);

test("resuming does not enable raw mode for a disabled input hook", async () => {
  const stdin = createStdin();
  let app!: ReturnType<typeof useApp>;
  function Example({ isActive }: { readonly isActive: boolean }) {
    app = useApp();
    useInput(() => {}, { isActive });
    return null;
  }

  let instance!: ReturnType<typeof render>;
  await act(async () => {
    instance = render(<Example isActive />, {
      stdin,
      stdout: createStdout(),
      interactive: true,
      patchConsole: false,
    });
  });
  onTestFinished(() => {
    instance.unmount();
  });
  const suspension = await app.suspendTerminal();
  const callCount = setRawModeArgs(stdin).length;
  await act(async () => {
    instance.rerender(<Example isActive={false} />);
  });
  await suspension.resume();

  expect(setRawModeArgs(stdin).slice(callCount)).toEqual([]);
  expect(stdin.listenerCount("readable")).toBe(0);
});

for (const shouldKeepInput of [false, true]) {
  test(`resuming does not restore disabled bracketed paste (other input active: ${shouldKeepInput})`, async () => {
    const stdin = createStdin();
    const stdout = createStdout();
    let app!: ReturnType<typeof useApp>;
    function Example({ isActive }: { readonly isActive: boolean }) {
      app = useApp();
      usePaste(() => {}, { isActive });
      useInput(() => {}, { isActive: shouldKeepInput });
      return null;
    }

    let instance!: ReturnType<typeof render>;
    await act(async () => {
      instance = render(<Example isActive />, {
        stdin,
        stdout,
        interactive: true,
        patchConsole: false,
      });
    });
    onTestFinished(() => {
      instance.unmount();
    });
    const suspension = await app.suspendTerminal();
    const writeCount = stdout.getWrites().length;
    await act(async () => {
      instance.rerender(<Example isActive={false} />);
    });
    await suspension.resume();

    expect(stdout.getWrites().slice(writeCount).join("").includes("[?2004")).toBe(false);
    expect(stdin.setRawMode.mock.lastCall?.[0]).toBe(shouldKeepInput);
    expect(stdin.listenerCount("readable")).toBe(shouldKeepInput ? 1 : 0);
  });
}

test("resuming enables raw mode for an input hook activated while suspended", async () => {
  const stdin = createStdin();
  let app!: ReturnType<typeof useApp>;
  function Example({ isActive }: { readonly isActive: boolean }) {
    app = useApp();
    useInput(() => {}, { isActive });
    return null;
  }

  let instance!: ReturnType<typeof render>;
  await act(async () => {
    instance = render(<Example isActive={false} />, {
      stdin,
      stdout: createStdout(),
      interactive: true,
      patchConsole: false,
    });
  });
  onTestFinished(() => {
    instance.unmount();
  });
  const suspension = await app.suspendTerminal();
  await act(async () => {
    instance.rerender(<Example isActive />);
  });
  await suspension.resume();

  expect(stdin.setRawMode.mock.lastCall?.[0]).toBe(true);
  expect(stdin.listenerCount("readable")).toBe(1);
});

test("an input hook activated while suspended does not take input until resume", async () => {
  const stdin = createStdin();
  let app!: ReturnType<typeof useApp>;
  const inputs: string[] = [];
  function Example({ isActive }: { readonly isActive: boolean }) {
    app = useApp();
    useInput(
      (input) => {
        inputs.push(input);
      },
      { isActive },
    );
    return null;
  }

  let instance!: ReturnType<typeof render>;
  await act(async () => {
    instance = render(<Example isActive={false} />, {
      stdin,
      stdout: createStdout(),
      interactive: true,
      patchConsole: false,
    });
  });
  onTestFinished(() => {
    instance.unmount();
  });
  const suspension = await app.suspendTerminal();
  const callCount = setRawModeArgs(stdin).length;
  await act(async () => {
    instance.rerender(<Example isActive />);
  });

  expect(setRawModeArgs(stdin).slice(callCount)).toEqual([]);
  expect(stdin.listenerCount("readable")).toBe(0);
  emitReadable(stdin, "x");
  expect(inputs).toEqual([]);

  await suspension.resume();

  expect(setRawModeArgs(stdin).slice(callCount)).toEqual([true]);
  expect(stdin.listenerCount("readable")).toBe(1);
  emitReadable(stdin, "y");
  expect(inputs).toEqual(["y"]);
});

test("a paste hook activated while suspended does not enable bracketed paste until resume", async () => {
  const stdin = createStdin();
  const stdout = createStdout();
  let app!: ReturnType<typeof useApp>;
  function Example({ isActive }: { readonly isActive: boolean }) {
    app = useApp();
    usePaste(() => {}, { isActive });
    return null;
  }

  let instance!: ReturnType<typeof render>;
  await act(async () => {
    instance = render(<Example isActive={false} />, {
      stdin,
      stdout,
      interactive: true,
      patchConsole: false,
    });
  });
  onTestFinished(() => {
    instance.unmount();
  });
  const suspension = await app.suspendTerminal();
  const callCount = setRawModeArgs(stdin).length;
  const writeCount = stdout.getWrites().length;
  const pasteEnableCount = () =>
    stdout
      .getWrites()
      .slice(writeCount)
      .filter((write) => write.includes("\u{1B}[?2004h")).length;

  await act(async () => {
    instance.rerender(<Example isActive />);
  });

  expect(pasteEnableCount()).toBe(0);
  expect(setRawModeArgs(stdin).slice(callCount)).toEqual([]);
  expect(stdin.listenerCount("readable")).toBe(0);

  await suspension.resume();

  expect(pasteEnableCount()).toBe(1);
  expect(setRawModeArgs(stdin).slice(callCount)).toEqual([true]);
  expect(stdin.listenerCount("readable")).toBe(1);
});

test("suspending in the same commit that disables the last input hook disables raw mode before the callback runs", async () => {
  const stdin = createStdin();
  const log: string[] = [];
  stdin.setRawMode.mockImplementation((isEnabled: boolean) => {
    log.push(`setRawMode(${isEnabled})`);
  });

  let resume!: () => void;
  function Input() {
    useInput(() => {});
    return null;
  }

  function Example({ suspended }: { readonly suspended: boolean }) {
    const app = useApp();
    useEffect(() => {
      if (!suspended) {
        return;
      }

      void app.suspendTerminal(async () => {
        log.push("callback start");
        const { promise, resolve } = Promise.withResolvers<void>();
        resume = resolve;
        await promise;
      });
    }, [suspended, app]);
    return suspended ? null : <Input />;
  }

  let instance!: ReturnType<typeof render>;
  await act(async () => {
    instance = render(<Example suspended={false} />, {
      stdin,
      stdout: createStdout(),
      interactive: true,
      patchConsole: false,
    });
  });
  onTestFinished(() => {
    instance.unmount();
  });
  log.length = 0;

  await act(async () => {
    instance.rerender(<Example suspended />);
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

  expect(log).toEqual(["setRawMode(false)", "callback start"]);
  expect(stdin.listenerCount("readable")).toBe(0);

  resume();
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

  expect(log).toEqual(["setRawMode(false)", "callback start"]);
  expect(stdin.listenerCount("readable")).toBe(0);
});
