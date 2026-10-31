import { expect, onTestFinished, test } from "vite-plus/test";

import { Box, Text, render, useFocus, useFocusManager } from "#/index.ts";

import { act } from "./helpers/act.ts";
import { createStdin, emitReadable } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

function Field({ id, autoFocus = false }: { readonly id: string; readonly autoFocus?: boolean }) {
  const { isFocused } = useFocus({ id, autoFocus });

  return <Text>{`${id === "" ? "empty" : id}: ${isFocused ? "focused" : "blurred"}`}</Text>;
}

for (const method of ["programmatic", "tab"] as const) {
  test(`empty focus ID reports focus after ${method} navigation`, async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    let manager!: ReturnType<typeof useFocusManager>;

    function Form() {
      manager = useFocusManager();
      return <Field id="" />;
    }

    let instance!: ReturnType<typeof render>;
    await act(async () => {
      instance = render(<Form />, {
        stdout,
        stdin,
        debug: true,
        concurrent: true,
      });
    });
    onTestFinished(async () => {
      await act(async () => {
        instance.unmount();
      });
    });
    expect(stdout.get()).toBe("empty: blurred");

    await act(async () => {
      if (method === "programmatic") {
        manager.focus("");
      } else {
        emitReadable(stdin, "\t");
      }
    });

    expect(manager.activeId).toBe("");
    expect(stdout.get()).toBe("empty: focused");
  });
}

test("autofocus does not replace an already focused empty ID", async () => {
  const stdout = createStdout();
  const stdin = createStdin();
  let activeId: string | undefined;

  function Form() {
    ({ activeId } = useFocusManager());
    return (
      <Box flexDirection="column">
        <Field autoFocus id="" />
        <Field autoFocus id="second" />
      </Box>
    );
  }

  let instance!: ReturnType<typeof render>;
  await act(async () => {
    instance = render(<Form />, { stdout, stdin, debug: true, concurrent: true });
  });
  onTestFinished(async () => {
    await act(async () => {
      instance.unmount();
    });
  });

  expect(activeId).toBe("");
  expect(stdout.get()).toBe("empty: focused\nsecond: blurred");
});
