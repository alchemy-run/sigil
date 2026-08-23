// Asks the terminal the questions the environment can't answer, using the VT
// sequences themselves (see https://ghostty.org/docs/vt/reference) rather
// than environment sniffing: actual colors and theme, mode support via
// DECRQM, truecolor via XTGETTCAP, graphics protocols, pixel geometry via
// XTWINOPS, and the terminal's own name/version via XTVERSION.
//
// All queries are written in one batch, terminated by Primary Device
// Attributes (DA1) — every terminal answers DA1, so its response doubles as
// an "all supported queries have been answered" sentinel (and its parameters
// report capabilities of their own, like sixel). Unanswered queries are
// simply absent from the response stream. A timeout covers terminals (or
// pipes) that never answer at all.
//
// Responses are read from a raw `data` listener with the same discipline as
// `detectKittySupport`: recognized responses are consumed, everything else is
// unshifted back into the stream so user input survives a query in flight.
// A `readable` listener on the same stream stops it flowing and would route
// responses into the input parser as garbage key presses — inside Ink, App
// detaches its input listener for the duration of the query (see
// `internal_queryTerminal`); outside Ink, run this before attaching any
// other stdin consumer.
import { BEL, CSI, ESC, OSC } from "#/ansi/escapes.ts";
import {
  type Capabilities,
  type RgbColor,
  type TerminalAppearance,
} from "#/capabilities/detect.ts";

/**
The DEC private modes queried via DECRQM, by name.
*/
const queriedModes = {
  focusEvents: 1004,
  sgrMouse: 1006,
  sgrPixelMouse: 1016,
  bracketedPaste: 2004,
  synchronizedOutput: 2026,
  graphemeClustering: 2027,
  colorSchemeUpdates: 2031,
  inBandResize: 2048,
} as const;

type QueriedMode = keyof typeof queriedModes;

export type PixelSize = {
  width: number;
  height: number;
};

export type TerminalQueryResult = {
  foreground: RgbColor | undefined;
  background: RgbColor | undefined;
  cursorColor: RgbColor | undefined;

  /**
	The user's 16-color ANSI palette, when the terminal reports it.
	*/
  palette: RgbColor[] | undefined;

  /**
	The terminal's own appearance, derived from the actual background color's
	luminance — a dark terminal theme on a light OS stays "dark". Falls back
	to the OS color scheme report when the background is unknown.
	*/
  appearance: TerminalAppearance | undefined;

  /**
	The operating system's color preference, from the color scheme report
	(`CSI ? 996 n`). Independent of the terminal's own theme.
	*/
  systemAppearance: TerminalAppearance | undefined;

  /**
	The terminal answered the kitty keyboard protocol query.
	*/
  kittyKeyboard: boolean;

  /**
	The terminal answered the kitty graphics protocol probe.
	*/
  kittyGraphics: boolean;

  /**
	The terminal reports sixel graphics in its DA1 device attributes.
	*/
  sixel: boolean;

  /**
	Raw DA1 device attribute parameters, for capabilities not modeled here.
	*/
  deviceAttributes: number[] | undefined;

  /**
	The terminal confirmed truecolor via XTGETTCAP ("RGB").
	*/
  trueColor: boolean;

  /**
	Focus in/out reporting (mode 1004).
	*/
  focusEvents: boolean;

  /**
	SGR mouse reporting (mode 1006).
	*/
  sgrMouse: boolean;

  /**
	SGR pixel-precision mouse reporting (mode 1016).
	*/
  sgrPixelMouse: boolean;

  /**
	Bracketed paste (mode 2004).
	*/
  bracketedPaste: boolean;

  /**
	Synchronized output (mode 2026).
	*/
  synchronizedOutput: boolean;

  /**
	Grapheme cluster width handling (mode 2027).
	*/
  graphemeClustering: boolean;

  /**
	Push notifications of light/dark scheme changes (mode 2031).
	*/
  colorSchemeUpdates: boolean;

  /**
	In-band window resize notifications (mode 2048).
	*/
  inBandResize: boolean;

  /**
	Text area size in pixels (XTWINOPS 14).
	*/
  textAreaPixels: PixelSize | undefined;

  /**
	Size of a single character cell in pixels (XTWINOPS 16).
	*/
  cellPixels: PixelSize | undefined;

  /**
	The terminal's self-reported name and version (XTVERSION).
	*/
  terminal: { raw: string; name: string | undefined; version: string | undefined } | undefined;
};

