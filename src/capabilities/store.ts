// A framework-free capabilities store: a snapshot that stays current, an
// explicit way to (re-)ask the terminal, and a subscription for changes.
// This is the public API — the `useCapabilities` React hook is a thin
// wrapper over a store instance.
//
// Subscriptions carry everything the terminal can push at us: resizes
// (stdout `resize` + in-band mode 2048 with pixel geometry), color scheme
// changes (mode 2031 → `CSI ?997;…n` reports), and window focus (mode 1004
// → `CSI I`/`CSI O`). The store enables those modes — the supported subset —
// while it has subscribers and a report feed, and disables them on the last
// unsubscribe and at process exit.
import { CSI, ESC } from "#/ansi/escapes.ts";
import { detectCapabilities, type Capabilities } from "#/capabilities/detect.ts";
import {
  applyTerminalQuery,
  ensureTerminalQuery,
  getTerminalQuery,
  patchTerminalQuery,
  refreshTerminalQuery,
  type TerminalQueryResult,
} from "#/capabilities/query.ts";
import { signalExit } from "#/signal-exit.ts";
import { type OutputStream } from "#/stream.ts";

type QueryRunner = (options?: { refresh?: boolean }) => Promise<TerminalQueryResult | undefined>;

type TerminalIntegration = {
  /**
	Runs queries through the host's input pipeline instead of competing with
	it (Ink: raw mode + detached readable listener).
	*/
  runQuery: QueryRunner;

  /**
	Called when push reporting turns on/off. The host must keep reading stdin
	(and feeding `ingest`) while active — otherwise the enabled reports would
	never be consumed. Ink holds raw mode for the duration.
	*/
  setReportFeed?: (active: boolean) => void;
};

// Ink registers itself here; standalone stores query directly. One
// integration per stdout stream; its presence also marks that a report feed
// exists (the host calls `ingest` for every parsed escape sequence).
const integrations = new WeakMap<object, TerminalIntegration>();

// Lets an integration (un)registration re-evaluate whether push reports
// should be enabled.
const reportingUpdaters = new WeakMap<object, () => void>();

export const registerTerminalIntegration = (
  stdout: object,
  integration: TerminalIntegration,
): (() => void) => {
  integrations.set(stdout, integration);
  reportingUpdaters.get(stdout)?.();
  return () => {
    if (integrations.get(stdout) === integration) {
      integrations.delete(stdout);
      reportingUpdaters.get(stdout)?.();
    }
  };
};

// Unsolicited reports the terminal pushes once the matching mode is enabled.
const focusInReport = `${CSI}I`;
const focusOutReport = `${CSI}O`;
const colorSchemeReport = new RegExp(`^${ESC}\\[\\?997;(\\d+)n$`);
const inBandResizeReport = new RegExp(`^${ESC}\\[48;(\\d+);(\\d+);(\\d+);(\\d+)t$`);

// Mode → whether the query result says the terminal supports it.
const reportModes: Array<[mode: number, supported: (result: TerminalQueryResult) => boolean]> = [
  [1004, (result) => result.focusEvents],
  [2031, (result) => result.colorSchemeUpdates],
  [2048, (result) => result.inBandResize],
];

type StoreStdin = NodeJS.ReadableStream & {
  isTTY?: boolean;
  isRaw?: boolean;
  setRawMode?: (mode: boolean) => void;
};

type StoreStdout = OutputStream;

