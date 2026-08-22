// Terminal color support detection.
// Ported from `supports-color` (MIT, Sindre Sorhus & Josh Junon).
import { isatty } from "node:tty";

import { isWindows } from "#/env.ts";

export type ColorSupportLevel = 0 | 1 | 2 | 3;

export type ColorSupport = {
  readonly level: ColorSupportLevel;
  readonly hasBasic: boolean;
  readonly has256: boolean;
  readonly has16m: boolean;
};

export type ColorInfo = ColorSupport | false;

function hasFlag(flag: string, argv: readonly string[] = process.argv): boolean {
  const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
  const position = argv.indexOf(prefix + flag);
  const terminatorPosition = argv.indexOf("--");
  return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}

const { env } = process;

let flagForceColor: number | undefined;
if (
  hasFlag("no-color") ||
  hasFlag("no-colors") ||
  hasFlag("color=false") ||
  hasFlag("color=never")
) {
  flagForceColor = 0;
} else if (
  hasFlag("color") ||
  hasFlag("colors") ||
  hasFlag("color=true") ||
  hasFlag("color=always")
) {
  flagForceColor = 1;
}

function envForceColor(): number | undefined {
  if (!("FORCE_COLOR" in env)) {
    return;
  }

  if (env["FORCE_COLOR"] === "true") {
    return 1;
  }

  if (env["FORCE_COLOR"] === "false") {
    return 0;
  }

  return env["FORCE_COLOR"]!.length === 0
    ? 1
    : Math.min(Number.parseInt(env["FORCE_COLOR"]!, 10), 3);
}

function translateLevel(level: number): ColorInfo {
  if (level === 0) {
    return false;
  }

  return {
    level: level as ColorSupportLevel,
    hasBasic: true,
    has256: level >= 2,
    has16m: level >= 3,
  };
}

type Options = {
  readonly streamIsTTY?: boolean;
  readonly sniffFlags?: boolean;
};

// eslint-disable-next-line complexity
function supportsColorLevel(
  haveStream: boolean,
  { streamIsTTY, sniffFlags = true }: Options = {},
): number {
  const noFlagForceColor = envForceColor();
  if (noFlagForceColor !== undefined) {
    flagForceColor = noFlagForceColor;
  }

  const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;

  if (forceColor === 0) {
    return 0;
  }

  if (sniffFlags) {
    if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
      return 3;
    }

    if (hasFlag("color=256")) {
      return 2;
    }
  }

  // Check for Azure DevOps pipelines. Has to be above the `!streamIsTTY` check.
  if ("TF_BUILD" in env && "AGENT_NAME" in env) {
    return 1;
  }

  if (haveStream && !streamIsTTY && forceColor === undefined) {
    return 0;
  }

  const min = forceColor ?? 0;

  if (env["TERM"] === "dumb") {
    return min;
  }

  if (isWindows) {
    // Node 22 requires Windows 10 1809+ (build 17763), which supports TrueColor.
    return 3;
  }

  if ("CI" in env) {
    if (["GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI"].some((key) => key in env)) {
      return 3;
    }

    if (
      ["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some((sign) => sign in env) ||
      env["CI_NAME"] === "codeship"
    ) {
      return 1;
    }

    return min;
  }

  if ("TEAMCITY_VERSION" in env) {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env["TEAMCITY_VERSION"]!) ? 1 : 0;
  }

  if (env["COLORTERM"] === "truecolor") {
    return 3;
  }

  if (env["TERM"] === "xterm-kitty") {
    return 3;
  }

  if (env["TERM"] === "xterm-ghostty") {
    return 3;
  }

  if (env["TERM"] === "wezterm") {
    return 3;
  }

  if ("TERM_PROGRAM" in env) {
    const version = Number.parseInt((env["TERM_PROGRAM_VERSION"] ?? "").split(".")[0]!, 10);

    switch (env["TERM_PROGRAM"]) {
      case "iTerm.app": {
        return version >= 3 ? 3 : 2;
      }

      case "Apple_Terminal": {
        return 2;
      }

      default:
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

  return min;
}

export function createSupportsColor(
  stream: { isTTY?: boolean } | undefined,
  options: Options = {},
): ColorInfo {
  const level = supportsColorLevel(Boolean(stream), {
    streamIsTTY: Boolean(stream?.isTTY),
    ...options,
  });

  return translateLevel(level);
}

export const supportsColor = {
  stdout: createSupportsColor({ isTTY: isatty(1) }),
  stderr: createSupportsColor({ isTTY: isatty(2) }),
};