export type TerminalQueryOptions = {
  /**
	How long to wait for the DA1 sentinel before giving up, in milliseconds.
	*/
  timeout?: number;

  /**
	Also query the 16-color palette (16 extra OSC 4 queries).

	@default true
	*/
  palette?: boolean;

  /**
	Which queries to send. `"full"` asks everything; `"dynamic"` asks only the
	facts that change over a session — colors/theme and pixel geometry — and
	is what `refreshTerminalQuery` uses. Mode support, protocol support, and
	the terminal's identity are static and never need re-asking.

	@default "full"
	*/
  scope?: "full" | "dynamic";
};

const paletteSize = 16;

// 16-bit-per-channel X11 color spec: `rgb:ffff/ffff/ffff` (1-4 hex digits
// per channel), occasionally a plain `#rrggbb`.
export const parseColorValue = (value: string): RgbColor | undefined => {
  if (value.startsWith("rgb:")) {
    const parts = value.slice(4).split("/");
    if (parts.length !== 3) {
      return undefined;
    }

    const channels = parts.map((part) => {
      if (!/^[0-9a-fA-F]{1,4}$/.test(part)) {
        return undefined;
      }

      return Math.round((Number.parseInt(part, 16) / (16 ** part.length - 1)) * 255);
    });

    if (channels.some((channel) => channel === undefined)) {
      return undefined;
    }

    return { r: channels[0]!, g: channels[1]!, b: channels[2]! };
  }

  if (/^#[0-9a-fA-F]{6}$/.test(value)) {
    return {
      r: Number.parseInt(value.slice(1, 3), 16),
      g: Number.parseInt(value.slice(3, 5), 16),
      b: Number.parseInt(value.slice(5, 7), 16),
    };
  }

  return undefined;
};

const appearanceOf = (background: RgbColor | undefined): TerminalAppearance | undefined => {
  if (!background) {
    return undefined;
  }

  const luminance = 0.2126 * background.r + 0.7152 * background.g + 0.0722 * background.b;
  return luminance > 127.5 ? "light" : "dark";
};

// "kitty(0.31.0)", "tmux 3.4", "WezTerm 20230712-072601-f4abf8fd", …
const parseXtversion = (raw: string): NonNullable<TerminalQueryResult["terminal"]> => {
  const match = raw.match(/^(.+?)[(\s]v?(\d[\w.-]*)\)?$/);
  if (!match) {
    return { raw, name: raw.toLowerCase() || undefined, version: undefined };
  }

  return { raw, name: match[1]!.trim().toLowerCase(), version: match[2] };
};

// "RGB" hex-encoded for XTGETTCAP.
const xtgettcapRgb = "524742";

// A 1×1 transparent probe for the kitty graphics protocol; `a=q` asks the
// terminal to answer (with OK or an error) instead of displaying anything.
const kittyGraphicsProbeId = 31;
const kittyGraphicsProbe = `${ESC}_Gi=${kittyGraphicsProbeId},s=1,v=1,a=q,t=d,f=24;AAAA${ESC}\\`;

// Response patterns, built from the shared escape constants. OSC replies may
// terminate with BEL or ST.
const oscColorResponse = new RegExp(
  `${ESC}\\](\\d+);(?:(\\d+);)?([^${BEL}${ESC}]*)(?:${BEL}|${ESC}\\\\)`,
);
const kittyKeyboardResponse = new RegExp(`${ESC}\\[\\?(\\d+)u`);
const decrqmResponse = new RegExp(`${ESC}\\[\\?(\\d+);(\\d+)\\$y`);
const xtversionResponse = new RegExp(`${ESC}P>\\|([^${ESC}]*)${ESC}\\\\`);
const xtgettcapResponse = new RegExp(`${ESC}P([01])\\+r([^${ESC}]*)${ESC}\\\\`);
const kittyGraphicsResponse = new RegExp(`${ESC}_G([^${ESC}]*)${ESC}\\\\`);
const winopsResponse = new RegExp(`${ESC}\\[(4|6);(\\d+);(\\d+)t`);
const colorSchemeResponse = new RegExp(`${ESC}\\[\\?997;(\\d+)n`);
const da1Response = new RegExp(`${ESC}\\[\\?([\\d;]*)c`);