export type CapabilitiesStore = {
  /**
	The current snapshot: environment-derived detection merged with every
	query answer received so far. Size is always fresh; the object identity
	only changes when something actually changed, so it's safe to compare.
	*/
  readonly current: Capabilities;

  /**
	Asks the terminal. The first call runs the full query; subsequent calls
	re-ask only the dynamic questions (theme colors, pixel geometry) and
	merge over the cached answers. No-op outside a TTY. Resolves with the
	updated snapshot.
	*/
  query: () => Promise<Capabilities>;

  /**
	Subscribes to snapshot changes: query answers arriving, terminal resizes
	(including in-band pixel geometry), color scheme switches, and window
	focus changes. While subscribers exist (and a report feed is available),
	the store enables the supported report modes on the terminal and disables
	them again on the last unsubscribe. Returns an unsubscribe function.
	*/
  subscribe: (
    listener: (capabilities: Capabilities) => void,
    options?: { resizes?: boolean },
  ) => () => void;

  /**
	Feeds one parsed escape sequence from an input pipeline into the store.
	Returns `true` when the sequence was an unsolicited terminal report
	(color scheme, focus, in-band resize) and was consumed. Ink calls this
	for every escape sequence it reads; standalone apps that read stdin
	themselves can forward unrecognized sequences here.
	*/
  ingest: (sequence: string) => boolean;
};

const stores = new WeakMap<object, CapabilitiesStore>();

