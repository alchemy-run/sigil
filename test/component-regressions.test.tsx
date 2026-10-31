import { afterEach, expect, test } from "vite-plus/test";

import { Box, Text, Transform, render, type Instance } from "#/index.ts";

import { act } from "./helpers/act.ts";
import createStdout from "./helpers/create-stdout.ts";

let instance: Instance | undefined;

afterEach(async () => {
  await act(async () => {
    instance?.unmount();
  });
  instance = undefined;
});

for (const concurrent of [false, true]) {
  for (const nested of [false, true]) {
    test(`changing nested transform wrap points updates layout (concurrent: ${concurrent}, deeply nested: ${nested})`, async () => {
      function Example({ replaceSpaces }: { readonly replaceSpaces: boolean }) {
        const content = (
          <Transform transform={(text) => (replaceSpaces ? text.replaceAll(" ", "x") : text)}>
            <Text>ab cd ef</Text>
          </Transform>
        );

        return (
          <Box flexDirection="column" width={4}>
            <Text>{nested ? <Text>{content}</Text> : content}</Text>
            <Text>!</Text>
          </Box>
        );
      }

      const stdout = createStdout();
      await act(async () => {
        instance = render(<Example replaceSpaces={false} />, {
          stdout,
          debug: true,
          concurrent,
        });
      });
      expect(stdout.get()).toBe("ab\ncd\nef\n!");

      // Both strings have eight columns. Only the word boundaries change.
      await act(async () => {
        instance!.rerender(<Example replaceSpaces />);
      });
      expect(stdout.get()).toBe("abxc\ndxef\n!");

      await act(async () => {
        instance!.rerender(<Example replaceSpaces={false} />);
      });
      expect(stdout.get()).toBe("ab\ncd\nef\n!");
    });
  }
}
