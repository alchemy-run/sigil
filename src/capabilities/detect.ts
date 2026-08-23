// The single home for environment-derived terminal detection: identity,
// color support, hyperlinks, unicode, and the full synchronous capability
// snapshot. Detection reads environment variables and stream TTY-ness only —
// never argv. Knowledge about specific terminals lives in one table that
// every detector derives from.
//
// Everything here is a fallback opinion: for facts the terminal itself can
// answer, the query in terminal-query.ts is authoritative and overrides
// this via `applyTerminalQuery`.
//
// The color-level ladder is derived from `supports-color` and unicode
// detection from `is-unicode-supported` (both MIT) — see
// THIRD_PARTY_NOTICES.md.
import { isInCi, isScreenReader, isWindows } from "#/env.ts";
import { terminalSize } from "#/terminal-size.ts";

/**
An RGB color with 8-bit channels, as reported by the terminal.
*/
export type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export type TerminalAppearance = "dark" | "light";

export type Multiplexer = "tmux" | "screen" | "zellij";

/**
Color support level: 0 = none, 1 = 16 colors, 2 = 256 colors, 3 = truecolor.
*/
export type ColorSupportLevel = 0 | 1 | 2 | 3;

/**
The chalk-compatible color support shape.
*/
export type ColorSupport = {
  readonly level: ColorSupportLevel;
  readonly hasBasic: boolean;
  readonly has256: boolean;
  readonly has16m: boolean;
};

export type ColorInfo = ColorSupport | false;

export type TerminalIdentity = {
  /**
	Normalized terminal name (`"kitty"`, `"iterm"`, `"wezterm"`, …), or
	`undefined` when unknown. `queryTerminal` can refine this with the
	terminal's own XTVERSION answer.
	*/
  name: string | undefined;

  /**
	The terminal's version, when the environment reports one.
	*/
  version: string | undefined;

  /**
	The raw `TERM` environment variable.
	*/
  term: string | undefined;

  /**
	The multiplexer the app is running under, if any. Note that inside a
	multiplexer, capabilities reflect the multiplexer — not the outer terminal.
	*/
  multiplexer: Multiplexer | undefined;
};

export type PixelGeometry = {
  /**
	Text area size in pixels (XTWINOPS 14).
	*/
  textArea: { width: number; height: number } | undefined;

  /**
	Size of a single character cell in pixels (XTWINOPS 16).
	*/
  cell: { width: number; height: number } | undefined;
};

export type Capabilities = {
  /**
	Current terminal dimensions in cells, plus pixel geometry once the
	terminal has answered the query.
	*/
  size: { columns: number; rows: number; pixels: PixelGeometry | undefined };

  platform: NodeJS.Platform;

  /**
	Running under a CI provider.
	*/
  ci: boolean;

  /**
	Running over an SSH connection.
	*/
  ssh: boolean;

  screenReader: boolean;

  /**
	Same detection `render()` uses: stdout is a TTY and not CI.
	*/
  interactive: boolean;

  /**
	Whether the terminal window has focus. Requires focus events (mode 1004),
	which the capabilities store enables automatically while it has
	subscribers; `undefined` until the first focus report arrives.
	*/
  focused: boolean | undefined;

  terminal: TerminalIdentity;

  color: {
    level: ColorSupportLevel;

    /**
		The same fact as bits per color: 1, 4, 8, or 24.
		*/
    depth: 1 | 4 | 8 | 24;

    trueColor: boolean;
  };

  theme: {
    /**
		The terminal's own appearance. After `queryTerminal` this is derived
		from the actual background color's luminance (a dark terminal theme on
		a light OS stays `"dark"`); before that it's a `COLORFGBG` guess.
		*/
    appearance: TerminalAppearance | undefined;

    /**
		The operating system's color preference, from the color scheme report.
		Independent of the terminal's own theme — only available after
		`queryTerminal` on terminals that support the report.
		*/
    systemAppearance: TerminalAppearance | undefined;

    /**
		The user's configured foreground/background/cursor colors and 16-color
		palette. Only available after `queryTerminal`.
		*/
    foreground: RgbColor | undefined;
    background: RgbColor | undefined;
    cursor: RgbColor | undefined;
    palette: RgbColor[] | undefined;
  };

  /**
	Feature support. Fields typed `boolean | undefined` are only knowable by
	asking the terminal — they stay `undefined` until `queryTerminal` has
	answered (see `TerminalQueryResult` for what each means).
	*/
  supports: {
    color: boolean;
    hyperlinks: boolean;
    unicode: boolean;
    alternateScreen: boolean;
    kittyKeyboard: boolean | undefined;
    kittyGraphics: boolean | undefined;
    sixel: boolean | undefined;
    focusEvents: boolean | undefined;
    sgrMouse: boolean | undefined;
    sgrPixelMouse: boolean | undefined;
    bracketedPaste: boolean | undefined;
    synchronizedOutput: boolean | undefined;
    graphemeClustering: boolean | undefined;
    colorSchemeUpdates: boolean | undefined;
    inBandResize: boolean | undefined;
  };
};

