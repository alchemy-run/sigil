/** @jsxImportSource react */
import { setImmediate as yieldImmediate } from "node:timers/promises";
import { isNativeError } from "node:util/types";

import { type ReactNode } from "react";
import { type FiberRoot } from "react-reconciler";
import { LegacyRoot, ConcurrentRoot } from "react-reconciler/constants.js";

import { ansiEscapes, bsu, esu } from "#/ansi/escapes.ts";
import { wrapAnsi } from "#/ansi/wrap.ts";
import { accessibilityContext as AccessibilityContext } from "#/components/AccessibilityContext.ts";
import { App } from "#/components/App.tsx";
import { type TerminalSuspension } from "#/components/AppContext.ts";
import { hideCursorEscape, showCursorEscape } from "#/cursor-position.ts";
import * as dom from "#/dom.ts";
import { isSigilDev, isInCi, isScreenReader, isTty, isWindows } from "#/env.ts";
import { instances } from "#/instances.ts";
import {
  type KittyKeyboardOptions,
  type KittyFlagName,
  resolveFlags,
  detectKittySupport,
} from "#/kitty-keyboard.ts";
import { logUpdate, type LogUpdate, type CursorPosition } from "#/log-update.ts";
import { patchConsole, patchStreamWrite } from "#/patch-console.ts";
import { reconciler } from "#/reconciler.ts";
import { renderer } from "#/renderer.ts";
import { signalExit } from "#/signal-exit.ts";
import { type OutputStream } from "#/stream.ts";
import { throttle, type Throttled } from "#/throttle.ts";
import { getWindowSize } from "#/utils.ts";
import { Yoga } from "#/yoga/index.ts";

const noop = () => {};

const shouldClearTerminalForFrame = ({
  isTTY,
  viewportRows,
  previousOutputHeight,
  nextOutputHeight,
  isUnmounting,
}: {
  isTTY: boolean;
  viewportRows: number;
  previousOutputHeight: number;
  nextOutputHeight: number;
  isUnmounting: boolean;
}): boolean => {
  if (!isTTY) {
    return false;
  }

  const hadPreviousFrame = previousOutputHeight > 0;
  const wasFullscreen = previousOutputHeight >= viewportRows;
  const wasOverflowing = previousOutputHeight > viewportRows;
  const isOverflowing = nextOutputHeight > viewportRows;
  const isFullscreen = nextOutputHeight >= viewportRows;
  // Only a frame that actually OVERFLOWED the viewport needs the full
  // clear when shrinking back to inline — its top rows live above the top
  // margin where incremental erase cannot reach. A frame that exactly
  // filled the viewport is erasable in place; clearing the terminal for it
  // destroys the user's scrollback for no benefit (and rapid height
  // resizes routinely produce transient exactly-fullscreen frames).
  const isLeavingFullscreen = wasOverflowing && nextOutputHeight < viewportRows;
  const shouldClearOnUnmount = isUnmounting && wasFullscreen;

  // Windows consoles scroll the buffer when the bottom-right cell is written,
  // unlike xterm-like terminals which defer the wrap. That extra scroll
  // desynchronizes the incremental erase used for frames that exactly fill the
  // viewport, leaving stale copies of previous frames behind (#969). Keep the
  // pre-7.0 behavior of fully clearing between fullscreen frames there.
  if (isWindows && (wasFullscreen || isFullscreen)) {
    return true;
  }

  return (
    // Overflowing frames still need full clear fallback.
    wasOverflowing ||
    (isOverflowing && hadPreviousFrame) ||
    // Clear when shrinking from fullscreen to non-fullscreen output.
    isLeavingFullscreen ||
    // Preserve legacy unmount behavior for fullscreen frames: final teardown
    // render should clear once to avoid leaving a scrolled viewport state.
    shouldClearOnUnmount
  );
};

const isErrorInput = (value: unknown): value is Error => {
  return value instanceof Error || isNativeError(value);
};

const getWritableStreamState = (stdout: OutputStream) => {
  const canWriteToStdout = !stdout.destroyed && !stdout.writableEnded && (stdout.writable ?? true);

  return {
    canWriteToStdout,
  };
};

const settleThrottle = <Arguments extends unknown[]>(
  throttled: Throttled<Arguments> | undefined,
  canWriteToStdout: boolean,
): void => {
  if (!throttled) {
    return;
  }

  if (canWriteToStdout) {
    throttled.flush();
  } else {
    throttled.cancel();
  }
};

// Best-effort write: streams may already be destroyed during shutdown.
const writeBestEffort = (stream: OutputStream, data: string): void => {
  try {
    stream.write(data);
  } catch {}
};

/**
The origin of a chunk captured by `patchConsole`: a patched `console.*`
method, or a direct `stdout.write` / `stderr.write` call.
*/
export type CapturedOutputSource = "console" | "stdio";