const buildQuery = (palette: boolean, scope: "full" | "dynamic"): string => {
  const queries = [
    `${OSC}10;?${BEL}`, // foreground color
    `${OSC}11;?${BEL}`, // background color
    `${OSC}12;?${BEL}`, // cursor color
  ];

  if (palette) {
    for (let index = 0; index < paletteSize; index++) {
      queries.push(`${OSC}4;${index};?${BEL}`);
    }
  }

  if (scope === "full") {
    for (const mode of Object.values(queriedModes)) {
      queries.push(`${CSI}?${mode}$p`); // DECRQM
    }

    queries.push(
      `${CSI}?u`, // kitty keyboard protocol
      `${ESC}P+q${xtgettcapRgb}${ESC}\\`, // XTGETTCAP "RGB" (truecolor)
      kittyGraphicsProbe,
      `${CSI}>0q`, // XTVERSION
    );
  }

  queries.push(
    `${CSI}14t`, // text area size in pixels
    `${CSI}16t`, // cell size in pixels
    `${CSI}?996n`, // color scheme (light/dark) report
    `${CSI}c`, // DA1 — the sentinel; answered by every terminal
  );

  return queries.join("");
};

/**
Sends a batch of terminal queries and collects the responses. Resolves when
the terminal answers the DA1 sentinel, or after `timeout` with whatever was
gathered. Stdin bytes that are not query responses are pushed back into the
stream.

The query is lazy: nothing is sent until something asks. Inside an Ink app,
use `useCapabilities` — it triggers the query through Ink's input pipeline so
responses can't collide with key handling. Call this directly only outside of
Ink, before any other stdin consumer is attached.
*/
export const queryTerminal = async (
  stdin: NodeJS.ReadableStream,
  stdout: { write: (data: string) => unknown },
  { timeout = 500, palette = true, scope = "full" }: TerminalQueryOptions = {},
): Promise<TerminalQueryResult> =>
  new Promise((resolve) => {
    const result: TerminalQueryResult = {
      foreground: undefined,
      background: undefined,
      cursorColor: undefined,
      palette: undefined,
      appearance: undefined,
      systemAppearance: undefined,
      kittyKeyboard: false,
      kittyGraphics: false,
      sixel: false,
      deviceAttributes: undefined,
      trueColor: false,
      focusEvents: false,
      sgrMouse: false,
      sgrPixelMouse: false,
      bracketedPaste: false,
      synchronizedOutput: false,
      graphemeClustering: false,
      colorSchemeUpdates: false,
      inBandResize: false,
      textAreaPixels: undefined,
      cellPixels: undefined,
      terminal: undefined,
    };
    const paletteColors = new Map<number, RgbColor>();
    let reportedAppearance: TerminalAppearance | undefined;

    let buffer = "";
    // Whether chunks arrive as strings (stream has an encoding set) — the
    // leftover must be unshifted in the same form it was received.
    let receivedStrings = false;
    let done = false;

    const finish = (): void => {
      if (done) {
        return;
      }

      done = true;
      clearTimeout(timer);
      stdin.removeListener("data", onData);

      if (paletteColors.size === paletteSize) {
        result.palette = Array.from({ length: paletteSize }, (_, index) =>
          paletteColors.get(index)!,
        );
      }

      // The actual background color is the truth about the terminal's own
      // theme; the 997 report reflects the OS preference and only fills in
      // when no background color could be read.
      result.systemAppearance = reportedAppearance;
      result.appearance = appearanceOf(result.background) ?? reportedAppearance;

      // Re-emit whatever wasn't a query response so it isn't lost.
      if (buffer.length > 0) {
        stdin.unshift(receivedStrings ? buffer : Buffer.from(buffer, "latin1"));
        buffer = "";
      }

      resolve(result);
    };

    const consumeMatch = (pattern: RegExp): RegExpMatchArray | undefined => {
      const match = buffer.match(pattern);
      if (match) {
        buffer = buffer.replace(pattern, "");
      }

      return match ?? undefined;
    };

    // Consumes the earliest recognized response in the buffer. Returns false
    // when nothing (complete) is left to consume.
    const consumeResponse = (): boolean => {
      const oscMatch = consumeMatch(oscColorResponse);
      if (oscMatch) {
        const [, code, index, value] = oscMatch;
        const color = parseColorValue(value!);
        if (color) {
          if (code === "10") {
            result.foreground = color;
          } else if (code === "11") {
            result.background = color;
          } else if (code === "12") {
            result.cursorColor = color;
          } else if (code === "4" && index !== undefined) {
            paletteColors.set(Number.parseInt(index, 10), color);
          }
        }

        return true;
      }

      const xtversionMatch = consumeMatch(xtversionResponse);
      if (xtversionMatch) {
        const raw = xtversionMatch[1]!.trim();
        if (raw.length > 0) {
          result.terminal = parseXtversion(raw);
        }

        return true;
      }

      const xtgettcapMatch = consumeMatch(xtgettcapResponse);
      if (xtgettcapMatch) {
        // `DCS 1 + r … ST` is success; the RGB capability existing at all
        // means truecolor.
        if (xtgettcapMatch[1] === "1" && xtgettcapMatch[2]!.includes(xtgettcapRgb)) {
          result.trueColor = true;
        }

        return true;
      }

      const graphicsMatch = consumeMatch(kittyGraphicsResponse);
      if (graphicsMatch) {
        if (graphicsMatch[1]!.includes("OK")) {
          result.kittyGraphics = true;
        }

        return true;
      }

      const decrqmMatch = consumeMatch(decrqmResponse);
      if (decrqmMatch) {
        const mode = Number.parseInt(decrqmMatch[1]!, 10);
        // 0 = not recognized; 1-4 = recognized (set/reset/permanently so).
        const recognized = decrqmMatch[2] !== "0";
        for (const [name, number] of Object.entries(queriedModes)) {
          if (number === mode) {
            result[name as QueriedMode] = recognized;
          }
        }

        return true;
      }

      const winopsMatch = consumeMatch(winopsResponse);
      if (winopsMatch) {
        const size: PixelSize = {
          height: Number.parseInt(winopsMatch[2]!, 10),
          width: Number.parseInt(winopsMatch[3]!, 10),
        };
        if (winopsMatch[1] === "4") {
          result.textAreaPixels = size;
        } else {
          result.cellPixels = size;
        }

        return true;
      }

      const colorSchemeMatch = consumeMatch(colorSchemeResponse);
      if (colorSchemeMatch) {
        // 1 = dark, 2 = light.
        if (colorSchemeMatch[1] === "1") {
          reportedAppearance = "dark";
        } else if (colorSchemeMatch[1] === "2") {
          reportedAppearance = "light";
        }

        return true;
      }

      const kittyMatch = consumeMatch(kittyKeyboardResponse);
      if (kittyMatch) {
        result.kittyKeyboard = true;
        return true;
      }

      const da1Match = consumeMatch(da1Response);
      if (da1Match) {
        const attributes = da1Match[1]!
          .split(";")
          .filter((part) => part.length > 0)
          .map((part) => Number.parseInt(part, 10));
        result.deviceAttributes = attributes;
        // The first parameter is the conformance level; the rest are
        // extensions. 4 = sixel graphics.
        result.sixel = attributes.slice(1).includes(4);
        finish();
        return false;
      }

      return false;
    };

    const onData = (data: Uint8Array | string): void => {
      receivedStrings = typeof data === "string";
      buffer += typeof data === "string" ? data : Buffer.from(data).toString("latin1");
      while (consumeResponse()) {
        // Keep consuming until only partial/unrelated bytes remain.
      }
    };

    // Attach before writing so immediate responses aren't missed.
    stdin.on("data", onData);
    const timer = setTimeout(finish, timeout);

    stdout.write(buildQuery(palette, scope));
  });