const { env } = process;

// ── Terminal knowledge ──────────────────────────────────────────────────────
// The one table every detector derives from. A terminal appears here once;
// color, hyperlink, and unicode detection all consult the same entry.

type TerminalKnowledge = {
  /**
	Supports 24-bit color.
	*/
  trueColor?: boolean;

  /**
	Maximum color level for terminals without truecolor.
	*/
  colorLevel?: ColorSupportLevel;

  /**
	OSC 8 hyperlinks: supported outright, or since a specific version.
	*/
  hyperlinks?: true | { since: [major: number, minor: number] };
};

const terminalKnowledge: Record<string, TerminalKnowledge> = {
  iterm: { trueColor: true, hyperlinks: { since: [3, 1] } },
  "apple-terminal": { colorLevel: 2 },
  wezterm: { trueColor: true, hyperlinks: true },
  vscode: { trueColor: true, hyperlinks: { since: [1, 72] } },
  ghostty: { trueColor: true, hyperlinks: true },
  kitty: { trueColor: true, hyperlinks: true },
  alacritty: { trueColor: true, hyperlinks: true },
  foot: { trueColor: true, hyperlinks: true },
  contour: { trueColor: true, hyperlinks: true },
  "windows-terminal": { trueColor: true, hyperlinks: true },
  konsole: { trueColor: true, hyperlinks: true },
  vte: { trueColor: true, hyperlinks: { since: [0, 50] } },
  hyper: { trueColor: true },
  tabby: { trueColor: true, hyperlinks: true },
  rio: { trueColor: true, hyperlinks: true },
};

// Maps TERM_PROGRAM values to normalized names.
const termProgramNames: Record<string, string> = {
  "iTerm.app": "iterm",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Apple_Terminal: "apple-terminal",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  WezTerm: "wezterm",
  vscode: "vscode",
  ghostty: "ghostty",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Hyper: "hyper",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Tabby: "tabby",
  rio: "rio",
};

// Maps TERM values that identify a specific terminal (rather than a generic
// terminfo entry) to normalized names.
const termNames: Record<string, string> = {
  "xterm-kitty": "kitty",
  "xterm-ghostty": "ghostty",
  alacritty: "alacritty",
  wezterm: "wezterm",
  foot: "foot",
  contour: "contour",
};

// VTE_VERSION is a plain number like "7802" meaning 0.78.2.
const parseVteVersion = (raw: string): string | undefined => {
  const numeric = Number.parseInt(raw, 10);
  if (Number.isNaN(numeric)) {
    return undefined;
  }

  return `${Math.floor(numeric / 10_000)}.${Math.floor(numeric / 100) % 100}.${numeric % 100}`;
};

const versionAtLeast = (version: string | undefined, [major, minor]: [number, number]): boolean => {
  if (!version) {
    return false;
  }

  const [haveMajor = 0, haveMinor = 0] = version
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  return haveMajor > major || (haveMajor === major && haveMinor >= minor);
};

export function detectTerminal(): TerminalIdentity {
  const term = env["TERM"];

  let multiplexer: Multiplexer | undefined;
  if ("TMUX" in env || env["TERM_PROGRAM"] === "tmux") {
    multiplexer = "tmux";
  } else if ("ZELLIJ" in env) {
    multiplexer = "zellij";
  } else if (term?.startsWith("screen")) {
    multiplexer = "screen";
  }

  let name: string | undefined;
  let version: string | undefined;

  const termProgram = env["TERM_PROGRAM"];
  if (termProgram && termProgram !== "tmux" && termProgram in termProgramNames) {
    name = termProgramNames[termProgram];
    version = env["TERM_PROGRAM_VERSION"];
  } else if (term && term in termNames) {
    name = termNames[term];
  } else if ("WT_SESSION" in env) {
    name = "windows-terminal";
  } else if ("KONSOLE_VERSION" in env) {
    name = "konsole";
    version = env["KONSOLE_VERSION"];
  } else if ("VTE_VERSION" in env) {
    // GNOME Terminal, Tilix, and other libvte terminals.
    name = "vte";
    version = parseVteVersion(env["VTE_VERSION"]!);
  }

  return { name, version, term, multiplexer };
}

