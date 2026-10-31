import { expect, onTestFinished, test } from "vite-plus/test";

import { Box, Text, render, renderToString } from "#/index.ts";
import { type Styles } from "#/styles.ts";

import createStdout from "./helpers/create-stdout.ts";

const cases: Array<[string, Styles, Styles]> = [
  ["column gap override removal", { gap: 2, columnGap: 4 }, { gap: 2 }],
  ["row gap override removal", { gap: 2, rowGap: 4 }, { gap: 2 }],
  ["gap removal", { gap: 3 }, {}],
  ["position offset removal", { position: "relative", left: 2, top: 1 }, {}],
  ["absolute to flow", { position: "absolute", left: 2, top: 1 }, {}],
  ["border removal", { borderStyle: "single" }, {}],
  [
    "border side restoration",
    { borderStyle: "single", borderLeft: false },
    { borderStyle: "single" },
  ],
  ["alignSelf removal", { alignSelf: "flex-end" }, {}],
  ["flexBasis removal", { flexBasis: 12 }, {}],
  ["maxHeight removal", { maxHeight: 1 }, {}],
  ["height removal", { height: 4 }, {}],
  ["width removal", { width: 12 }, {}],
  ["minWidth removal", { minWidth: 12 }, {}],
  ["maxWidth removal", { maxWidth: 4 }, {}],
  ["aspectRatio removal", { aspectRatio: 2, width: 12 }, { width: 12 }],
];

for (const [name, before, after] of cases) {
  test(`rerender matches fresh layout after ${name}`, async () => {
    const view = (style: Styles) => (
      <Box width={30} height={12} flexDirection="column">
        <Box {...style}>
          <Text>Alpha</Text>
          <Text>Beta</Text>
        </Box>
        <Text>End</Text>
      </Box>
    );
    const stdout = createStdout(30);
    const instance = render(view(before), {
      stdout,
      debug: true,
      patchConsole: false,
    });
    onTestFinished(() => {
      instance.unmount();
    });
    await instance.waitUntilRenderFlush();
    instance.rerender(view(after));
    await instance.waitUntilRenderFlush();

    expect(stdout.get()).toBe(renderToString(view(after), { columns: 30 }));
  });
}
