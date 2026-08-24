import type { ReactNode } from "react";
import { LegacyRoot } from "react-reconciler/constants.js";

import { detectColorLevel } from "#/capabilities/detect.ts";
import { createNode, type DOMElement } from "#/dom.ts";
import { reconciler } from "#/reconciler.ts";
import { renderFrame } from "#/render-frame.ts";
import { colorProfileFromLevel, type ColorProfile } from "#/screen/index.ts";
import { serializeScreen } from "#/screen/serialize.ts";
import { Yoga } from "#/yoga/index.ts";

export type RenderToStringOptions = {
  /**
	Width of the virtual terminal in columns.

	@default 80
	*/
  columns?: number;

  /**
	Color profile used for deterministic serialization. By default this retains
	the process color level for Ink compatibility.
	*/
  colorProfile?: ColorProfile;
};

/**
Render a React element to a string synchronously. Unlike `render()`, this function does not write to stdout, does not set up any terminal event listeners, and returns the rendered output as a string.

Useful for generating documentation, writing output to files, testing, or any scenario where you need the rendered output as a string without starting a persistent terminal application.

**Notes:**

- Terminal-specific hooks (`useInput`, `useStdin`, `useStdout`, `useStderr`, `useApp`, `useFocus`, `useFocusManager`) return default no-op values since there is no terminal session. They will not throw, but they will not function as in a live terminal.
- `useEffect` callbacks will execute during rendering (due to synchronous rendering mode), but state updates they trigger will not affect the returned output, which reflects the initial render.
- `useLayoutEffect` callbacks fire synchronously during commit, so state updates they trigger **will** be reflected in the output.
- The `<Static>` component is supported — its output is prepended to the dynamic output.
- If a component throws during rendering, the error is propagated to the caller after cleanup.

@example
```
import {renderToString, Text, Box} from 'ink';

const output = renderToString(
	<Box padding={1}>
		<Text color="green">Hello World</Text>
	</Box>,
	{columns: 40}
);

console.log(output);
```
*/
export const renderToString = (node: ReactNode, options?: RenderToStringOptions): string => {
  const columns = options?.columns ?? 80;
  const colorProfile = options?.colorProfile ?? colorProfileFromLevel(detectColorLevel());

  // Create a standalone root node — no stdout, stdin, or terminal bindings
  const rootNode: DOMElement = createNode("ink-root");

  // Capture static output from intermediate renders.
  // The <Static> component uses useLayoutEffect to clear its children after
  // the first commit. The reconciler's resetAfterCommit calls onImmediateRender
  // when static content is dirty (and returns early, skipping the normal
  // onRender callback), giving us a chance to capture it before it's cleared
  // by the subsequent re-render.
  let capturedStaticOutput = "";

  rootNode.onComputeLayout = () => {
    rootNode.yogaNode!.setWidth(columns);
    rootNode.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  };

  rootNode.onImmediateRender = () => {
    const { staticScreen } = renderFrame(rootNode, false, { colorProfile });
    const staticOutput = staticScreen
      ? `${serializeScreen(staticScreen, { colorProfile, styles: colorProfile !== "none" })}\n`
      : "";
    if (staticOutput && staticOutput !== "\n") {
      capturedStaticOutput += staticOutput;
    }
  };

  // Capture the first uncaught error so we can re-throw it after cleanup.
  // React's reconciler catches component errors internally and reports them
  // via onUncaughtError rather than letting them propagate. For a synchronous
  // utility like renderToString, callers expect errors to throw.
  let uncaughtError: unknown;

  // Create a reconciler container in legacy (synchronous) mode.
  // The four trailing callbacks are: onUncaughtError, onCaughtError,
  // onRecoverableError, and onHostTransitionComplete.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const container = reconciler.createContainer(
    rootNode,
    LegacyRoot,
    null,
    false,
    null,
    "render-to-string",
    (error: unknown) => {
      uncaughtError ??= error;
    },
    () => {},
    () => {},
    () => {},
  );

  // Synchronously render the React tree into the container
  reconciler.updateContainerSync(node, container, null, () => {});
  reconciler.flushSyncWork();

  // Yoga layout has already been calculated by onComputeLayout during commit.
  // Render the DOM tree to a string — this captures the dynamic (non-static) output.
  const { screen } = renderFrame(rootNode, false, { colorProfile });
  const output = screen
    ? serializeScreen(screen, { colorProfile, styles: colorProfile !== "none" })
    : "";

  // Tear down: unmount the tree so the reconciler cleans up child nodes
  // and runs effect cleanup functions. The reconciler detaches removed
  // subtrees (removeChildFromContainer → detachYogaSubtree); the garbage
  // collector reclaims the Yoga nodes.
  reconciler.updateContainerSync(null, container, null, () => {});
  reconciler.flushSyncWork();

  // Re-throw after full cleanup so callers see the original error.
  if (uncaughtError !== undefined) {
    throw uncaughtError instanceof Error
      ? uncaughtError
      : // eslint-disable-next-line @typescript-eslint/no-base-to-string
        new Error(String(uncaughtError));
  }

  // Static terminal output ends with a newline so dynamic output starts on a
  // fresh line. Strip it here so renderToString returns clean output.
  const normalizedStaticOutput = capturedStaticOutput.endsWith("\n")
    ? capturedStaticOutput.slice(0, -1)
    : capturedStaticOutput;

  if (normalizedStaticOutput && output) {
    return normalizedStaticOutput + "\n" + output;
  }

  return normalizedStaticOutput || output;
};
