import { expect, test } from "vite-plus/test";

import { stripAnsi } from "#/ansi/strip.ts";
import { ErrorOverview } from "#/components/ErrorOverview.tsx";
import { renderToString } from "#/index.ts";

const createErrorWithStack = (stack: string) => {
  const error = new Error("Oh no");
  error.stack = stack;

  return error;
};

test("renders source excerpts for file URLs containing spaces", () => {
  const sourceUrl = new URL("fixtures/error source.txt", import.meta.url);
  const error = createErrorWithStack(`Error: Oh no\n    at ${sourceUrl.href}:1:1`);
  const output = stripAnsi(renderToString(<ErrorOverview error={error} />));

  expect(output).toContain("throw new Error('Source excerpt marker');");
  expect(output).toContain("error source.txt:1:1");
});

test("renders the original error when its source path cannot be read", () => {
  const sourceUrl = new URL("fixtures/", import.meta.url);
  const error = createErrorWithStack(`Error: Oh no\n    at ${sourceUrl.href}:1:1`);
  const output = stripAnsi(renderToString(<ErrorOverview error={error} />));

  expect(output).toContain("Oh no");
  expect(output).toContain("fixtures:1:1");
});

test("renders the original error when its source file is missing", () => {
  const error = createErrorWithStack("Error: Oh no\n    at missing-source-file.js:1:1");
  const output = stripAnsi(renderToString(<ErrorOverview error={error} />));

  expect(output).toContain("Oh no");
  expect(output).toContain("missing-source-file.js:1:1");
});

test("renders the original error when a file URL in its stack has a malformed escape", () => {
  const error = createErrorWithStack("Error: Oh no\n    at file:///bad%ZZ.js:1:1");
  const output = stripAnsi(renderToString(<ErrorOverview error={error} />));

  expect(output).toContain("Oh no");
  expect(output).toContain("file:///bad%ZZ.js:1:1");
});

// A file URL with a host is a valid UNC path on Windows.
test.skipIf(process.platform === "win32")(
  "renders the original error when a file URL in its stack has a host",
  () => {
    const error = createErrorWithStack("Error: Oh no\n    at file://example.com/app.js:1:1");
    const output = stripAnsi(renderToString(<ErrorOverview error={error} />));

    expect(output).toContain("Oh no");
    expect(output).toContain("file://example.com/app.js:1:1");
  },
);

test("multiline error messages are not treated as stack frames", () => {
  const sourceUrl = new URL("fixtures/error source.txt", import.meta.url);
  const error = new Error("Validation failed\nRequired field is missing");
  error.stack = `Error: ${error.message}\n    at ${sourceUrl.href}:1:1`;
  const output = stripAnsi(renderToString(<ErrorOverview error={error} />));

  expect(output).toContain("throw new Error('Source excerpt marker');");
  expect(output).toContain("Validation failed");
  expect(output.split("Required field is missing").length).toBe(2);
});

test("renders native stack frames as raw lines", () => {
  const output = stripAnsi(
    renderToString(<ErrorOverview error={createErrorWithStack("Error: Oh no\n    at native")} />),
  );

  expect(output).toContain(" -     at native");
  expect(output).not.toContain("undefined");
});

test("renders named native stack frames as raw lines", () => {
  const output = stripAnsi(
    renderToString(
      <ErrorOverview error={createErrorWithStack("Error: Oh no\n    at foo (native)")} />,
    ),
  );

  expect(output).toContain(" -     at foo (native)");
  expect(output).not.toContain("foo (::)");
  expect(output).not.toContain("undefined");
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
