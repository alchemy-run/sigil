import { useLayoutEffect } from "react";
import { expect, test } from "vite-plus/test";

import { type SuspendTerminal } from "#/components/AppContext.ts";
import { render, useApp, useStdout, useStderr, Text } from "#/index.ts";

import { createStdin } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

test("non-interactive suspension keeps the latest rendered frame", async () => {
  const stdout = createStdout();
  let suspendTerminal!: SuspendTerminal;

  function Example({ text }: { readonly text: string }) {
    const app = useApp();
    useLayoutEffect(() => {
      suspendTerminal = app.suspendTerminal;
    }, [app.suspendTerminal]);
    return <Text>{text}</Text>;
  }

  const instance = render(<Example text="before" />, {
    stdout,
    stdin: createStdin(),
    interactive: false,
    patchConsole: false,
  });

  try {
    await instance.waitUntilRenderFlush();
    await suspendTerminal(async () => {
      instance.rerender(<Example text="after" />);
      await instance.waitUntilRenderFlush();
    });
    instance.unmount();
    await instance.waitUntilExit();
    expect(stdout.get()).toBe("after\n");
  } finally {
    instance.unmount();
  }
});

for (const stream of ["stdout", "stderr"] as const) {
  test(`non-interactive suspension preserves ${stream} writes`, async () => {
    const stdout = createStdout();
    const stderr = createStdout();
    let suspendTerminal!: SuspendTerminal;
    let write!: (text: string) => void;

    function Example() {
      const app = useApp();
      const output = useStdout();
      const error = useStderr();
      useLayoutEffect(() => {
        suspendTerminal = app.suspendTerminal;
        write = stream === "stdout" ? output.write : error.write;
      }, [app.suspendTerminal, output.write, error.write]);
      return <Text>frame</Text>;
    }

    const instance = render(<Example />, {
      stdout,
      stderr,
      stdin: createStdin(),
      interactive: false,
      patchConsole: false,
    });

    try {
      await instance.waitUntilRenderFlush();
      await suspendTerminal(async () => {
        write("child result\n");
      });
      expect((stream === "stdout" ? stdout : stderr).getWrites()).toContain("child result\n");
    } finally {
      instance.unmount();
    }
  });
}
