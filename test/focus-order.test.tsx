import { expect, onTestFinished, test } from "vite-plus/test";

import { Box, Text, render, useFocus, useFocusManager } from "#/index.ts";

import { act } from "./helpers/act.ts";
import { createStdin, emitReadable } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

function Field({ id }: { readonly id: string }) {
  const { isFocused } = useFocus({ id });
  return <Text>{`${id}: ${isFocused ? "focused" : "blurred"}`}</Text>;
}

test("focus navigation keeps registration order after keyed reordering", async () => {
  const stdout = createStdout();
  const stdin = createStdin();
  let manager!: ReturnType<typeof useFocusManager>;

  function Form({ order }: { readonly order: string[] }) {
    manager = useFocusManager();
    return (
      <Box flexDirection="column">
        {order.map((id) => (
          <Field key={id} id={id} />
        ))}
      </Box>
    );
  }

  let instance!: ReturnType<typeof render>;
  await act(async () => {
    instance = render(<Form order={["a", "b", "c"]} />, {
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

  await act(async () => {
    instance.rerender(<Form order={["c", "a", "b"]} />);
  });
  expect(stdout.get()).toBe("c: blurred\na: blurred\nb: blurred");

  await act(async () => {
    emitReadable(stdin, "\t");
  });
  expect(manager.activeId).toBe("a");
});

async function renderDuplicates(ids: string[]) {
  const stdout = createStdout();
  const stdin = createStdin();
  let manager!: ReturnType<typeof useFocusManager>;

  function Form() {
    manager = useFocusManager();
    return (
      <Box flexDirection="column">
        {ids.map((id, index) => {
          const key = `${id}-${index}`;
          return <Field key={key} id={id} />;
        })}
      </Box>
    );
  }

  let instance!: ReturnType<typeof render>;
  await act(async () => {
    instance = render(<Form />, {
      stdout,
      stdin,
      debug: true,
      concurrent: true,
      patchConsole: false,
    });
  });

  const press = async (input: string, count: number) => {
    const activeIds: Array<string | undefined> = [];

    for (let index = 0; index < count; index++) {
      // eslint-disable-next-line no-await-in-loop -- Each keypress must commit before reading the active ID.
      await act(async () => {
        emitReadable(stdin, input);
      });
      activeIds.push(manager.activeId);
    }

    return activeIds;
  };

  return {
    stdout,
    instance,
    tab: async (count: number) => {
      return press("\t", count);
    },
    shiftTab: async (count: number) => {
      return press("\u{1B}[Z", count);
    },
  };
}

test("Tab visits a duplicated focus ID once and reaches the components after it", async () => {
  const { instance, stdout, tab, shiftTab } = await renderDuplicates(["a", "x", "x", "b"]);
  onTestFinished(async () => {
    await act(async () => {
      instance.unmount();
    });
  });

  expect(await tab(5)).toEqual(["a", "x", "b", "a", "x"]);
  expect(stdout.get()).toBe("a: blurred\nx: focused\nx: focused\nb: blurred");
  expect(await shiftTab(4)).toEqual(["a", "b", "x", "a"]);
});

test("Tab visits a non-adjacent duplicated focus ID at its first registration", async () => {
  const { instance, tab, shiftTab } = await renderDuplicates(["x", "a", "x", "b"]);
  onTestFinished(async () => {
    await act(async () => {
      instance.unmount();
    });
  });

  expect(await tab(4)).toEqual(["x", "a", "b", "x"]);
  expect(await shiftTab(4)).toEqual(["b", "a", "x", "b"]);
});