const createStore = (stdin: StoreStdin, stdout: StoreStdout): CapabilitiesStore => {
  const listeners = new Set<(capabilities: Capabilities) => void>();
  let resizeSubscribers = 0;

  let focused: boolean | undefined;
  let snapshot: Capabilities | undefined;
  let snapshotQuery: TerminalQueryResult | undefined;
  let snapshotColumns: number | undefined;
  let snapshotRows: number | undefined;
  let snapshotFocused: boolean | undefined;

  const current = (): Capabilities => {
    const query = getTerminalQuery(stdout);
    const { columns, rows } = stdout;
    if (
      !snapshot ||
      query !== snapshotQuery ||
      columns !== snapshotColumns ||
      rows !== snapshotRows ||
      focused !== snapshotFocused
    ) {
      const detected = detectCapabilities({ stdout });
      const applied = query ? applyTerminalQuery(detected, query) : detected;
      snapshot = focused === undefined ? applied : { ...applied, focused };
      snapshotQuery = query;
      snapshotColumns = columns;
      snapshotRows = rows;
      snapshotFocused = focused;
    }

    return snapshot;
  };

  let lastNotified: Capabilities | undefined;
  const notify = (): void => {
    const capabilities = current();
    if (capabilities === lastNotified) {
      return;
    }

    lastNotified = capabilities;
    for (const listener of listeners) {
      listener(capabilities);
    }
  };

  // ── Push reports ──────────────────────────────────────────────────────────

  let reportingEnabled = false;
  let removeExitHandler: (() => void) | undefined;

  const enabledModes = (): number[] => {
    const result = getTerminalQuery(stdout);
    if (!result) {
      return [];
    }

    return reportModes.filter(([, supported]) => supported(result)).map(([mode]) => mode);
  };

  const writeModes = (suffix: "h" | "l"): void => {
    const sequence = enabledModes()
      .map((mode) => `${CSI}?${mode}${suffix}`)
      .join("");
    if (sequence.length > 0) {
      try {
        stdout.write(sequence);
      } catch {}
    }
  };

  // Report modes persist in the terminal past our process, so they are only
  // on while someone is listening AND a feed exists to consume the reports
  // (the registered runner — Ink's input pipeline — or the app's own
  // `ingest` calls), and they are always reset at process exit.
  const updateReporting = (): void => {
    const integration = integrations.get(stdout);
    const shouldEnable = listeners.size > 0 && integration !== undefined && stdout.isTTY === true;

    if (shouldEnable && !reportingEnabled && enabledModes().length > 0) {
      reportingEnabled = true;
      // Start the feed before enabling the modes: mode 2048 reports
      // immediately on enable and that report must be consumed.
      integration?.setReportFeed?.(true);
      writeModes("h");
      removeExitHandler = signalExit(() => {
        writeModes("l");
      });
    } else if (!shouldEnable && reportingEnabled) {
      reportingEnabled = false;
      writeModes("l");
      integration?.setReportFeed?.(false);
      removeExitHandler?.();
      removeExitHandler = undefined;
    }
  };

  reportingUpdaters.set(stdout, updateReporting);

  const ingest = (sequence: string): boolean => {
    if (sequence === focusInReport || sequence === focusOutReport) {
      focused = sequence === focusInReport;
      notify();
      return true;
    }

    const colorScheme = sequence.match(colorSchemeReport);
    if (colorScheme) {
      const reported =
        colorScheme[1] === "1" ? "dark" : colorScheme[1] === "2" ? "light" : undefined;
      if (reported) {
        // The report reflects the OS preference; the terminal's own theme
        // follows its background color, which the refresh below re-reads.
        // Only when no background is known does the report stand in for it.
        const cached = getTerminalQuery(stdout);
        patchTerminalQuery(stdout, {
          systemAppearance: reported,
          ...(cached?.background === undefined ? { appearance: reported } : {}),
        });
        notify();
        if (integrations.has(stdout)) {
          void query().catch(() => {});
        }
      }

      return true;
    }

    const resize = sequence.match(inBandResizeReport);
    if (resize) {
      const [, rows, columns, pixelHeight, pixelWidth] = resize.map(Number);
      if (columns && rows) {
        patchTerminalQuery(stdout, {
          textAreaPixels:
            pixelWidth && pixelHeight ? { width: pixelWidth, height: pixelHeight } : undefined,
          cellPixels:
            pixelWidth && pixelHeight
              ? { width: Math.round(pixelWidth / columns), height: Math.round(pixelHeight / rows) }
              : undefined,
        });
      }

      notify();
      return true;
    }

    return false;
  };

  const runStandaloneQuery = async (): Promise<void> => {
    if (!stdout.isTTY || !stdin.isTTY) {
      return;
    }

    // Standalone (no Ink): manage raw mode ourselves so responses arrive
    // unbuffered, restoring the previous state afterwards.
    const wasRaw = stdin.isRaw ?? false;
    if (!wasRaw) {
      stdin.setRawMode?.(true);
    }

    try {
      const refresh = getTerminalQuery(stdout) !== undefined;
      await (refresh ? refreshTerminalQuery(stdin, stdout) : ensureTerminalQuery(stdin, stdout));
    } finally {
      if (!wasRaw) {
        stdin.setRawMode?.(false);
      }
    }
  };

  const query = async (): Promise<Capabilities> => {
    const integration = integrations.get(stdout);
    if (integration) {
      await integration.runQuery({ refresh: getTerminalQuery(stdout) !== undefined });
    } else {
      await runStandaloneQuery();
    }

    notify();
    // The answers may have revealed support for push reports.
    updateReporting();
    return current();
  };

  const onResize = (): void => {
    notify();
  };

  const subscribe = (
    listener: (capabilities: Capabilities) => void,
    options: { resizes?: boolean } = {},
  ): (() => void) => {
    const resizes = options.resizes ?? true;
    if (resizes && resizeSubscribers++ === 0) {
      stdout.on("resize", onResize);
    }

    listeners.add(listener);
    updateReporting();
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      listeners.delete(listener);
      if (resizes && --resizeSubscribers === 0) {
        stdout.removeListener("resize", onResize);
      }
      updateReporting();
    };
  };

  return {
    get current() {
      return current();
    },
    query,
    subscribe,
    ingest,
  };
};

/**
The capabilities store for a stream pair. Stores are cached per stdout, so
standalone code and Ink components observing the same terminal share one
snapshot and one set of query answers.
*/
export const getCapabilities = (
  stdin: StoreStdin = process.stdin,
  stdout: StoreStdout = process.stdout,
): CapabilitiesStore => {
  let store = stores.get(stdout);
  if (!store) {
    store = createStore(stdin, stdout);
    stores.set(stdout, store);
  }

  return store;
};

/**
The process's own terminal — the store for `process.stdin`/`process.stdout`.

```ts
import { capabilities } from "@alchemy.run/sigil/capabilities";

capabilities.current.supports.hyperlinks;
const fresh = await capabilities.query();
const unsubscribe = capabilities.subscribe((caps) => {
  console.log(caps.size, caps.theme.appearance);
});
```
*/
export const capabilities: CapabilitiesStore = getCapabilities();
