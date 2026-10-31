import { Box, Text, render } from "@alchemy.run/sigil";

// `SIGIL_SCREEN_READER` is read once when Sigil loads, so each case runs in its
// own process. The first argument overrides the option: "true", "false", or
// omitted.
const option = process.argv[2];

const instance = render(
  <Box aria-label="Hello World">
    <Text>Not visible to screen readers</Text>
  </Box>,
  {
    interactive: false,
    patchConsole: false,
    ...(option === undefined ? {} : { isScreenReaderEnabled: option === "true" }),
  },
);
instance.unmount();
await instance.waitUntilExit();
