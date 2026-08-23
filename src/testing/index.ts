// End-to-end testing for terminal apps: launch any command in a PTY attached
// to a real terminal emulator engine — Ghostty's VT core (WebAssembly) or
// xterm.js — and drive it with Playwright-style locators, key presses, and
// Vitest matchers. The engines and the PTY are loaded on demand.
//
// Repo-internal for now (used by test/e2e.test.ts and scripts/explorer.ts);
// deliberately NOT exported as a package subpath until the API settles.
export type { Emulator, EmulatorCell, EmulatorName } from "#/testing/emulators.ts";
export { createEmulator } from "#/testing/emulators.ts";
export { keyToSequence } from "#/testing/keys.ts";
export { terminalMatchers } from "#/testing/matchers.ts";
export type {
  LaunchOptions,
  TerminalApp,
  TerminalLocator,
  WaitForOptions,
} from "#/testing/terminal.ts";
export { launchTerminal } from "#/testing/terminal.ts";
export type {
  ExplorerEntry,
  ServeExplorerOptions,
  ServeTerminalOptions,
  TerminalServer,
} from "#/testing/browser.ts";
export { serveExplorer, serveTerminal } from "#/testing/browser.ts";
export type { SerializedTask, TestEngine } from "#/testing/vitest.ts";
export { createVitestEngine } from "#/testing/vitest.ts";
