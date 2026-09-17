// See jsx-runtime.ts for why the names are enumerated.
import { jsxDEV as reactJsxDEV } from "react/jsx-dev-runtime";
import { jsx, jsxs } from "react/jsx-runtime";

export { Fragment } from "react/jsx-dev-runtime";
export type { JSX } from "react/jsx-dev-runtime";

/**
 * React ships `jsxDEV` in its development build only — the production build of
 * `react/jsx-dev-runtime` exports `undefined` — and since this package bundles
 * React, `NODE_ENV` at import time decides which of the two a consumer gets.
 *
 * A transpiler's choice of the *development* JSX transform is a separate
 * decision from `NODE_ENV`, so the two disagree in practice: bun's runtime
 * transpiler emits `jsxDEV` calls for a `@jsxImportSource @alchemy.run/sigil`
 * module while the host process has already set `NODE_ENV=production`.
 * Re-exporting React's binding directly makes that combination fail at the
 * first render with `TypeError: jsxDEV is not a function`, rather than
 * rendering without the development-only warnings the caller never asked for.
 *
 * The production entry points take the same arguments minus `source` and
 * `self`, which only feed those warnings, so the fallback costs what the
 * production build had already dropped and nothing more.
 */
export const jsxDEV: typeof reactJsxDEV =
  (reactJsxDEV as typeof reactJsxDEV | undefined) ??
  ((type, props, key, isStatic) => (isStatic ? jsxs(type, props, key) : jsx(type, props, key)));