// One query per terminal is enough — results are cached per stdout stream.
const queryPromises = new WeakMap<object, Promise<TerminalQueryResult>>();
const queryResults = new WeakMap<object, TerminalQueryResult>();

/**
Starts (or joins) the terminal query for a stdout stream. The result is
cached per stream — the terminal is only ever asked once.
*/
export const ensureTerminalQuery = (
  stdin: NodeJS.ReadableStream,
  stdout: { write: (data: string) => unknown },
  options?: TerminalQueryOptions,
): Promise<TerminalQueryResult> => {
  let promise = queryPromises.get(stdout);
  if (!promise) {
    promise = queryTerminal(stdin, stdout, options);
    void promise.then((result) => queryResults.set(stdout, result));
    queryPromises.set(stdout, promise);
  }

  return promise;
};

/**
The completed query result for a stdout stream, if the query has finished.
*/
export const getTerminalQuery = (stdout: object): TerminalQueryResult | undefined =>
  queryResults.get(stdout);

export const getTerminalQueryPromise = (stdout: object): Promise<TerminalQueryResult> | undefined =>
  queryPromises.get(stdout);

/**
Merges a partial update (from an unsolicited terminal report) into the
cached query result. Returns the merged result, or `undefined` when no query
has completed yet.
*/
export const patchTerminalQuery = (
  stdout: object,
  patch: Partial<TerminalQueryResult>,
): TerminalQueryResult | undefined => {
  const previous = queryResults.get(stdout);
  if (!previous) {
    return undefined;
  }

  const merged = { ...previous, ...patch };
  queryResults.set(stdout, merged);
  queryPromises.set(stdout, Promise.resolve(merged));
  return merged;
};

