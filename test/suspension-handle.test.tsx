import { useLayoutEffect } from "react";
import { expect, test } from "vite-plus/test";

import { type SuspendTerminal } from "#/components/AppContext.ts";
import { render, Text, useApp, useInput } from "#/index.ts";

import { createStdin } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

for (const disposeFirst of [false, true]) {
  test(`an old suspension cannot resume a later suspension (dispose first: ${disposeFirst})`, async () => {
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
      const first = await suspendTerminal();
      await (disposeFirst ? first[Symbol.asyncDispose]() : first.resume());
      const second = await suspendTerminal();
      await first.resume();
      await first[Symbol.asyncDispose]();
      expect(stdin.setRawMode.mock.lastCall?.[0]).toBe(false);
      await second.resume();
      expect(stdin.setRawMode.mock.lastCall?.[0]).toBe(true);
    } finally {
      instance.unmount();
    }
  });
}