const knowledgeOf = (identity: TerminalIdentity): TerminalKnowledge | undefined =>
  identity.name === undefined ? undefined : terminalKnowledge[identity.name];

// ── Color ───────────────────────────────────────────────────────────────────

type DetectStream = {
  isTTY?: boolean;
};

const forcedColorLevel = (): ColorSupportLevel | undefined => {
  const forced = env["FORCE_COLOR"];
  if (forced === undefined) {
    return undefined;
  }

  if (forced === "true" || forced.length === 0) {
    return 1;
  }

  if (forced === "false") {
    return 0;
  }

  return Math.min(Math.max(Number.parseInt(forced, 10) || 0, 0), 3) as ColorSupportLevel;
};

/**
Detects the color support level for a stream from the environment. Purely
env-derived — the terminal query can upgrade this to truecolor when the
terminal confirms it via XTGETTCAP.
*/
export function detectColorLevel(stream?: DetectStream): ColorSupportLevel {
  const forced = forcedColorLevel();
  if (forced === 0) {
    return 0;
  }

  // Azure DevOps pipelines are colorful but not TTYs; check before the
  // stream gate.
  if (env["TF_BUILD"] && env["AGENT_NAME"]) {
    return 1;
  }

  if (stream && !stream.isTTY && forced === undefined) {
    return 0;
  }

  const minimum = forced ?? 0;

  if (env["TERM"] === "dumb") {
    return minimum;
  }

  if (isWindows) {
    // Node 22 requires Windows 10 1809+, which supports truecolor.
    return 3;
  }

  // An empty CI variable means "not CI" (`CI= cmd` and harness spawns), the
  // same convention `isInCi` uses — presence alone must not kill colors.
  if (env["CI"]) {
    if (["GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI"].some((key) => key in env)) {
      return 3;
    }

    if (
      ["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some((key) => key in env) ||
      env["CI_NAME"] === "codeship"
    ) {
      return 1;
    }

    return minimum;
  }

  if (env["TEAMCITY_VERSION"]) {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env["TEAMCITY_VERSION"]) ? 1 : 0;
  }

  if (env["COLORTERM"] === "truecolor") {
    return 3;
  }

  const knowledge = knowledgeOf(detectTerminal());
  if (knowledge) {
    if (knowledge.trueColor) {
      return 3;
    }

    if (knowledge.colorLevel !== undefined) {
      return knowledge.colorLevel;
    }
  }

  if (/-256(color)?$/i.test(env["TERM"] ?? "")) {
    return 2;
  }

  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env["TERM"] ?? "")) {
    return 1;
  }

  if ("COLORTERM" in env) {
    return 1;
  }

  return minimum;
}

/**
The color level in chalk's `ColorInfo` shape.
*/
export function createSupportsColor(stream?: DetectStream): ColorInfo {
  const level = detectColorLevel(stream);
  if (level === 0) {
    return false;
  }

  return {
    level,
    hasBasic: true,
    has256: level >= 2,
    has16m: level >= 3,
  };
}

// ── Hyperlinks ──────────────────────────────────────────────────────────────

/**
Detects OSC 8 hyperlink support for a stream from the environment.
*/
export function detectHyperlinkSupport(stream?: DetectStream): boolean {
  if ("FORCE_HYPERLINK" in env) {
    return !(
      env["FORCE_HYPERLINK"]!.length > 0 && Number.parseInt(env["FORCE_HYPERLINK"]!, 10) === 0
    );
  }

  // No color support is a good proxy for a terminal (or pipe) that would
  // print OSC 8 sequences as garbage rather than ignore them.
  if (detectColorLevel(stream) === 0) {
    return false;
  }

  if (stream && !stream.isTTY) {
    return false;
  }

  // CI log renderers generally show escape codes literally.
  if (env["CI"] || env["TEAMCITY_VERSION"]) {
    return false;
  }

  const identity = detectTerminal();
  const hyperlinks = knowledgeOf(identity)?.hyperlinks;
  if (hyperlinks === true) {
    return true;
  }

  if (hyperlinks) {
    return versionAtLeast(identity.version, hyperlinks.since);
  }

  return false;
}

