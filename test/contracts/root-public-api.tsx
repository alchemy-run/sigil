/** @jsxImportSource react */
import { PassThrough } from "node:stream";

import type { ReactNode } from "react";

import {
  Box,
  Hyperlink,
  Newline,
  Spacer,
  Static,
  Text,
  Transform,
  render,
  renderToString,
  type AnimationResult,
  type AppProps,
  type BoxMetrics,
  type BoxProps,
  type Capabilities,
  type CapabilitiesStore,
  type CapturedOutputSource,
  type ColorInfo,
  type ColorSupport,
  type ColorSupportLevel,
  type CursorPosition,
  type DOMElement,
  type ElementMetrics,
  type HyperlinkProps,
  type Instance,
  type Key,
  type KittyFlagName,
  type KittyKeyboardOptions,
  type Multiplexer,
  type NewlineProps,
  type PixelGeometry,
  type PixelSize,
  type RenderOptions,
  type RenderToStringOptions,
  type RgbColor,
  type StaticProps,
  type StderrProps,
  type StdinProps,
  type StdoutProps,
  type SuspendTerminal,
  type TerminalAppearance,
  type TerminalIdentity,
  type TerminalQueryOptions,
  type TerminalQueryResult,
  type TerminalSuspension,
  type TextProps,
  type TransformProps,
  type UseBoxMetricsResult,
  type WindowSize,
} from "#/index.ts";

/**
The exact value exports of the root entry point. Adding or removing a root
export is a compatibility decision and must update this manifest deliberately.
*/
export const rootRuntimeExports = [
  "Box",
  "Hyperlink",
  "Newline",
  "Spacer",
  "Static",
  "Text",
  "Transform",
  "applyTerminalQuery",
  "capabilities",
  "createSupportsColor",
  "detectCapabilities",
  "detectColorLevel",
  "detectHyperlinkSupport",
  "detectTerminal",
  "detectUnicodeSupport",
  "getCapabilities",
  "getTerminalQuery",
  "kittyFlags",
  "kittyModifiers",
  "measureElement",
  "queryTerminal",
  "refreshTerminalQuery",
  "render",
  "renderToString",
  "useAnimation",
  "useApp",
  "useBoxMetrics",
  "useCapabilities",
  "useCapabilitiesChange",
  "useCursor",
  "useFocus",
  "useFocusManager",
  "useInput",
  "useIsScreenReaderEnabled",
  "usePaste",
  "useStderr",
  "useStdin",
  "useStdout",
  "useWindowSize",
] as const;

/**
The type-only root exports. This record forces every named type to resolve
during the dedicated public-contract typecheck.
*/
export type RootPublicTypes = {
  AnimationResult: AnimationResult;
  AppProps: AppProps;
  BoxMetrics: BoxMetrics;
  BoxProps: BoxProps;
  Capabilities: Capabilities;
  CapabilitiesStore: CapabilitiesStore;
  CapturedOutputSource: CapturedOutputSource;
  ColorInfo: ColorInfo;
  ColorSupport: ColorSupport;
  ColorSupportLevel: ColorSupportLevel;
  CursorPosition: CursorPosition;
  DOMElement: DOMElement;
  ElementMetrics: ElementMetrics;
  HyperlinkProps: HyperlinkProps;
  Instance: Instance;
  Key: Key;
  KittyFlagName: KittyFlagName;
  KittyKeyboardOptions: KittyKeyboardOptions;
  Multiplexer: Multiplexer;
  NewlineProps: NewlineProps;
  PixelGeometry: PixelGeometry;
  PixelSize: PixelSize;
  RenderOptions: RenderOptions;
  RenderToStringOptions: RenderToStringOptions;
  RgbColor: RgbColor;
  StaticProps: StaticProps<unknown>;
  StderrProps: StderrProps;
  StdinProps: StdinProps;
  StdoutProps: StdoutProps;
  SuspendTerminal: SuspendTerminal;
  TerminalAppearance: TerminalAppearance;
  TerminalIdentity: TerminalIdentity;
  TerminalQueryOptions: TerminalQueryOptions;
  TerminalQueryResult: TerminalQueryResult;
  TerminalSuspension: TerminalSuspension;
  TextProps: TextProps;
  TransformProps: TransformProps;
  UseBoxMetricsResult: UseBoxMetricsResult;
  WindowSize: WindowSize;
};

type Equal<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;

type Assert<Value extends true> = Value;

export type InstanceContract = Assert<
  Equal<
    keyof Instance,
    "rerender" | "unmount" | "waitUntilExit" | "waitUntilRenderFlush" | "cleanup" | "clear"
  >
>;

export type RenderOptionsContract = Assert<
  Equal<
    keyof RenderOptions,
    | "stdout"
    | "stdin"
    | "stderr"
    | "debug"
    | "exitOnCtrlC"
    | "patchConsole"
    | "onCapturedOutput"
    | "onRender"
    | "isScreenReaderEnabled"
    | "maxFps"
    | "colorProfile"
    | "concurrent"
    | "kittyKeyboard"
    | "interactive"
    | "alternateScreen"
  >
>;

// Compile an ordinary Ink-style application against the root entry point.
// The function is intentionally not invoked: this is a type contract, not a
// terminal integration test.
export const compileInkCompatibleUsage = (children: ReactNode): Instance => {
  const stdout = new PassThrough();
  const options: RenderOptions = {
    stdout,
    stdin: process.stdin,
    stderr: process.stderr,
    debug: false,
    exitOnCtrlC: true,
  };

  const tree = (
    <Box borderStyle="round" flexDirection="column" padding={1}>
      <Text bold color="#ff00ff" wrap="wrap">
        {children}
        <Newline />
        <Hyperlink url="https://example.com">example</Hyperlink>
      </Text>
      <Transform transform={(line) => line.toUpperCase()}>
        <Text>transformed</Text>
      </Transform>
      <Spacer />
      <Static items={["complete"]}>{(item) => <Text key={item}>{item}</Text>}</Static>
    </Box>
  );

  const output: string = renderToString(tree, { columns: 80 });
  void output;

  return render(tree, options);
};