// With `patchConsole: "stdio"` the real streams' `write` is intercepted, so
// Ink's own frame writes must bypass the capture. This facade carries the
// original `write` while event subscriptions still land on the real stream —
// an unmodified `Object.create` clone would get its own EventEmitter
// listener table and never see the real stream's `resize` events.
const createRenderPassthrough = (stream: OutputStream): OutputStream => {
  const passthrough = Object.create(stream) as OutputStream;
  passthrough.write = stream.write.bind(stream);
  passthrough.on = stream.on.bind(stream);
  passthrough.off = stream.off.bind(stream);
  passthrough.once = stream.once.bind(stream);
  passthrough.addListener = stream.addListener.bind(stream);
  passthrough.removeListener = stream.removeListener.bind(stream);
  passthrough.emit = stream.emit.bind(stream);
  return passthrough;
};

/**
Performance metrics for a render operation.
*/
export type RenderMetrics = {
  /**
	Time spent rendering in milliseconds.
	*/
  renderTime: number;
};

export type Options = {
  stdout: OutputStream;
  stdin: NodeJS.ReadableStream;
  stderr: OutputStream;
  debug: boolean;
  exitOnCtrlC: boolean;

  /**
	Patch console methods so `console.*` output doesn't mix with Ink's output.

	Pass `"stdio"` to additionally intercept direct `stdout.write` /
	`stderr.write` calls (from dependencies, native warnings, child tooling)
	on the streams Ink renders to. Captured output is line-buffered and
	spliced above the live frame, exactly like console output; Ink's own
	frame writes bypass the capture.
	*/
  patchConsole: boolean | "stdio";

  /**
	Observe output captured by `patchConsole` before Ink displays it.

	Called with each captured chunk and its origin: `"console"` for patched
	`console.*` calls, `"stdio"` for direct stream writes (only emitted with
	`patchConsole: "stdio"`). Return `true` to take ownership of the chunk —
	Ink will not display it, letting the app render it itself (for example
	inside a `<Static>` transcript).
	*/
  onCapturedOutput?: (
    stream: "stdout" | "stderr",
    data: string,
    source: CapturedOutputSource,
  ) => boolean | undefined | void;
  onRender?: (metrics: RenderMetrics) => void;
  isScreenReaderEnabled?: boolean;
  maxFps?: number;
  incrementalRendering?: boolean;

  /**
	Enable React Concurrent Rendering mode.

	When enabled:
	- Suspense boundaries work correctly with async data
	- `useTransition` and `useDeferredValue` are fully functional
	- Updates can be interrupted for higher priority work

	Note: Concurrent mode changes the timing of renders. Some tests may need to use `act()` to properly await updates. Reusing the same stdout across multiple `render()` calls without unmounting is unsupported. Call `unmount()` first if you need to change the rendering mode or create a fresh instance.

	@default false
	@experimental
	*/
  concurrent?: boolean;
  kittyKeyboard?: KittyKeyboardOptions;

  /**
	Override automatic interactive mode detection.

	By default, Ink detects whether the environment is interactive based on CI detection (the `CI` environment variable) and `stdout.isTTY`. Most users should not need to set this.

	When non-interactive, Ink disables ANSI erase sequences, cursor manipulation, synchronized output, resize handling, and kitty keyboard auto-detection, writing only the final frame at unmount.

	Set to `false` to force non-interactive mode or `true` to force interactive mode when the automatic detection doesn't suit your use case.

	Note: Reusing the same stdout across multiple `render()` calls without unmounting is unsupported. Call `unmount()` first if you need to change this option or create a fresh instance.

	@default true (false if in CI or `stdout.isTTY` is falsy)

	@see {@link RenderOptions.interactive}
	*/
  interactive?: boolean;

  /**
	Render the app in the terminal's alternate screen buffer. When enabled, the app renders on a separate screen, and the original terminal content is restored when the app exits. This is the same mechanism used by programs like vim, htop, and less.

	Note: The terminal's scrollback buffer is not available while in the alternate screen. This is standard terminal behavior; programs like vim use the alternate screen specifically to avoid polluting the user's scrollback history.

	Note: Ink intentionally treats alternate-screen teardown output as disposable. It does not preserve or replay teardown-time frames, hook writes, or `console.*` output after restoring the primary screen.

	Only works in interactive mode. Ignored when `interactive` is `false` or in a non-interactive environment (CI, piped stdout).

	Note: Reusing the same stdout across multiple `render()` calls without unmounting is unsupported. Call `unmount()` first if you need to change this option or create a fresh instance.

	@default false

	@see {@link RenderOptions.alternateScreen}
	*/
  alternateScreen?: boolean;
};

/**
A live Ink renderer for one stdout stream, created by `createInk`.
*/
export type Ink = {
  /**
	Replace the previous root node with a new one or update props of the current root node.
	*/
  render: (node: ReactNode) => void;

  /**
	Unmount the app and release the terminal.
	*/
  // eslint-disable-next-line @typescript-eslint/no-restricted-types
  unmount: (error?: Error | number | null) => void;

  /**
	Returns a promise that settles when the app is unmounted.
	*/
  waitUntilExit: () => Promise<unknown>;

  /**
	Returns a promise that settles after pending render output is flushed to stdout.
	*/
  waitUntilRenderFlush: () => Promise<void>;

  /**
	Clear output.
	*/
  clear: () => void;
};

