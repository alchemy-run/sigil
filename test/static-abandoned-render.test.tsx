import React, { Suspense, startTransition } from "react";
import { expect, onTestFinished, test } from "vite-plus/test";

import { render, Static, Text } from "#/index.ts";

import { act } from "./helpers/act.ts";
import { createStdin } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

const never = new Promise<never>(() => {});

function Pending(): React.ReactNode {
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw never;
}

function App({ pending, items }: { readonly pending: boolean; readonly items: string[] }) {
  return (
    <Suspense fallback={<Text>Loading</Text>}>
      <Static key={pending ? "replacement" : "original"} items={items}>
        {(item) => <Text key={item}>{item}</Text>}
      </Static>
      {pending ? <Pending /> : <Text>Live</Text>}
    </Suspense>
  );
}

test("abandoned transition render does not replace committed Static", async () => {
  const stdout = createStdout();
  const stdin = createStdin();

  let instance!: ReturnType<typeof render>;
  await act(async () => {
    instance = render(<App pending={false} items={["first"]} />, {
      stdout,
      stdin,
      debug: true,
      concurrent: true,
      patchConsole: false,
    });
  });
  onTestFinished(async () => {
    await act(async () => {
      instance.unmount();
    });
  });

  expect(stdout.get()).toBe("first\nLive");

  // Start a transition that suspends with a keyed <Static> replacement, then
  // abandon it by committing a normal update without that replacement.
  await act(async () => {
    startTransition(() => {
      instance.rerender(<App pending items={["abandoned"]} />);
    });
  });

  await act(async () => {
    instance.rerender(<App pending={false} items={["first", "second"]} />);
  });

  expect(stdout.get()).toBe("first\nsecond\nLive");
});
