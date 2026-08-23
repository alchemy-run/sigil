// Playwright-style async matchers for Vitest. Register once per test file:
//
//   import { expect } from "vitest";
//   import { terminalMatchers } from "#/testing/index.ts";
//   expect.extend(terminalMatchers);
//
//   await expect(app.getByText("Home")).toBeVisible();
//   await expect(app).toContainScreenText("Users");
// Type-only: makes the module augmentation below attach to vitest's types.
import type {} from "vitest";

import { type TerminalApp, type TerminalLocator } from "#/testing/terminal.ts";

type MatcherResult = {
  pass: boolean;
  message: () => string;
};

type MatcherContext = {
  isNot: boolean;
};

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- must match vitest's own type parameter exactly
  interface Matchers<T = any> {
    toBeVisible(options?: { timeout?: number }): Promise<T>;
    toContainScreenText(text: string | RegExp, options?: { timeout?: number }): Promise<T>;
  }
}

export const terminalMatchers = {
  /**
	Waits for the locator's text to appear on screen (or to disappear when
	negated with `.not`).
	*/
  async toBeVisible(
    this: MatcherContext,
    locator: TerminalLocator,
    options: { timeout?: number } = {},
  ): Promise<MatcherResult> {
    const state = this.isNot ? "hidden" : "visible";
    try {
      await locator.waitFor({ ...options, state });
      return {
        // `.not` inverts `pass`, so reaching the desired state must report
        // the polarity that makes the assertion succeed either way.
        pass: !this.isNot,
        message: () => `expected ${locator.description} to be ${state} — and it is`,
      };
    } catch (error) {
      return {
        pass: this.isNot,
        message: () => (error as Error).message,
      };
    }
  },

  /**
	Waits for the given text to appear anywhere on the visible screen.
	*/
  async toContainScreenText(
    this: MatcherContext,
    app: TerminalApp,
    text: string | RegExp,
    options: { timeout?: number } = {},
  ): Promise<MatcherResult> {
    const locator = app.getByText(text);
    return terminalMatchers.toBeVisible.call(this, locator, options);
  },
};
