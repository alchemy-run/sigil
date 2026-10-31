import { stripAnsi } from "@alchemy.run/sigil/ansi";
import { expect, test } from "vite-plus/test";

import { run } from "./helpers/run.ts";

test("render only last frame when run in CI", async () => {
  const output = await run("ci", {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    env: { CI: "true" },
    columns: 0,
  });

  for (const num of [0, 1, 2, 3, 4]) {
    expect(output).not.toContain(`Counter: ${num}`);
  }

  expect(output).toContain("Counter: 5");
});

test("render all frames if not in CI environment", async () => {
  const output = await run("ci", {
    // We detect CI=1 since thats what every modern CI provider now supports
    env: {},
    columns: 0,
  });
  for (const num of [0, 1, 2, 3, 4, 5]) {
    expect(output).toContain(`Counter: ${num}`);
  }
});

test("debug mode in CI does not replay final frame during unmount teardown", async () => {
  const output = await run("ci-debug", {
    // We detect CI=1 since thats what every modern CI provider now supports
    env: { CI: "1" },
    columns: 0,
  });

  const plainOutput = stripAnsi(output).replaceAll("\r", "");
  const helloCount = plainOutput.match(/Hello/g)?.length ?? 0;

  expect(helloCount).toBe(2);
});

test("debug mode in CI keeps final newline separation after waitUntilExit", async () => {
  const output = await run("ci-debug-after-exit", {
    // We detect CI=1 since thats what every modern CI provider now supports
    env: { CI: "1" },
    columns: 0,
  });

  const plainOutput = stripAnsi(output).replaceAll("\r", "");
  expect(plainOutput).toBe("HelloHello\nDONE");
});
