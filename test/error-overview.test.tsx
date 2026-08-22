import { expect, test } from "vite-plus/test";

import stripAnsi from "../src/ansi/strip.ts";
import ErrorOverview from "../src/components/ErrorOverview.tsx";
import { renderToString } from "../src/index.ts";

const createErrorWithStack = (stack: string) => {
  const error = new Error("Oh no");
  error.stack = stack;

  return error;
};

test("renders native stack frames as raw lines", () => {
  const output = stripAnsi(
    renderToString(<ErrorOverview error={createErrorWithStack("Error: Oh no\n    at native")} />),
  );

  expect(output.includes(" -     at native")).toBe(true);
  expect(output.includes("undefined")).toBe(false);
});

test("renders named native stack frames as raw lines", () => {
  const output = stripAnsi(
    renderToString(
      <ErrorOverview error={createErrorWithStack("Error: Oh no\n    at foo (native)")} />,
    ),
  );

  expect(output.includes(" -     at foo (native)")).toBe(true);
  expect(output.includes("foo (::)")).toBe(false);
  expect(output.includes("undefined")).toBe(false);
});

test("does not emit duplicate key warnings for repeated stack lines", () => {
  const consoleErrors: string[] = [];
  const originalConsoleError = console.error;

  console.error = (...arguments_: unknown[]) => {
    consoleErrors.push(arguments_.join(" "));
  };

  try {
    renderToString(<ErrorOverview error={createErrorWithStack("Error: Oh no\n\n\n")} />);
  } finally {
    console.error = originalConsoleError;
  }

  expect(
    consoleErrors.some((error) => error.includes("Encountered two children with the same key")),
  ).toBe(false);
});