const refreshPromises = new WeakMap<object, Promise<TerminalQueryResult>>();

/**
Re-asks the terminal only the dynamic questions — colors/theme and pixel
geometry, which change when the user switches themes or resizes — and merges
the answers into the cached result. Static facts (mode and protocol support,
identity) are kept from the original query. Falls back to a full query when
none has completed yet; concurrent refreshes share one round-trip.
*/
export const refreshTerminalQuery = (
  stdin: NodeJS.ReadableStream,
  stdout: { write: (data: string) => unknown },
  options?: TerminalQueryOptions,
): Promise<TerminalQueryResult> => {
  const previous = queryResults.get(stdout);
  if (!previous) {
    return ensureTerminalQuery(stdin, stdout, options);
  }

  const inFlight = refreshPromises.get(stdout);
  if (inFlight) {
    return inFlight;
  }

  const promise = queryTerminal(stdin, stdout, { ...options, scope: "dynamic" }).then((fresh) => {
    // An unanswered refresh (e.g. timeout) keeps the previous answers.
    const merged: TerminalQueryResult = {
      ...previous,
      foreground: fresh.foreground ?? previous.foreground,
      background: fresh.background ?? previous.background,
      cursorColor: fresh.cursorColor ?? previous.cursorColor,
      palette: fresh.palette ?? previous.palette,
      appearance: fresh.appearance ?? previous.appearance,
      systemAppearance: fresh.systemAppearance ?? previous.systemAppearance,
      textAreaPixels: fresh.textAreaPixels ?? previous.textAreaPixels,
      cellPixels: fresh.cellPixels ?? previous.cellPixels,
    };
    queryResults.set(stdout, merged);
    queryPromises.set(stdout, Promise.resolve(merged));
    refreshPromises.delete(stdout);
    return merged;
  });
  refreshPromises.set(stdout, promise);
  return promise;
};

/**
Merges an async query result into a synchronous capabilities snapshot,
producing the complete picture. The query is authoritative where it answered:
a terminal that confirms truecolor via XTGETTCAP upgrades the sniffed color
level.
*/
export const applyTerminalQuery = (
  capabilities: Capabilities,
  query: TerminalQueryResult,
): Capabilities => ({
  ...capabilities,
  size: {
    ...capabilities.size,
    pixels:
      query.textAreaPixels || query.cellPixels
        ? { textArea: query.textAreaPixels, cell: query.cellPixels }
        : undefined,
  },
  terminal: {
    ...capabilities.terminal,
    name: query.terminal?.name ?? capabilities.terminal.name,
    version: query.terminal?.version ?? capabilities.terminal.version,
  },
  color: query.trueColor ? { level: 3, depth: 24, trueColor: true } : capabilities.color,
  theme: {
    appearance: query.appearance ?? capabilities.theme.appearance,
    systemAppearance: query.systemAppearance,
    foreground: query.foreground,
    background: query.background,
    cursor: query.cursorColor,
    palette: query.palette,
  },
  supports: {
    ...capabilities.supports,
    color: capabilities.supports.color || query.trueColor,
    kittyKeyboard: query.kittyKeyboard,
    kittyGraphics: query.kittyGraphics,
    sixel: query.sixel,
    focusEvents: query.focusEvents,
    sgrMouse: query.sgrMouse,
    sgrPixelMouse: query.sgrPixelMouse,
    bracketedPaste: query.bracketedPaste,
    synchronizedOutput: query.synchronizedOutput,
    graphemeClustering: query.graphemeClustering,
    colorSchemeUpdates: query.colorSchemeUpdates,
    inBandResize: query.inBandResize,
  },
});
