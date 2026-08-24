export type { RenderOptions, Instance } from "#/render.ts";
export type { CapturedOutputSource } from "#/ink.tsx";
export { render } from "#/render.ts";
export type { RenderToStringOptions } from "#/render-to-string.ts";
export { renderToString } from "#/render-to-string.ts";
export type { Props as BoxProps } from "#/components/Box.tsx";
export { Box } from "#/components/Box.tsx";
export type { Props as TextProps } from "#/components/Text.tsx";
export { Text } from "#/components/Text.tsx";
export type { Props as AnsiTextProps } from "#/components/AnsiText.tsx";
export { AnsiText } from "#/components/AnsiText.tsx";
export type { Props as AppProps } from "#/components/AppContext.ts";
export type { PublicProps as StdinProps } from "#/components/StdinContext.ts";
export type { Props as StdoutProps } from "#/components/StdoutContext.ts";
export type { Props as StderrProps } from "#/components/StderrContext.ts";
export type { Props as StaticProps } from "#/components/Static.tsx";
export { Static } from "#/components/Static.tsx";
export type { Props as TransformProps } from "#/components/Transform.tsx";
export { Transform } from "#/components/Transform.tsx";
export type { Props as HyperlinkProps } from "#/components/Hyperlink.tsx";
export { Hyperlink } from "#/components/Hyperlink.tsx";
export type { Props as NewlineProps } from "#/components/Newline.tsx";
export { Newline } from "#/components/Newline.tsx";
export { Spacer } from "#/components/Spacer.tsx";
// Keep the Ink-compatible root surface fixed. New terminal-core APIs live on
// their focused subpaths rather than leaking through this entry point.
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
export { useCapabilities, useCapabilitiesChange } from "#/hooks/use-capabilities.ts";
export type { Key } from "#/hooks/use-input.ts";
export { useInput } from "#/hooks/use-input.ts";
export { usePaste } from "#/hooks/use-paste.ts";
export type { SuspendTerminal, TerminalSuspension } from "#/components/AppContext.ts";
export { useApp } from "#/hooks/use-app.ts";
export { useStdin } from "#/hooks/use-stdin.ts";
export { useStdout } from "#/hooks/use-stdout.ts";
export { useStderr } from "#/hooks/use-stderr.ts";
export { useFocus } from "#/hooks/use-focus.ts";
export { useFocusManager } from "#/hooks/use-focus-manager.ts";
export { useIsScreenReaderEnabled } from "#/hooks/use-is-screen-reader-enabled.ts";
export { useCursor } from "#/hooks/use-cursor.ts";
export type { AnimationResult } from "#/hooks/use-animation.ts";
export { useAnimation } from "#/hooks/use-animation.ts";
export type { ProgressOptions } from "#/hooks/use-terminal-osc.ts";
export {
  useClipboard,
  useNotification,
  usePointerShape,
  useProgress,
  useTitle,
  useWorkingDirectory,
} from "#/hooks/use-terminal-osc.ts";
export type { WindowSize } from "#/hooks/use-window-size.ts";
export { useWindowSize } from "#/hooks/use-window-size.ts";
export type { BoxMetrics, UseBoxMetricsResult } from "#/hooks/use-box-metrics.ts";
export { useBoxMetrics } from "#/hooks/use-box-metrics.ts";
export type { CursorPosition } from "#/cursor-position.ts";
export { measureElement } from "#/measure-element.ts";
export type { ElementMetrics } from "#/measure-element.ts";
export type { DOMElement } from "#/dom.ts";
export { kittyFlags, kittyModifiers } from "#/kitty-keyboard.ts";
export type { KittyKeyboardOptions, KittyFlagName } from "#/kitty-keyboard.ts";
