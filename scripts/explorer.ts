// The repo's "open mode": `vpr explorer` serves a custom UI on top of
// Vitest — the test tree with run buttons and streaming results, live
// terminal renders of every harness-launched session while tests execute
// (Playwright-UI style), and every example as an interactive browser
// terminal.
//
//   vpr explorer                # serve + open in the browser
//   vpr explorer --no-open      # just serve
//   vpr explorer --no-tests     # examples only, skip the test engine
import { spawn } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import { serveExplorer, type ExplorerEntry } from "#/testing/index.ts";
import { createVitestEngine } from "#/testing/vitest.ts";

const args = new Set(process.argv.slice(2));
const explorerPort = 7744;

// Harness-launched terminals inside test workers mirror themselves here.
// Must be set before the engine exists so workers inherit it.
process.env["SIGIL_LIVE_URL"] = `http://127.0.0.1:${explorerPort}`;

const repoRoot = process.cwd();
const examplesDir = join(repoRoot, "examples");

const entries: ExplorerEntry[] = readdirSync(examplesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(examplesDir, entry.name, "index.ts")))
  .map((entry) => ({
    id: `example:${entry.name}`,
    title: entry.name,
    group: "Examples",
    command: ["node", "--import=tsx", join("examples", entry.name, "index.ts")],
  }));

const tests = args.has("--no-tests") ? undefined : await createVitestEngine();

const server = await serveExplorer(entries, {
  port: explorerPort,
  title: "sigil explorer",
  tests,
});

console.log(`explorer  ${server.url}`);

if (!args.has("--no-open") && process.platform === "darwin") {
  // Prefer the user's browser; fall back to the system default.
  spawn("open", ["-a", "Helium", server.url])
    .on("error", () => {})
    .on("exit", (code) => {
      if (code !== 0) {
        spawn("open", [server.url]);
      }
    });
}

const shutdown = (): void => {
  void Promise.allSettled([tests?.close(), server.close()]).then(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