export const createInk = (options: Options): Ink => {
  // Set when patchConsole is "stdio": the real streams whose write is patched.
  let captureTargets: { stdout: OutputStream; stderr: OutputStream } | undefined;

  if (options.patchConsole === "stdio") {
    // Keep the real streams for patching (and for the instance registry,
    // which is keyed by the stream passed to render()), and render
    // through passthrough facades that bypass the capture.
    captureTargets = { stdout: options.stdout, stderr: options.stderr };
    options = {
      ...options,
      stdout: createRenderPassthrough(options.stdout),
      stderr: createRenderPassthrough(options.stderr),
    };
  }

  const rootNode = dom.createNode("ink-root");
  rootNode.onComputeLayout = calculateLayout;

  const isScreenReaderEnabled = options.isScreenReaderEnabled ?? isScreenReader;

  // CI detection takes precedence: even a TTY stdout in CI defaults to non-interactive.
  // Using Boolean(isTTY) (rather than an 'in' guard) correctly handles piped streams
  // where the property is absent (e.g. `node app.js | cat`).
  const interactive = options.interactive ?? (!isInCi && Boolean(options.stdout.isTTY));

  let alternateScreen = false;

  const unthrottled = options.debug || isScreenReaderEnabled;
  const maxFps = options.maxFps ?? 30;
  // Treat non-positive maxFps as an internal fallback case, not a supported
  // "disable throttling" mode. Keep animation scheduling on a normal cadence
  // so future changes don't accidentally reintroduce zero-delay loops.
  const frameIntervalMs = maxFps > 0 ? Math.max(1, Math.ceil(1000 / maxFps)) : 0;
  const renderThrottleMs = unthrottled ? 0 : frameIntervalMs;

  let hasPendingThrottledRender = false;
  let throttledOnRender: Throttled<never[]> | undefined;

  if (unthrottled) {
    rootNode.onRender = onRender;
  } else {
    const throttled = throttle(onRender, frameIntervalMs);
    rootNode.onRender = () => {
      hasPendingThrottledRender = true;
      throttled();
    };

    throttledOnRender = throttled;
  }

  rootNode.onImmediateRender = onRender;
  rootNode.onStaticChange = handleStaticChange;
  const log = logUpdate.create(options.stdout, {
    incremental: options.incrementalRendering,
  });
  let cursorPosition: CursorPosition | undefined;
  const logThrottle = unthrottled
    ? undefined
    : throttle((output: string) => {
        const shouldWrite = log.willRender(output);
        const sync = shouldSync();
        if (sync && shouldWrite) {
          options.stdout.write(bsu);
        }

        log(output);

        if (sync && shouldWrite) {
          options.stdout.write(esu);
        }
      });
  const throttledLog: LogUpdate | Throttled<[output: string]> = logThrottle ?? log;

  // Ignore last render after unmounting a tree to prevent empty output before exit
  let isUnmounted = false;
  let isUnmounting = false;

  const isConcurrent = options.concurrent ?? false;

  // Store last output to only rerender when needed
  let lastOutput = "";
  let lastOutputToRender = "";
  let lastOutputHeight = 0;
  let lastTerminalWidth = getWindowSize(options.stdout).columns;
  let lastTerminalHeight = getWindowSize(options.stdout).rows;

  // This variable is used only in debug mode to store full static output
  // so that it's rerendered every time, not just new static parts, like in non-debug mode
  let fullStaticOutput = "";

  let exitResult: unknown;
  let beforeExitHandler: (() => void) | undefined;
  let restoreConsole: (() => void) | undefined;
  // Partial trailing lines from captured direct writes, held until a newline.
  const capturedStdioTails = { stdout: "", stderr: "" };
  let unsubscribeResize: (() => void) | undefined;
  let kittyProtocolEnabled = false;
  let kittyFlags: KittyFlagName[] | undefined;
  let cancelKittyDetection: (() => void) | undefined;
  let nextRenderCommit: { promise: Promise<void>; resolve: () => void } | undefined;
  // Set while suspendTerminal() has handed the terminal to a child process.
  let isSuspended = false;
  // Input pause/resume hooks registered by the App component, which owns raw
  // mode and bracketed paste state.
  let pauseInput: (() => void) | undefined;
  let resumeInput: (() => void) | undefined;

  // Use ConcurrentRoot for concurrent mode, LegacyRoot for legacy mode
  const rootTag = isConcurrent ? ConcurrentRoot : LegacyRoot;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const container: FiberRoot = reconciler.createContainer(
    rootNode,
    rootTag,
    null,
    false,
    null,
    "id",
    () => {},
    () => {},
    () => {},
    () => {},
  );

  // Unmount when process exits
  const unsubscribeExit = signalExit(unmount, { alwaysLast: false });

  setAlternateScreen(Boolean(options.alternateScreen));

  // @ts-expect-error outdated types
  if (isSigilDev) reconciler.injectIntoDevTools();

  if (options.patchConsole) installConsolePatch();

  if (interactive) {
    options.stdout.on("resize", resized);

    unsubscribeResize = () => {
      options.stdout.off("resize", resized);
    };
  }

  initKittyKeyboard();

  const {
    promise: exitPromise,
    resolve: resolveExitPromise,
    reject: rejectExitPromise,
  } = Promise.withResolvers<unknown>();
  // Prevent global unhandled-rejection crashes when app code exits with an
  // error but consumers never call waitUntilExit().

  void exitPromise.catch(noop);

  function resized(): void {
    const currentWidth = getWindowSize(options.stdout).columns;
    const currentHeight = getWindowSize(options.stdout).rows;

    // A width decrease rewraps lines and any height change moves content
    // through scrollback, so the incremental render state no longer
    // matches the screen. Erase what is still visible and force the next
    // render to be a full rewrite instead of an incremental diff that
    // would skip "unchanged" lines over stale screen content.
    if (currentWidth < lastTerminalWidth || currentHeight !== lastTerminalHeight) {
      // `log.clear()` erases the full previous frame line count from
      // the cursor upward — after a height grow that also covers frame
      // lines the emulator pulled back from scrollback, so no extra
      // erase is needed for them.
      log.clear();
      lastOutput = "";
      lastOutputToRender = "";
      // Also forget the previous frame height: it described a frame
      // that no longer exists on screen, and letting it flow into
      // shouldClearTerminalForFrame would trigger a scrollback-erasing
      // clearTerminal on a height shrink.
      lastOutputHeight = 0;
    }

    calculateLayout();
    dom.emitLayoutListeners(rootNode);
    onRender();

    lastTerminalWidth = currentWidth;
    lastTerminalHeight = currentHeight;
  }

  function handleAppExit(errorOrResult?: unknown): void {
    if (isUnmounted || isUnmounting) {
      return;
    }

    if (isErrorInput(errorOrResult)) {
      unmount(errorOrResult);
      return;
    }

    exitResult = errorOrResult;
    unmount();
  }

  function setCursorPosition(position: CursorPosition | undefined): void {
    cursorPosition = position;
    log.setCursorPosition(position);
  }

  function restoreLastOutput(): void {
    if (!interactive) {
      return;
    }

    // Clear() resets log-update's cursor state, so replay the latest cursor intent
    // before restoring output after external stdout/stderr writes.
    log.setCursorPosition(cursorPosition);
    log(lastOutputToRender || lastOutput + "\n");
  }

  function calculateLayout(): void {
    const terminalWidth = getWindowSize(options.stdout).columns;

    rootNode.yogaNode!.setWidth(terminalWidth);

    rootNode.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  }

  // Resets `fullStaticOutput` when the <Static> identity changes so stale items from a previous instance are not replayed on future rewrites.
  function handleStaticChange(): void {
    fullStaticOutput = "";
  }

  function onRender(): void {
    hasPendingThrottledRender = false;

    if (isUnmounted) {
      return;
    }

    // While suspended, the terminal belongs to a child process. Discard queued
    // renders; resume() forces a full redraw once Ink reclaims the terminal.
    // Resolve any awaited render commit so callers don't hang during suspension.
    if (isSuspended) {
      if (nextRenderCommit) {
        nextRenderCommit.resolve();
        nextRenderCommit = undefined;
      }

      return;
    }

    if (nextRenderCommit) {
      nextRenderCommit.resolve();
      nextRenderCommit = undefined;
    }

    const startTime = performance.now();
    const { output, outputHeight, staticOutput } = renderer(rootNode, isScreenReaderEnabled);

    options.onRender?.({ renderTime: performance.now() - startTime });

    // If <Static> output isn't empty, it means new children have been added to it
    const hasStaticOutput = staticOutput && staticOutput !== "\n";

    if (options.debug) {
      if (hasStaticOutput) {
        fullStaticOutput += staticOutput;
      }

      lastOutput = output;
      lastOutputToRender = output;
      lastOutputHeight = outputHeight;
      options.stdout.write(fullStaticOutput + output);
      return;
    }

    if (!interactive) {
      if (hasStaticOutput) {
        options.stdout.write(staticOutput);
      }

      lastOutput = output;
      lastOutputToRender = output + "\n";
      lastOutputHeight = outputHeight;
      return;
    }

    if (isScreenReaderEnabled) {
      const sync = shouldSync();
      if (sync) {
        options.stdout.write(bsu);
      }

      if (hasStaticOutput) {
        // We need to erase the main output before writing new static output
        const erase = lastOutputHeight > 0 ? ansiEscapes.eraseLines(lastOutputHeight) : "";
        options.stdout.write(erase + staticOutput);
        // After erasing, the last output is gone, so we should reset its height
        lastOutputHeight = 0;
      }

      if (output === lastOutput && !hasStaticOutput) {
        if (sync) {
          options.stdout.write(esu);
        }

        return;
      }

      const terminalWidth = getWindowSize(options.stdout).columns;

      const wrappedOutput = wrapAnsi(output, terminalWidth, {
        trim: false,
        hard: true,
      });

      // If we haven't erased yet, do it now.
      if (hasStaticOutput) {
        options.stdout.write(wrappedOutput);
      } else {
        const erase = lastOutputHeight > 0 ? ansiEscapes.eraseLines(lastOutputHeight) : "";
        options.stdout.write(erase + wrappedOutput);
      }

      lastOutput = output;
      lastOutputToRender = wrappedOutput;
      lastOutputHeight = wrappedOutput === "" ? 0 : wrappedOutput.split("\n").length;

      if (sync) {
        options.stdout.write(esu);
      }

      return;
    }

    if (hasStaticOutput) {
      fullStaticOutput += staticOutput;
    }

    renderInteractiveFrame(output, outputHeight, hasStaticOutput ? staticOutput : "");
  }

  function render(node: ReactNode): void {
    const tree = (
      <AccessibilityContext.Provider value={{ isScreenReaderEnabled }}>
        <App
          stdin={options.stdin}
          stdout={options.stdout}
          stderr={options.stderr}
          exitOnCtrlC={options.exitOnCtrlC}
          interactive={interactive}
          renderThrottleMs={renderThrottleMs}
          writeToStdout={writeToStdout}
          writeToStderr={writeToStderr}
          setCursorPosition={setCursorPosition}
          onExit={handleAppExit}
          onWaitUntilRenderFlush={waitUntilRenderFlush}
          onSuspendTerminal={suspendTerminal}
          onRegisterInputControl={registerInputControl}
        >
          {node}
        </App>
      </AccessibilityContext.Provider>
    );

    if (isConcurrent) {
      // Concurrent mode: use updateContainer (async scheduling)
      reconciler.updateContainer(tree, container, null, noop);
    } else {
      // Legacy mode: use updateContainerSync + flushSyncWork (sync)
      reconciler.updateContainerSync(tree, container, null, noop);
      reconciler.flushSyncWork();
    }
  }

  function writeToStdout(data: string): void {
    if (isUnmounted) {
      return;
    }

    // While suspended, the terminal belongs to a child process. Don't erase or
    // repaint Ink's frame around console output; the forced redraw on resume
    // restores the screen.
    if (isSuspended) {
      return;
    }

    if (options.debug) {
      options.stdout.write(data + fullStaticOutput + lastOutput);
      return;
    }

    if (!interactive) {
      options.stdout.write(data);
      return;
    }

    const sync = shouldSync();
    if (sync) {
      options.stdout.write(bsu);
    }

    log.clear();
    options.stdout.write(data);
    restoreLastOutput();

    if (sync) {
      options.stdout.write(esu);
    }
  }

  function writeToStderr(data: string): void {
    if (isUnmounted) {
      return;
    }

    // See writeToStdout: stay off the terminal while suspended.
    if (isSuspended) {
      return;
    }

    if (options.debug) {
      options.stderr.write(data);
      options.stdout.write(fullStaticOutput + lastOutput);
      return;
    }

    if (!interactive) {
      options.stderr.write(data);
      return;
    }

    const sync = shouldSync();
    if (sync) {
      options.stdout.write(bsu);
    }

    log.clear();
    options.stderr.write(data);
    restoreLastOutput();

    if (sync) {
      options.stdout.write(esu);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-restricted-types
  function unmount(error?: Error | number | null): void {
    if (isUnmounted || isUnmounting) {
      return;
    }

    isUnmounting = true;

    if (beforeExitHandler) {
      process.off("beforeExit", beforeExitHandler);
      beforeExitHandler = undefined;
    }

    const { canWriteToStdout } = getWritableStreamState(options.stdout);

    // Display any partial captured stdio lines while writes still go through.
    if (canWriteToStdout) {
      flushCapturedStdio();
    }

    // Clear any pending throttled render timer on unmount. When stdout is writable,
    // flush so the final frame is emitted; otherwise cancel to avoid delayed callbacks.
    settleThrottle(throttledOnRender, canWriteToStdout);

    if (canWriteToStdout) {
      // If throttling is enabled and there is already a pending render, flushing above
      // is sufficient. Also avoid calling onRender() again when static output already
      // exists, as that can duplicate <Static> children output on exit (see issue #397).
      const shouldRenderFinalFrame =
        !throttledOnRender || (!hasPendingThrottledRender && fullStaticOutput === "");

      if (shouldRenderFinalFrame) {
        calculateLayout();
        onRender();
      }
    }

    // Mark as unmounted after the final render but before stdout writes
    // that could re-enter exit() via synchronous write callbacks.
    isUnmounted = true;

    unsubscribeExit();

    // Flush any pending throttled log writes if possible, otherwise cancel to
    // prevent delayed callbacks from writing to a closed stream.
    settleThrottle(logThrottle, canWriteToStdout);
    if (typeof restoreConsole === "function") {
      // Once unmount starts, Ink stops trying to manage teardown-time
      // console output. Restoring the native console before React cleanup keeps
      // unmount behavior simple and avoids special-case handling for custom
      // streams, fullscreen frames, and alternate-screen teardown.
      restoreConsole();
    }

    const finishUnmount = (): void => {
      if (typeof unsubscribeResize === "function") {
        unsubscribeResize();
      }

      // Cancel any in-progress auto-detection before checking protocol state
      if (cancelKittyDetection) {
        cancelKittyDetection();
      }

      if (canWriteToStdout) {
        if (kittyProtocolEnabled) {
          writeBestEffort(options.stdout, ansiEscapes.popKittyKeyboard);
        }

        // Alternate-screen content is disposable by design. We intentionally
        // leave it active until React cleanup finishes, then restore the
        // primary buffer without replaying prior frames, hook writes, or
        // diagnostics onto it. Trying to preserve teardown output across the
        // buffer switch adds fragile lifecycle-specific behavior, so Ink keeps
        // alternate-screen teardown intentionally simple and best-effort.
        if (alternateScreen) {
          writeBestEffort(options.stdout, ansiEscapes.exitAlternativeScreen);
          writeBestEffort(options.stdout, showCursorEscape);
          alternateScreen = false;
        }

        if (!interactive) {
          // Non-interactive environments don't handle erasing ansi escapes well.
          // In debug mode, each render already writes to stdout, so only a trailing
          // newline is needed. In non-debug mode, write the last frame now (it was
          // deferred during rendering).
          options.stdout.write(options.debug ? "\n" : lastOutput + "\n");
        } else if (!options.debug) {
          log.done();
        }
      }

      kittyProtocolEnabled = false;

      instances.delete(captureTargets?.stdout ?? options.stdout);

      // Ensure all queued writes have been processed before resolving the
      // exit promise. Queue an empty write as a barrier — its callback fires
      // only after all prior writes complete.
      //
      // When called from signal-exit during process shutdown (error is a
      // number or null rather than undefined/Error), resolve synchronously
      // because the event loop is draining and async callbacks won't fire.
      const finalExitResult = exitResult;

      const resolveOrReject = () => {
        if (isErrorInput(error)) {
          rejectExitPromise(error);
        } else {
          resolveExitPromise(finalExitResult);
        }
      };

      const isProcessExiting = error !== undefined && !isErrorInput(error);

      if (isProcessExiting) {
        resolveOrReject();
      } else if (canWriteToStdout) {
        options.stdout.write("", resolveOrReject);
      } else {
        setImmediate(resolveOrReject);
      }
    };

    const concurrentReconciler = reconciler as {
      flushPassiveEffects?: () => boolean;
    };

    if (isConcurrent) {
      reconciler.updateContainerSync(null, container, null, noop);
      reconciler.flushSyncWork();
      concurrentReconciler.flushPassiveEffects?.();
      finishUnmount();
    } else {
      // Legacy mode: use updateContainerSync + flushSyncWork (sync)
      reconciler.updateContainerSync(null, container, null, noop);
      reconciler.flushSyncWork();
      finishUnmount();
    }
  }

  async function waitUntilExit(): Promise<unknown> {
    if (!beforeExitHandler) {
      beforeExitHandler = () => {
        unmount();
      };

      process.once("beforeExit", beforeExitHandler);
    }

    return exitPromise;
  }

  async function waitUntilRenderFlush(): Promise<void> {
    if (isUnmounted || isUnmounting) {
      await awaitExit();
      return;
    }

    // Yield to the macrotask queue so that React's scheduler has a chance to
    // fire passive effects and process any work they enqueued.
    await yieldImmediate();

    if (isUnmounted || isUnmounting) {
      await awaitExit();
      return;
    }

    // In concurrent mode, React's scheduler may still be mid-render after
    // the yield. Wait for the next render commit instead of polling.
    if (isConcurrent && hasPendingConcurrentWork()) {
      await Promise.race([awaitNextRender(), awaitExit()]);

      if (isUnmounted || isUnmounting) {
        nextRenderCommit = undefined;
        await awaitExit();
        return;
      }
    }

    reconciler.flushSyncWork();

    const { canWriteToStdout } = getWritableStreamState(options.stdout);

    // Flush pending throttled render/log timers so their output is included in this wait.
    settleThrottle(throttledOnRender, canWriteToStdout);
    settleThrottle(logThrottle, canWriteToStdout);

    if (canWriteToStdout) {
      await new Promise<void>((resolve) => {
        options.stdout.write("", () => {
          resolve();
        });
      });
      return;
    }

    await yieldImmediate();
  }

  function clear(): void {
    if (interactive && !options.debug) {
      log.clear();
      // Sync lastOutput so that unmount's final onRender
      // sees it as unchanged and log-update skips it
      log.sync(lastOutputToRender || lastOutput + "\n");
    }
  }

  function installConsolePatch(): void {
    if (options.debug) {
      return;
    }

    const restoreConsoleMethods = patchConsole((stream, data) => {
      if (options.onCapturedOutput?.(stream, data, "console") === true) {
        return;
      }

      if (stream === "stdout") {
        writeToStdout(data);
      }

      if (stream === "stderr") {
        const isReactMessage = data.startsWith("The above error occurred");

        if (!isReactMessage) {
          writeToStderr(data);
        }
      }
    });

    const restoreDirectStdio = patchDirectStdio();

    restoreConsole = () => {
      restoreConsoleMethods();
      restoreDirectStdio?.();
    };
  }

  // Intercept direct `write` calls on the real streams. Ink renders through
  // passthrough facades, so everything arriving here is external output.
  function patchDirectStdio(): (() => void) | undefined {
    if (!captureTargets) {
      return;
    }

    const restoreStdout = patchStreamWrite(captureTargets.stdout, (data) => {
      handleCapturedStdio("stdout", data);
    });
    const restoreStderr = patchStreamWrite(captureTargets.stderr, (data) => {
      handleCapturedStdio("stderr", data);
    });

    return () => {
      restoreStdout();
      restoreStderr();
    };
  }

  function handleCapturedStdio(stream: "stdout" | "stderr", data: string): void {
    if (options.onCapturedOutput?.(stream, data, "stdio") === true) {
      return;
    }

    // Line-buffer: direct writers emit partial chunks (progress bars,
    // spinners), and only complete lines can be spliced above the live
    // frame without corrupting it. The trailing partial line is held until
    // its newline arrives, or flushed at unmount/suspend.
    const parts = (capturedStdioTails[stream] + data).split(/\r?\n/);
    capturedStdioTails[stream] = parts.pop() ?? "";

    if (parts.length === 0) {
      return;
    }

    const payload = parts.join("\n") + "\n";

    if (stream === "stdout") {
      writeToStdout(payload);
    } else {
      writeToStderr(payload);
    }
  }

  // Display any partial captured lines that never received a newline.
  function flushCapturedStdio(): void {
    for (const stream of ["stdout", "stderr"] as const) {
      const tail = capturedStdioTails[stream];

      if (tail === "") {
        continue;
      }

      capturedStdioTails[stream] = "";

      if (stream === "stdout") {
        writeToStdout(tail + "\n");
      } else {
        writeToStderr(tail + "\n");
      }
    }
  }

  function registerInputControl(pause: () => void, resume: () => void): void {
    pauseInput = pause;
    resumeInput = resume;
  }

  function suspendTerminal(callback: () => void | Promise<void>): Promise<void>;
  function suspendTerminal(): Promise<TerminalSuspension>;
  async function suspendTerminal(
    callback?: () => void | Promise<void>,
  ): Promise<void | TerminalSuspension> {
    beginSuspend();

    if (callback) {
      try {
        await callback();
      } finally {
        await endSuspend();
      }

      return;
    }

    const resume = async (): Promise<void> => {
      await endSuspend();
    };

    return { resume, [Symbol.asyncDispose]: resume };
  }

  function setAlternateScreen(enabled: boolean): void {
    alternateScreen = enabled && interactive && Boolean(options.stdout.isTTY);

    if (alternateScreen) {
      writeBestEffort(options.stdout, ansiEscapes.enterAlternativeScreen);
      writeBestEffort(options.stdout, hideCursorEscape);
    }
  }

  function shouldSync(): boolean {
    // `interactive` already folds in CI detection and the caller's override.
    return Boolean(options.stdout.isTTY) && interactive;
  }

  // Waits for the exit promise to settle, suppressing any rejection.
  // Errors are surfaced via waitUntilExit() instead.
  async function awaitExit(): Promise<void> {
    try {
      await exitPromise;
    } catch {}
  }

  function hasPendingConcurrentWork(): boolean {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const concurrentContainer = container as {
      pendingLanes?: number;
      callbackNode?: unknown;
    };
    return (
      (concurrentContainer.pendingLanes ?? 0) !== 0 &&
      concurrentContainer.callbackNode !== undefined &&
      concurrentContainer.callbackNode !== null
    );
  }

  async function awaitNextRender(): Promise<void> {
    nextRenderCommit ??= Promise.withResolvers<void>();
    return nextRenderCommit.promise;
  }

  function renderInteractiveFrame(
    output: string,
    outputHeight: number,
    staticOutput: string,
  ): void {
    const hasStaticOutput = staticOutput !== "";
    const isTTY = Boolean(options.stdout.isTTY);

    // Detect fullscreen: output fills or exceeds terminal height.
    // Only apply when writing to a real TTY — piped output always gets trailing newlines.
    const viewportRows = isTTY ? getWindowSize(options.stdout).rows : 24;

    // Clamp the frame to the viewport, keeping its bottom rows. Rows above
    // the top margin cannot be updated or erased in place, and the
    // historical fallback for such frames — a full clearTerminal including
    // an ESC[3J scrollback erase — destroys the user's scrollback on every
    // overflowing update. A frame taller than the terminal is unreadable
    // anyway; components size themselves from useWindowSize to avoid it.
    if (isTTY && outputHeight > viewportRows) {
      const lines = output.split("\n");
      output = lines.slice(lines.length - viewportRows).join("\n");
      outputHeight = viewportRows;
    }

    const isFullscreen = isTTY && outputHeight >= viewportRows;
    const outputToRender = isFullscreen ? output : output + "\n";

    const shouldClearTerminal = shouldClearTerminalForFrame({
      isTTY,
      viewportRows,
      previousOutputHeight: lastOutputHeight,
      nextOutputHeight: outputHeight,
      isUnmounting,
    });

    if (shouldClearTerminal) {
      const sync = shouldSync();
      if (sync) {
        options.stdout.write(bsu);
      }

      options.stdout.write(ansiEscapes.clearTerminal + fullStaticOutput + outputToRender);
      lastOutput = output;
      lastOutputToRender = outputToRender;
      lastOutputHeight = outputHeight;
      log.sync(outputToRender);

      if (sync) {
        options.stdout.write(esu);
      }

      return;
    }

    // To ensure static output is cleanly rendered before main output, clear main output first
    if (hasStaticOutput) {
      const sync = shouldSync();
      if (sync) {
        options.stdout.write(bsu);
      }

      log.clear();
      options.stdout.write(staticOutput);
      log(outputToRender);

      if (sync) {
        options.stdout.write(esu);
      }
    } else if (output !== lastOutput || log.isCursorDirty()) {
      // ThrottledLog manages its own bsu/esu at actual write time
      throttledLog(outputToRender);
    }

    lastOutput = output;
    lastOutputToRender = outputToRender;
    lastOutputHeight = outputHeight;
  }

  function initKittyKeyboard(): void {
    // Protocol is opt-in: if kittyKeyboard is not specified, do nothing
    if (!options.kittyKeyboard) {
      return;
    }

    const opts = options.kittyKeyboard;
    const mode = opts.mode ?? "auto";

    if (mode === "disabled") {
      return;
    }

    const flags: KittyFlagName[] = opts.flags ?? ["disambiguateEscapeCodes"];

    // 'enabled' force-enables the protocol as long as both streams are TTYs,
    // regardless of the interactive setting (e.g. even in CI).
    if (mode === "enabled") {
      if (isTty(options.stdin) && options.stdout.isTTY) {
        enableKittyProtocol(flags);
      }

      return;
    }

    // Auto mode: require interactive + TTY
    if (!interactive || !isTty(options.stdin) || !options.stdout.isTTY) {
      return;
    }

    // Auto mode: query the terminal for kitty keyboard protocol support.
    // This avoids maintaining a hardcoded whitelist of terminal names.
    cancelKittyDetection = detectKittySupport(options.stdin, options.stdout, () => {
      cancelKittyDetection = undefined;
      if (!isUnmounted) {
        enableKittyProtocol(flags);
      }
    });
  }

  function enableKittyProtocol(flags: KittyFlagName[]): void {
    options.stdout.write(ansiEscapes.pushKittyKeyboard(resolveFlags(flags)));
    kittyProtocolEnabled = true;
    // Remember the flags so suspendTerminal() can re-enable the same protocol
    // after a child process has had the terminal.
    kittyFlags = flags;
  }

  function beginSuspend(): void {
    if (isSuspended) {
      throw new Error(
        "The terminal is already suspended. Resume the current suspension before suspending again.",
      );
    }

    isSuspended = true;

    if (!interactive || isUnmounted || isUnmounting) {
      return;
    }

    try {
      const { canWriteToStdout } = getWritableStreamState(options.stdout);

      // Flush any pending render/log so the child starts from a settled screen.
      settleThrottle(throttledOnRender, canWriteToStdout);
      settleThrottle(logThrottle, canWriteToStdout);

      if (canWriteToStdout) {
        flushCapturedStdio();
      }

      if (canWriteToStdout) {
        // Erase Ink's current frame, then show the cursor and re-arm the hide.
        // The forced redraw on resume hides the cursor again.
        log.clear();
        log.done();

        if (kittyProtocolEnabled) {
          writeBestEffort(options.stdout, ansiEscapes.popKittyKeyboard);
        }

        if (alternateScreen) {
          writeBestEffort(options.stdout, ansiEscapes.exitAlternativeScreen);
        }
      }

      // Hand input back to the terminal (raw mode off, bracketed paste off).
      pauseInput?.();
    } catch (error) {
      // If handing over the terminal fails partway, don't strand the app in a
      // suspended state with no way back. Best-effort reclaim input, clear the
      // flag, and rethrow so the caller sees the failure.
      isSuspended = false;

      try {
        resumeInput?.();
      } catch {}

      throw error;
    }
  }

  async function endSuspend(): Promise<void> {
    if (!isSuspended) {
      return;
    }

    isSuspended = false;

    // Reclaim input even mid-unmount: pauseInput already ran in beginSuspend, so
    // restoring it is symmetric regardless of any state change during suspension.
    resumeInput?.();

    if (!interactive || isUnmounted || isUnmounting) {
      return;
    }

    const { canWriteToStdout } = getWritableStreamState(options.stdout);

    if (canWriteToStdout) {
      if (alternateScreen) {
        writeBestEffort(options.stdout, ansiEscapes.enterAlternativeScreen);
      }

      if (kittyProtocolEnabled && kittyFlags) {
        writeBestEffort(options.stdout, ansiEscapes.pushKittyKeyboard(resolveFlags(kittyFlags)));
      }
    }

    // Force a full redraw instead of diffing against the stale pre-suspension
    // frame, which the child process may have overwritten. A redraw failure here
    // is best-effort: it must not mask a callback error propagating through the
    // caller's finally block.
    lastOutput = "";
    lastOutputToRender = "";
    lastOutputHeight = 0;
    log.reset();

    try {
      calculateLayout();
      onRender();
      await waitUntilRenderFlush();
    } catch {}
  }

  return {
    render,
    unmount,
    waitUntilExit,
    waitUntilRenderFlush,
    clear,
  };
};
