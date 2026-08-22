import { render, type Instance } from "#/index.ts";

import { act } from "./act.ts";
import createStdout from "./create-stdout.ts";

type TestRenderOptions = {
  columns?: number;
  isScreenReaderEnabled?: boolean;
};

export type TestInstance = Instance & {
  stdout: ReturnType<typeof createStdout>;
  getOutput: () => string;
  rerenderAsync: (node: React.ReactNode) => Promise<void>;
};

/**
Render helper that supports concurrent mode with `act()` wrapping.

Uses `act()` to properly flush updates in concurrent mode.
*/
export async function renderAsync(
  node: React.ReactNode,
  options: TestRenderOptions = {},
): Promise<TestInstance> {
  const stdout = createStdout(options.columns ?? 100);

  let instance!: Instance;

  await act(async () => {
    instance = render(node, {
      stdout,
      debug: true,
      concurrent: true,
      isScreenReaderEnabled: options.isScreenReaderEnabled,
    });
  });

  return {
    ...instance,
    stdout,
    getOutput: () => stdout.get(),
    async rerenderAsync(newNode: React.ReactNode) {
      await act(async () => {
        instance.rerender(newNode);
      });
    },
  };
}

/**
Synchronous render for legacy mode tests (backward compatible).
*/
export function renderSync(node: React.ReactNode, options: TestRenderOptions = {}): TestInstance {
  const stdout = createStdout(options.columns ?? 100);

  const instance = render(node, {
    stdout,
    debug: true,
    concurrent: false,
    isScreenReaderEnabled: options.isScreenReaderEnabled,
  });

  return {
    ...instance,
    stdout,
    getOutput: () => stdout.get(),
    async rerenderAsync(newNode: React.ReactNode) {
      instance.rerender(newNode);
    },
  };
}
