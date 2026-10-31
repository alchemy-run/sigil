// End-to-end testing for terminal apps: launch any command in a PTY attached
// to a real terminal emulator engine — Ghostty's VT core (WebAssembly) or
// xterm.js — and drive it with Playwright-style locators, key presses, and
// Vitest matchers. The engines and the PTY are loaded on demand.
//
// Published as `@alchemy.run/sigil/testing`; emulator engines remain lazy.
export type { Emulator, EmulatorCell, EmulatorName } from "./emulators.ts";
export { createEmulator } from "./emulators.ts";
export { keyToSequence } from "./keys.ts";
export { terminalMatchers } from "./matchers.ts";
export type { LaunchOptions, TerminalApp, TerminalLocator, WaitForOptions } from "./terminal.ts";
export { launchTerminal } from "./terminal.ts";
export type {
  ExplorerEntry,
  ServeExplorerOptions,
  ServeTerminalOptions,
  TerminalServer,
} from "./browser.ts";
export { serveExplorer, serveTerminal } from "./browser.ts";
export type { SerializedTask, TestEngine } from "./vitest.ts";
export { createVitestEngine } from "./vitest.ts";
