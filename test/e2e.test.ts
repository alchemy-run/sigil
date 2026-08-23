// True end-to-end tests: examples run in a PTY against real terminal
// emulator engines (Ghostty's VT core via WebAssembly, and xterm.js), which
// genuinely answer capability queries and interpret every escape sequence.
/* eslint-disable typescript/await-thenable -- the custom matchers return
   Promises (vitest Matchers augmentation in src/testing/matchers.ts); the
   lint's await-thenable analysis misresolves the augmented types even though
   tsc accepts them. */
import { expect, describe, test } from "vite-plus/test";

import { launchTerminal, terminalMatchers, type TerminalApp } from "#/testing/index.ts";

expect.extend(terminalMatchers);

const tsx = (file: string) => ["node", "--import=tsx", file];

const closing = async (app: TerminalApp, run: () => Promise<void>) => {
  try {
    await run();
  } finally {
    app.close();
  }
};

describe.each(["ghostty", "xterm"] as const)("%s engine", (emulator) => {
  test("router example: full keyboard navigation", async () => {
    const app = await launchTerminal(tsx("examples/router/index.ts"), { emulator });
    await closing(app, async () => {
      await expect(app.getByText("Welcome!")).toBeVisible();

      // Home link has autofocus; Tab moves to the Users link.
      await app.press("Tab", "Enter");
      await expect(app.getByText("Ada Lovelace")).toBeVisible();

      await app.press("Tab", "Enter");
      await expect(app.getByText(/Viewing Ada Lovelace/)).toBeVisible();

      await app.press("Escape");
      await expect(app.getByText(/Viewing/)).not.toBeVisible();
      await expect(app.getByText("Grace Hopper")).toBeVisible();

      await app.press("q");
      expect(await app.waitForExit()).toBe(0);
    });
  }, 30_000);

  test("wide characters occupy two cells, keeping borders aligned", async () => {
    const app = await launchTerminal(tsx("test/fixtures/e2e-wide.ts"), { emulator });
    await closing(app, async () => {
      await expect(app.getByText("snake")).toBeVisible();

      // Every border row must end at the same cell column — emoji measured
      // as one cell would pull their rows two columns short.
      const edgeColumns = new Set<number>();
      for (const [row, line] of app.lines().entries()) {
        if (!/[\u2502\u256d\u2570]/.test(line)) {
          continue;
        }

        for (let x = 40; x >= 0; x--) {
          const cell = app.cellAt(x, row);
          if (cell && /[\u2502\u256e\u256f]/.test(cell.text)) {
            edgeColumns.add(x);
            break;
          }
        }
      }

      expect(edgeColumns.size).toBe(1);
      expect([...edgeColumns][0]).toBe(15);
    });
  }, 30_000);

  test("router example: reflows after resize", async () => {
    const app = await launchTerminal(tsx("examples/router/index.ts"), {
      emulator,
      columns: 100,
      rows: 30,
    });
    await closing(app, async () => {
      await expect(app.getByText("Welcome!")).toBeVisible();

      app.resize(40, 20);
      await app.waitFor(() => app.lines().every((line) => line.length <= 40));
      await expect(app.getByText("Welcome!")).toBeVisible();
    });
  }, 30_000);
});

describe("ghostty engine specifics", () => {
  test("the capability query gets real answers", async () => {
    const app = await launchTerminal(tsx("examples/capabilities/index.ts"), {
      emulator: "ghostty",
      colorScheme: "dark",
    });
    await closing(app, async () => {
      // The engine answered OSC 10/11 with its actual dark palette, so the
      // theme derives from the real background color.
      await expect(app.getByText(/theme.*dark/)).toBeVisible();
      await expect(app.getByText(/#eeeeee \/ #0d0d0d/)).toBeVisible();

      // DA1 was answered (the query completed): query-only booleans are
      // filled in rather than "undefined".
      await expect(app.getByText(/sixel\s+false/)).toBeVisible();

      await app.press("q");
      expect(await app.waitForExit()).toBe(0);
    });
  }, 30_000);

  test("OSC 8 hyperlinks survive the real parser", async () => {
    const app = await launchTerminal(tsx("test/fixtures/e2e-hyperlink.ts"), {
      emulator: "ghostty",
      // eslint-disable-next-line @typescript-eslint/naming-convention
      env: { FORCE_HYPERLINK: "1" },
    });
    await closing(app, async () => {
      await expect(app.getByText("Docs")).toBeVisible();

      const row = app.lines().findIndex((line) => line.includes("Docs"));
      const column = app.lines()[row]!.indexOf("Docs");
      expect(app.cellAt(column, row)?.hyperlink).toBe("https://example.com");
      // The plain line has no hyperlink.
      const plainRow = app.lines().findIndex((line) => line.includes("Plain"));
      expect(app.cellAt(0, plainRow)?.hyperlink).toBeUndefined();
    });
  }, 30_000);
});
