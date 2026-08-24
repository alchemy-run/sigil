// Terminal capabilities — framework-free, importable without the React
// renderer via `@alchemy.run/sigil/capabilities`.
//
// - `capabilities` / `getCapabilities`: a live store with `current`,
//   `query()`, and `subscribe()`.
// - `detect*`: synchronous environment-derived detection.
// - `queryTerminal` and friends: the raw VT query round-trip.
export type {
  Capabilities,
  ColorInfo,
  ColorSupport,
  ColorSupportLevel,
  Multiplexer,
  PixelGeometry,
  RgbColor,
  TerminalAppearance,
  TerminalIdentity,
} from "#/capabilities/detect.ts";
export {
  createSupportsColor,
  detectCapabilities,
  detectColorLevel,
  detectHyperlinkSupport,
  detectTerminal,
  detectUnicodeSupport,
} from "#/capabilities/detect.ts";
export type { PixelSize, TerminalQueryOptions, TerminalQueryResult } from "#/capabilities/query.ts";
export {
  applyTerminalQuery,
  getTerminalQuery,
  queryTerminal,
  refreshTerminalQuery,
} from "#/capabilities/query.ts";
export type { CapabilitiesStore } from "#/capabilities/store.ts";
export { capabilities, getCapabilities } from "#/capabilities/store.ts";
export type { ColorPolicy, ColorState } from "#/capabilities/color-policy.ts";
export { colorState, resolveColorProfile } from "#/capabilities/color-policy.ts";
