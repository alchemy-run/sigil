import { useLayoutEffect } from "react";
import { expect, test } from "vite-plus/test";

import { type SuspendTerminal } from "#/components/AppContext.ts";
import { render, Text, useApp, useInput } from "#/index.ts";

import { createStdin } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

for (const callback of [false, true]) {
  test(`resuming after unmount does not re-enable terminal input (callback: ${callback})`, async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    let suspendTerminal!: SuspendTerminal;

    function Example() {
      const app = useApp();
      useInput(() => {});
      useLayoutEffect(() => {
        suspendTerminal = app.suspendTerminal;
      }, [app.suspendTerminal]);
      return <Text>hello</Text>;
    }

    const instance = render(<Example />, { stdout, stdin, interactive: true, patchConsole: false });

    try {
      await instance.waitUntilRenderFlush();
      if (callback) {
        await suspendTerminal(async () => {
          instance.unmount();
          await instance.waitUntilExit();
        });
      } else {
        const suspension = await suspendTerminal();
        instance.unmount();
        await instance.waitUntilExit();
        await suspension.resume();
      }

      expect(stdin.setRawMode.mock.lastCall?.[0]).toBe(false);
      expect(stdin.listenerCount("readable")).toBe(0);
    } finally {
      instance.unmount();
    }
  });
}