// ── Unicode ─────────────────────────────────────────────────────────────────

/**
Detects whether the terminal renders unicode reliably.
*/
export function detectUnicodeSupport(): boolean {
  if (process.platform !== "win32") {
    // The Linux console (kernel tty) is the lone holdout.
    return env["TERM"] !== "linux";
  }

  const { name } = detectTerminal();
  return (
    name === "windows-terminal" ||
    name === "vscode" ||
    name === "alacritty" ||
    Boolean(env["TERMINUS_SUBLIME"]) ||
    env["ConEmuTask"] === "{cmd::Cmder}" ||
    env["TERM_PROGRAM"] === "Terminus-Sublime" ||
    env["TERM"] === "xterm-256color" ||
    env["TERMINAL_EMULATOR"] === "JetBrains-JediTerm"
  );
}

// ── Capability snapshot ─────────────────────────────────────────────────────

// COLORFGBG looks like "15;0" (foreground;background) using 16-color palette
// indices. Only 7 and 15 are light backgrounds.
const appearanceFromColorFgBg = (): TerminalAppearance | undefined => {
  const parts = env["COLORFGBG"]?.split(";");
  const background = parts?.at(-1);
  if (!background || Number.isNaN(Number.parseInt(background, 10))) {
    return undefined;
  }

  return background === "7" || background === "15" ? "light" : "dark";
};

const colorDepths: Record<ColorSupportLevel, 1 | 4 | 8 | 24> = { 0: 1, 1: 4, 2: 8, 3: 24 };

type CapabilityStdout = DetectStream & {
  columns?: number;
  rows?: number;
};

type DetectOptions = {
  stdout?: CapabilityStdout;
};

type StaticCapabilities = Omit<Capabilities, "size" | "theme" | "focused">;

// Environment and terminal identity don't change over a process's lifetime;
// only size and theme are dynamic. Keyed by stream since TTY-ness (and
// therefore color/hyperlink support) is per-stream.
const staticCache = new WeakMap<object, StaticCapabilities>();

const computeStatic = (stdout: CapabilityStdout): StaticCapabilities => {
  const level = detectColorLevel(stdout);
  const interactive = !isInCi && Boolean(stdout.isTTY);

  return {
    platform: process.platform,
    ci: isInCi,
    ssh: "SSH_CONNECTION" in env || "SSH_CLIENT" in env || "SSH_TTY" in env,
    screenReader: isScreenReader,
    interactive,
    terminal: detectTerminal(),
    color: {
      level,
      depth: colorDepths[level],
      trueColor: level === 3,
    },
    supports: {
      color: level > 0,
      hyperlinks: detectHyperlinkSupport(stdout),
      unicode: detectUnicodeSupport(),
      alternateScreen: interactive && env["TERM"] !== "dumb",
      kittyKeyboard: undefined,
      kittyGraphics: undefined,
      sixel: undefined,
      focusEvents: undefined,
      sgrMouse: undefined,
      sgrPixelMouse: undefined,
      bracketedPaste: undefined,
      synchronizedOutput: undefined,
      graphemeClustering: undefined,
      colorSchemeUpdates: undefined,
      inBandResize: undefined,
    },
  };
};

/**
Takes a snapshot of everything knowable about the terminal from streams and
environment variables. The environment-derived parts are computed once per
stream and cached; size and theme are read fresh on every call. Fields that
require asking the terminal itself start as `undefined` — run `queryTerminal`
and merge with `applyTerminalQuery` to fill them in, or use the
`useCapabilities` hook which does both.
*/
export function detectCapabilities({ stdout = process.stdout }: DetectOptions = {}): Capabilities {
  let staticParts = staticCache.get(stdout);
  if (!staticParts) {
    staticParts = computeStatic(stdout);
    staticCache.set(stdout, staticParts);
  }

  return {
    ...staticParts,
    size: {
      ...(stdout.columns && stdout.rows
        ? { columns: stdout.columns, rows: stdout.rows }
        : terminalSize()),
      pixels: undefined,
    },
    focused: undefined,
    theme: {
      appearance: appearanceFromColorFgBg(),
      systemAppearance: undefined,
      foreground: undefined,
      background: undefined,
      cursor: undefined,
      palette: undefined,
    },
  };
}
