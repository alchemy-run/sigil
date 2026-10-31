import { expect, test } from "vite-plus/test";

import { render, Text } from "#/index.ts";

import createStdout from "./helpers/create-stdout.ts";

for (const mode of [{}, { debug: true }, { isScreenReaderEnabled: true }]) {
  test(`onRender observes the committed frame (${JSON.stringify(mode)})`, async () => {
    const stdout = createStdout();
    const observedFrames: string[] = [];
    const instance = render(<Text>first</Text>, {
      stdout,
      interactive: true,
      patchConsole: false,
      ...mode,
      onRender() {
        observedFrames.push(stdout.getWrites().join(""));
      },
    });

    try {
      await instance.waitUntilRenderFlush();
      expect(observedFrames[0]).toContain("first");

      instance.rerender(<Text>second</Text>);
      await instance.waitUntilRenderFlush();
      expect(observedFrames.at(-1)).toContain("second");
    } finally {
      instance.unmount();
    }
  });
}
