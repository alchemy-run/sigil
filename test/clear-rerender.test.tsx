import { useReducer } from "react";
import { expect, test } from "vite-plus/test";

import { Text, render } from "#/index.ts";

import { act } from "./helpers/act.ts";
import createStdout, { type FakeStdout } from "./helpers/create-stdout.ts";
import { reconstructTerminalLines } from "./helpers/reconstruct-terminal.ts";

let rerenderHello: () => void;
function Hello() {
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  rerenderHello = rerender;
  return <Text>Hello</Text>;
}

const triggers = {
  rerender(instance: ReturnType<typeof render>) {
    instance.rerender(<Hello />);
  },
  "state update"() {
    rerenderHello();
  },
};

const visibleLines = (stdout: FakeStdout): string[] =>
  reconstructTerminalLines(stdout.getWrites().join("").replaceAll("\n", "\r\n"), 8);

for (const mode of ["standard", "screen-reader"] as const) {
  for (const [trigger, update] of Object.entries(triggers)) {
    test(`${trigger} restores unchanged content after clear (${mode})`, async () => {
      const stdout = createStdout(80, true, 8);
      let instance!: ReturnType<typeof render>;
      await act(async () => {
        instance = render(<Hello />, {
          stdout,
          interactive: true,
          isScreenReaderEnabled: mode === "screen-reader",
          patchConsole: false,
        });
      });

      try {
        await instance.waitUntilRenderFlush();
        instance.clear();
        await act(async () => {
          update(instance);
        });
        await instance.waitUntilRenderFlush();

        expect(visibleLines(stdout)[0]).toBe("Hello");
      } finally {
        instance.unmount();
      }
    });
  }

  test(`unmount does not restore cleared content (${mode})`, async () => {
    const stdout = createStdout(80, true, 8);
    const instance = render(<Text>Hello</Text>, {
      stdout,
      interactive: true,
      isScreenReaderEnabled: mode === "screen-reader",
      patchConsole: false,
    });

    try {
      await instance.waitUntilRenderFlush();
      instance.clear();
      instance.unmount();
      await instance.waitUntilExit();

      expect(visibleLines(stdout).every((line) => line === "")).toBe(true);
    } finally {
      instance.unmount();
    }
  });

  test(`console output does not restore cleared content (${mode})`, async () => {
    const stdout = createStdout(80, true, 8);
    const instance = render(<Text>Hello</Text>, {
      stdout,
      interactive: true,
      isScreenReaderEnabled: mode === "screen-reader",
      stderr: createStdout(80, true),
      patchConsole: true,
    });

    try {
      await instance.waitUntilRenderFlush();
      instance.clear();
      console.log("Log");
      console.error("Error");

      expect(visibleLines(stdout).filter((line) => line !== "")).toEqual(["Log"]);
    } finally {
      instance.unmount();
    }
  });
}
