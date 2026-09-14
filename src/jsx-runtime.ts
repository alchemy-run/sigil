// `react/jsx-runtime` is CommonJS; a star re-export carries no static names
// through the bundler, so the automatic-runtime surface is spelled out.
export { Fragment, jsx, jsxs } from "react/jsx-runtime";
// `jsxImportSource` looks up the `JSX` namespace on this module to type
// elements and props. Type-only, so the bundle is unaffected.
export type { JSX } from "react/jsx-runtime";
