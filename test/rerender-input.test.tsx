import { onTestFinished, expect, test, vi } from "vite-plus/test";

import { render, useInput, usePaste, Text } from "#/index.ts";

import { createStdin, emitReadable } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

test("rerender() keeps a pending Escape keypress", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });

  const stdin = createStdin();
  const stdout = createStdout();
  const keys: string[] = [];
  function Example({ label }: { readonly label: string }) {
    useInput((_input, key) => {
      keys.push(key.escape ? "escape" : "other");
    });
    return <Text>{label}</Text>;
  }

  const app = render(<Example label="a" />, { stdin, stdout, interactive: true });
  onTestFinished(() => {
    app.unmount();
  });
  emitReadable(stdin, "\u001B");
  app.rerender(<Example label="b" />);
  await vi.advanceTimersByTimeAsync(20);
  expect(keys).toEqual(["escape"]);
});

test("rerender() keeps an escape sequence that spans two reads", () => {
  const stdin = createStdin();
  const stdout = createStdout();
  const keys: Array<{ input: string; upArrow: boolean; shift: boolean }> = [];
  function Example({ label }: { readonly label: string }) {
    useInput((input, key) => {
      keys.push({ input, upArrow: key.upArrow, shift: key.shift });
    });
    return <Text>{label}</Text>;
  }

  const app = render(<Example label="a" />, { stdin, stdout, interactive: true });
  onTestFinished(() => {
    app.unmount();
  });
  emitReadable(stdin, "\u001B[");
  app.rerender(<Example label="b" />);
  emitReadable(stdin, "A");
  expect(keys).toEqual([{ input: "", upArrow: true, shift: false }]);
});

test("rerender() keeps a bracketed paste that spans two reads", () => {
  const stdin = createStdin();
  const stdout = createStdout();
  const inputs: string[] = [];
  const pastes: string[] = [];
  function Example({ label }: { readonly label: string }) {
    useInput((input) => {
      inputs.push(input);
    });
    usePaste((text) => {
      pastes.push(text);
    });
    return <Text>{label}</Text>;
  }

  const app = render(<Example label="a" />, { stdin, stdout, interactive: true });
  onTestFinished(() => {
    app.unmount();
  });
  emitReadable(stdin, "\u001B[200~part1");
  app.rerender(<Example label="b" />);
  emitReadable(stdin, "part2\u001B[201~");
  expect(pastes).toEqual(["part1part2"]);
  expect(inputs).toEqual([]);
});

test("rerender() does not detach and reattach the stdin readable listener", () => {
  const stdin = createStdin();
  const stdout = createStdout();
  let removed = 0;
  stdin.on("removeListener", (event) => {
    if (event === "readable") {
      removed++;
    }
  });

  function Example({ label }: { readonly label: string }) {
    useInput(() => {});
    return <Text>{label}</Text>;
  }

  const app = render(<Example label="a" />, { stdin, stdout, interactive: true });
  onTestFinished(() => {
    app.unmount();
  });
  app.rerender(<Example label="b" />);
  expect(removed).toBe(0);
});
