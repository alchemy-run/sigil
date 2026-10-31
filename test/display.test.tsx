import { expect, test } from "vite-plus/test";

import { Box, Text, render } from "#/index.ts";

import createStdout from "./helpers/create-stdout.ts";
import { renderToString, renderToStringAsync } from "./helpers/render-to-string.ts";

test("display flex", () => {
  const output = renderToString(
    <Box display="flex">
      <Text>X</Text>
    </Box>,
  );
  expect(output).toBe("X");
});

test("display none", () => {
  const output = renderToString(
    <Box flexDirection="column">
      <Box display="none">
        <Text>Kitty!</Text>
      </Box>
      <Text>Doggo</Text>
    </Box>,
  );

  expect(output).toBe("Doggo");
});

// Concurrent mode tests
test("display flex - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box display="flex">
      <Text>X</Text>
    </Box>,
  );
  expect(output).toBe("X");
});

test("display none - concurrent", async () => {
  const output = await renderToStringAsync(
    <Box flexDirection="column">
      <Box display="none">
        <Text>Kitty!</Text>
      </Box>
      <Text>Doggo</Text>
    </Box>,
  );

  expect(output).toBe("Doggo");
});

for (const initialDisplay of ["none", "flex"] as const) {
  test(`removing display="${initialDisplay}" restores the default layout`, () => {
    function Example({ display }: { readonly display?: "none" | "flex" }) {
      return (
        <Box>
          <Box display={display}>
            <Text>Cat</Text>
          </Box>
          <Text>Dog</Text>
        </Box>
      );
    }

    const stdout = createStdout();
    const { rerender, unmount } = render(<Example display={initialDisplay} />, {
      stdout,
      debug: true,
    });

    expect(stdout.get()).toBe(initialDisplay === "none" ? "Dog" : "CatDog");
    rerender(<Example />);
    expect(stdout.get()).toBe("CatDog");
    unmount();
  });
}
