// Terminal hyperlink (OSC 8) support detection.
// Ported from `supports-hyperlinks` (MIT, James Talmage & Sindre Sorhus),
// trimmed to terminals that matter today.
import { isatty } from "node:tty";

import { createSupportsColor } from "#/ansi/supports-color.ts";

const { env } = process;

const parseVersion = (version: string): { major: number; minor: number } => {
  const [major = 0, minor = 0] = version.split(".").map((part) => Number.parseInt(part, 10));
  return { major: major || 0, minor: minor || 0 };
};

export function createSupportsHyperlinks(stream: { isTTY?: boolean } | undefined): boolean {
  if ("FORCE_HYPERLINK" in env) {
    return !(
      env["FORCE_HYPERLINK"]!.length > 0 && Number.parseInt(env["FORCE_HYPERLINK"]!, 10) === 0
    );
  }

  // No color support is a good proxy for a terminal (or pipe) that would
  // print OSC 8 sequences as garbage rather than ignore them.
  if (createSupportsColor(stream, { sniffFlags: false }) === false) {
    return false;
  }

  if (stream && !stream.isTTY) {
    return false;
  }

  // CI log renderers generally show escape codes literally.
  if ("CI" in env || "TEAMCITY_VERSION" in env) {
    return false;
  }

  // Windows Terminal
  if ("WT_SESSION" in env) {
    return true;
  }

  if (["xterm-kitty", "xterm-ghostty", "wezterm", "alacritty"].includes(env["TERM"] ?? "")) {
    return true;
  }

  // VTE-based terminals (GNOME Terminal, Tilix, …) support OSC 8 since 0.50,
  // but 0.50.0 itself had a crash bug. VTE_VERSION is e.g. "6003" for 0.60.3.
  if ("VTE_VERSION" in env) {
    if (env["VTE_VERSION"] === "0.50.0") {
      return false;
    }

    return Number.parseInt(env["VTE_VERSION"]!, 10) >= 5000;
  }

  if ("TERM_PROGRAM" in env) {
    const { major, minor } = parseVersion(env["TERM_PROGRAM_VERSION"] ?? "");

    switch (env["TERM_PROGRAM"]) {
      case "iTerm.app": {
        return major > 3 || (major === 3 && minor >= 1);
      }

      case "WezTerm":
      case "ghostty": {
        return true;
      }

      case "vscode": {
        return major > 1 || (major === 1 && minor >= 72);
      }

      default:
    }
  }

  return false;
}

export const supportsHyperlinks = {
  get stdout() {
    return createSupportsHyperlinks({ isTTY: isatty(1) });
  },
  get stderr() {
    return createSupportsHyperlinks({ isTTY: isatty(2) });
  },
};
