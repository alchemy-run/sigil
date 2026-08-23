import { setTimeout as delay } from "node:timers/promises";

import { afterEach, describe, expect, test, vi, type Mock } from "vite-plus/test";

import { BEL, CSI, ESC, OSC } from "#/ansi/escapes.ts";
import {
  detectCapabilities,
  detectColorLevel,
  detectTerminal,
  detectUnicodeSupport,
} from "#/capabilities/detect.ts";
import {
  ensureTerminalQuery,
  parseColorValue,
  queryTerminal,
  refreshTerminalQuery,
} from "#/capabilities/query.ts";
import { getCapabilities, registerTerminalIntegration } from "#/capabilities/store.ts";
import { render, Text, useCapabilities, useCapabilitiesChange, useInput } from "#/index.ts";

import { createStdin, emitReadable, type FakeStdin } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";

const ST = `${ESC}\\`;

afterEach(() => {
  vi.unstubAllEnvs();
});

const stubCleanEnv = () => {
  for (const key of [
    "TERM",
    "TERM_PROGRAM",
    "TERM_PROGRAM_VERSION",
    "TMUX",
    "ZELLIJ",
    "WT_SESSION",
    "KONSOLE_VERSION",
    "VTE_VERSION",
    "SSH_CONNECTION",
    "SSH_CLIENT",
    "SSH_TTY",
    "COLORFGBG",
  ]) {
    vi.stubEnv(key, undefined);
  }
};

describe("detectTerminal", () => {
  test("identifies terminals from TERM_PROGRAM with version", () => {
    stubCleanEnv();
    vi.stubEnv("TERM_PROGRAM", "iTerm.app");
    vi.stubEnv("TERM_PROGRAM_VERSION", "3.5.14");

    expect(detectTerminal()).toMatchObject({ name: "iterm", version: "3.5.14" });
  });

  test("identifies terminals from TERM", () => {
    stubCleanEnv();
    vi.stubEnv("TERM", "xterm-kitty");

    expect(detectTerminal()).toMatchObject({ name: "kitty", term: "xterm-kitty" });
  });

  test("detects multiplexers and does not mistake tmux for a terminal", () => {
    stubCleanEnv();
    vi.stubEnv("TMUX", "/tmp/tmux-1000/default,1234,0");
    vi.stubEnv("TERM_PROGRAM", "tmux");

    const identity = detectTerminal();
    expect(identity.multiplexer).toBe("tmux");
    expect(identity.name).toBeUndefined();

    stubCleanEnv();
    vi.stubEnv("TERM", "screen-256color");
    expect(detectTerminal().multiplexer).toBe("screen");

    stubCleanEnv();
    vi.stubEnv("ZELLIJ", "0");
    expect(detectTerminal().multiplexer).toBe("zellij");
  });

  test("falls back to VTE detection, normalizing the numeric version", () => {
    stubCleanEnv();
    vi.stubEnv("TERM", "xterm-256color");
    vi.stubEnv("VTE_VERSION", "7802");

    expect(detectTerminal()).toMatchObject({ name: "vte", version: "0.78.2" });
  });
});

describe("detectCapabilities", () => {
  test("reads size from the given stdout", () => {
    const stdout = createStdout(120, true, 40);

    expect(detectCapabilities({ stdout }).size).toEqual({ columns: 120, rows: 40 });
  });

  test("detects SSH sessions", () => {
    // Static detection is cached per stream, so each env change needs a
    // fresh stream to be observed.
    stubCleanEnv();
    expect(detectCapabilities({ stdout: createStdout() }).ssh).toBe(false);

    vi.stubEnv("SSH_CONNECTION", "1.2.3.4 5678 5.6.7.8 22");
    expect(detectCapabilities({ stdout: createStdout() }).ssh).toBe(true);
  });

  test("caches the static parts per stream", () => {
    stubCleanEnv();
    const stdout = createStdout();
    expect(detectCapabilities({ stdout }).ssh).toBe(false);

    // Same stream: the cached snapshot wins even though the env changed…
    vi.stubEnv("SSH_CONNECTION", "1.2.3.4 5678 5.6.7.8 22");
    expect(detectCapabilities({ stdout }).ssh).toBe(false);

    // …while the theme guess is dynamic and reads fresh.
    vi.stubEnv("COLORFGBG", "0;15");
    expect(detectCapabilities({ stdout }).theme.appearance).toBe("light");
  });

  test("guesses the theme from COLORFGBG", () => {
    stubCleanEnv();
    expect(detectCapabilities().theme.appearance).toBeUndefined();

    vi.stubEnv("COLORFGBG", "15;0");
    expect(detectCapabilities().theme.appearance).toBe("dark");

    vi.stubEnv("COLORFGBG", "0;15");
    expect(detectCapabilities().theme.appearance).toBe("light");
  });

  test("maps color level to depth", () => {
    vi.stubEnv("FORCE_COLOR", "3");
    const capabilities = detectCapabilities({ stdout: createStdout() });
    expect(capabilities.color).toEqual({ level: 3, depth: 24, trueColor: true });

    vi.stubEnv("FORCE_COLOR", "0");
    const colorless = detectCapabilities({ stdout: createStdout() });
    expect(colorless.color).toEqual({ level: 0, depth: 1, trueColor: false });
    expect(colorless.supports.color).toBe(false);
  });

  test("query-only fields start undefined", () => {
    const capabilities = detectCapabilities({ stdout: createStdout() });
    expect(capabilities.supports.kittyKeyboard).toBeUndefined();
    expect(capabilities.supports.synchronizedOutput).toBeUndefined();
    expect(capabilities.theme.background).toBeUndefined();
  });
});

describe("detectColorLevel", () => {
  const stubColorCleanEnv = () => {
    stubCleanEnv();
    for (const key of ["FORCE_COLOR", "CI", "COLORTERM", "TF_BUILD", "TEAMCITY_VERSION"]) {
      vi.stubEnv(key, undefined);
    }
  };

  test("derives truecolor from the terminal knowledge table", () => {
    if (process.platform === "win32") {
      return;
    }

    stubColorCleanEnv();
    vi.stubEnv("TERM", "xterm-kitty");
    expect(detectColorLevel({ isTTY: true })).toBe(3);

    stubColorCleanEnv();
    vi.stubEnv("TERM", "xterm");
    vi.stubEnv("TERM_PROGRAM", "Apple_Terminal");
    expect(detectColorLevel({ isTTY: true })).toBe(2);

    stubColorCleanEnv();
    vi.stubEnv("TERM", "xterm-256color");
    expect(detectColorLevel({ isTTY: true })).toBe(2);

    stubColorCleanEnv();
    vi.stubEnv("TERM", "xterm");
    expect(detectColorLevel({ isTTY: true })).toBe(1);
  });

  test("non-TTY streams get no color without FORCE_COLOR", () => {
    stubColorCleanEnv();
    vi.stubEnv("TERM", "xterm-kitty");
    expect(detectColorLevel({ isTTY: false })).toBe(0);

    vi.stubEnv("FORCE_COLOR", "2");
    expect(detectColorLevel({ isTTY: false })).toBe(3);
  });
});

describe("detectUnicodeSupport", () => {
  test("everything but the Linux console supports unicode off-Windows", () => {
    if (process.platform === "win32") {
      return;
    }

    stubCleanEnv();
    vi.stubEnv("TERM", "xterm-256color");
    expect(detectUnicodeSupport()).toBe(true);

    vi.stubEnv("TERM", "linux");
    expect(detectUnicodeSupport()).toBe(false);
  });
});

describe("parseColorValue", () => {
  test("parses X11 rgb specs at any channel width", () => {
    expect(parseColorValue("rgb:ff/00/80")).toEqual({ r: 255, g: 0, b: 128 });
    expect(parseColorValue("rgb:ffff/0000/8080")).toEqual({ r: 255, g: 0, b: 128 });
    expect(parseColorValue("rgb:f/0/8")).toEqual({ r: 255, g: 0, b: 136 });
  });

  test("parses hex colors", () => {
    expect(parseColorValue("#1e1e2e")).toEqual({ r: 30, g: 30, b: 46 });
  });

  test("rejects malformed values", () => {
    expect(parseColorValue("rgb:zz/00/00")).toBeUndefined();
    expect(parseColorValue("nonsense")).toBeUndefined();
  });
});

type QueryStdin = Omit<FakeStdin, "unshift"> & {
  unshift: Mock<(chunk: unknown, encoding?: BufferEncoding) => void>;
};

const createQueryStdin = (): QueryStdin => {
  const stdin = createStdin() as unknown as QueryStdin;
  stdin.unshift = vi.fn();
  return stdin;
};

describe("queryTerminal", () => {
  test("parses a full response set", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();

    const promise = queryTerminal(stdin, stdout, { palette: false });

    // The query batch went out.
    expect(stdout.get()).toContain(`${CSI}c`);

    stdin.emit(
      "data",
      [
        `${OSC}10;rgb:ffff/ffff/ffff${BEL}`,
        `${OSC}11;rgb:0000/0000/0000${ST}`,
        `${CSI}?1u`,
        `${CSI}?2026;2$y`,
        `${ESC}P>|ghostty 1.2.0${ST}`,
        `${CSI}?62;4c`,
      ].join(""),
    );

    const result = await promise;
    expect(result.foreground).toEqual({ r: 255, g: 255, b: 255 });
    expect(result.background).toEqual({ r: 0, g: 0, b: 0 });
    expect(result.appearance).toBe("dark");
    expect(result.kittyKeyboard).toBe(true);
    expect(result.synchronizedOutput).toBe(true);
    expect(result.terminal).toEqual({ raw: "ghostty 1.2.0", name: "ghostty", version: "1.2.0" });
    expect(stdin.unshift).not.toHaveBeenCalled();
  });

  test("collects the palette", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();

    const promise = queryTerminal(stdin, stdout);

    const responses = Array.from(
      { length: 16 },
      (_, index) => `${OSC}4;${index};rgb:0${index.toString(16)}/00/00${BEL}`,
    );
    stdin.emit("data", responses.join("") + `${CSI}?62c`);

    const result = await promise;
    expect(result.palette).toHaveLength(16);
    expect(result.palette![1]).toEqual({ r: 1, g: 0, b: 0 });
    expect(result.palette![15]).toEqual({ r: 15, g: 0, b: 0 });
  });

  test("handles responses split across chunks", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();

    const promise = queryTerminal(stdin, stdout, { palette: false });

    const full = `${OSC}11;rgb:ffff/ffff/ffff${BEL}${CSI}?62c`;
    stdin.emit("data", full.slice(0, 9));
    stdin.emit("data", full.slice(9));

    const result = await promise;
    expect(result.background).toEqual({ r: 255, g: 255, b: 255 });
    expect(result.appearance).toBe("light");
  });

  test("re-emits user input mixed into the response stream", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();

    const promise = queryTerminal(stdin, stdout, { palette: false });

    stdin.emit("data", `hel${CSI}?1u` + `lo${CSI}?62c`);

    const result = await promise;
    expect(result.kittyKeyboard).toBe(true);
    expect(stdin.unshift).toHaveBeenCalledWith("hello");
  });

  test("resolves with defaults on timeout", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();

    const result = await queryTerminal(stdin, stdout, { timeout: 20 });

    expect(result.kittyKeyboard).toBe(false);
    expect(result.synchronizedOutput).toBe(false);
    expect(result.background).toBeUndefined();
    expect(result.appearance).toBeUndefined();
  });

  test("parses the extended capability responses", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();

    const promise = queryTerminal(stdin, stdout, { palette: false });

    // The batch asks for cursor color, DECRQM modes, XTGETTCAP, the kitty
    // graphics probe, pixel geometry, and the color scheme.
    const written = stdout.get();
    expect(written).toContain(`${OSC}12;?${BEL}`);
    expect(written).toContain(`${CSI}?2027$p`);
    expect(written).toContain(`${ESC}P+q524742${ESC}\\`);
    expect(written).toContain(`${CSI}14t`);
    expect(written).toContain(`${CSI}?996n`);

    stdin.emit(
      "data",
      [
        `${OSC}12;rgb:ffff/0000/0000${BEL}`, // cursor color
        `${CSI}?2004;1$y`, // bracketed paste
        `${CSI}?2027;2$y`, // grapheme clustering
        `${CSI}?2031;0$y`, // color scheme updates NOT recognized
        `${CSI}?2048;2$y`, // in-band resize
        `${CSI}?1006;2$y`, // SGR mouse
        `${ESC}P1+r524742${ESC}\\`, // XTGETTCAP: truecolor confirmed
        `${ESC}_Gi=31;OK${ESC}\\`, // kitty graphics probe answered
        `${CSI}4;1044;1712t`, // text area pixels
        `${CSI}6;29;16t`, // cell pixels
        `${CSI}?997;2n`, // color scheme: light
        `${CSI}?62;4;22c`, // DA1 with sixel (4)
      ].join(""),
    );

    const result = await promise;
    expect(result.cursorColor).toEqual({ r: 255, g: 0, b: 0 });
    expect(result.bracketedPaste).toBe(true);
    expect(result.graphemeClustering).toBe(true);
    expect(result.colorSchemeUpdates).toBe(false);
    expect(result.inBandResize).toBe(true);
    expect(result.sgrMouse).toBe(true);
    expect(result.sgrPixelMouse).toBe(false);
    expect(result.trueColor).toBe(true);
    expect(result.kittyGraphics).toBe(true);
    expect(result.textAreaPixels).toEqual({ width: 1712, height: 1044 });
    expect(result.cellPixels).toEqual({ width: 16, height: 29 });
    expect(result.appearance).toBe("light");
    expect(result.sixel).toBe(true);
    expect(result.deviceAttributes).toEqual([62, 4, 22]);
  });

  test("background luminance beats the OS color scheme report", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();

    const promise = queryTerminal(stdin, stdout, { palette: false });

    // A light terminal background while the OS reports dark mode — a light
    // terminal theme on a dark OS. The terminal's own colors are the truth;
    // the report is surfaced separately.
    stdin.emit("data", `${OSC}11;rgb:ffff/ffff/ffff${BEL}${CSI}?997;1n${CSI}?62c`);

    const result = await promise;
    expect(result.appearance).toBe("light");
    expect(result.systemAppearance).toBe("dark");
  });

  test("the OS report stands in when no background color is available", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();

    const promise = queryTerminal(stdin, stdout, { palette: false });

    stdin.emit("data", `${CSI}?997;1n${CSI}?62c`);

    const result = await promise;
    expect(result.appearance).toBe("dark");
    expect(result.systemAppearance).toBe("dark");
  });

  test("a failed XTGETTCAP reply does not claim truecolor", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();

    const promise = queryTerminal(stdin, stdout, { palette: false });

    stdin.emit("data", `${ESC}P0+r${ESC}\\${CSI}?1c`);

    const result = await promise;
    expect(result.trueColor).toBe(false);
    expect(result.sixel).toBe(false);
  });

  test("ignores queries the terminal does not answer", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();

    const promise = queryTerminal(stdin, stdout, { palette: false });

    // Only DA1 answered — an old terminal.
    stdin.emit("data", `${CSI}?1;2c`);

    const result = await promise;
    expect(result.kittyKeyboard).toBe(false);
    expect(result.terminal).toBeUndefined();
  });
});

describe("refreshTerminalQuery", () => {
  test("dynamic scope only asks the dynamic questions", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();

    const promise = queryTerminal(stdin, stdout, { palette: false, scope: "dynamic" });

    const written = stdout.get();
    expect(written).toContain(`${OSC}11;?${BEL}`);
    expect(written).toContain(`${CSI}?996n`);
    expect(written).toContain(`${CSI}c`);
    expect(written).not.toContain("$p"); // no DECRQM
    expect(written).not.toContain(`${CSI}?u`); // no kitty keyboard
    expect(written).not.toContain(`${ESC}P+q`); // no XTGETTCAP

    stdin.emit("data", `${CSI}?62c`);
    await promise;
  });

  test("re-asks theme and merges over the cached result", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();

    // Full query first: dark theme, kitty keyboard supported.
    const fullPromise = ensureTerminalQuery(stdin, stdout, { palette: false });
    stdin.emit("data", `${OSC}11;rgb:0000/0000/0000${BEL}${CSI}?1u${CSI}?62c`);
    const full = await fullPromise;
    expect(full.appearance).toBe("dark");
    expect(full.kittyKeyboard).toBe(true);

    // The user switched to a light theme; a refresh sees it while keeping
    // the static facts.
    const refreshPromise = refreshTerminalQuery(stdin, stdout, { palette: false });
    stdin.emit("data", `${OSC}11;rgb:ffff/ffff/ffff${BEL}${CSI}?62c`);
    const refreshed = await refreshPromise;

    expect(refreshed.appearance).toBe("light");
    expect(refreshed.background).toEqual({ r: 255, g: 255, b: 255 });
    expect(refreshed.kittyKeyboard).toBe(true);
  });
});

describe("capabilities store", () => {
  test("current gives the sync snapshot without ever querying", () => {
    const stdin = createQueryStdin();
    const stdout = createStdout(90, true, 30);
    const store = getCapabilities(stdin, stdout);

    expect(store.current.size).toMatchObject({ columns: 90, rows: 30 });
    expect(store.current.supports.kittyKeyboard).toBeUndefined();
    // Nothing was written to the terminal.
    expect(stdout.getWrites().join("")).toBe("");
    // Unchanged state returns the identical snapshot object.
    expect(store.current).toBe(store.current);
  });

  test("query() runs standalone with raw-mode management and notifies", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();
    const store = getCapabilities(stdin, stdout);

    const seen: unknown[] = [];
    const unsubscribe = store.subscribe((capabilities) => {
      seen.push(capabilities.supports.kittyKeyboard);
    });

    const promise = store.query();
    expect(stdin.setRawMode).toHaveBeenCalledWith(true);
    expect(stdout.get()).toContain(`${CSI}c`);

    stdin.emit("data", `${OSC}11;rgb:0000/0000/0000${BEL}${CSI}?1u${CSI}?62c`);
    const result = await promise;

    expect(result.supports.kittyKeyboard).toBe(true);
    expect(result.theme.appearance).toBe("dark");
    expect(stdin.setRawMode).toHaveBeenCalledWith(false);
    expect(seen).toEqual([true]);

    expect(store.current).toBe(result);
    unsubscribe();
  });

  test("subscribers are notified on terminal resize", () => {
    const stdin = createQueryStdin();
    const stdout = createStdout(80, true, 24);
    const store = getCapabilities(stdin, stdout);

    const sizes: Array<{ columns: number; rows: number }> = [];
    const unsubscribe = store.subscribe(({ size }) => {
      sizes.push({ columns: size.columns, rows: size.rows });
    });

    stdout.columns = 120;
    stdout.rows = 40;
    stdout.emit("resize");

    expect(sizes).toEqual([{ columns: 120, rows: 40 }]);

    unsubscribe();
    stdout.emit("resize");
    expect(sizes).toHaveLength(1);
  });

  test("stores are shared per stdout stream", () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();

    expect(getCapabilities(stdin, stdout)).toBe(getCapabilities(stdin, stdout));
  });

  test("query() is a no-op for non-TTY streams", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout(80, false);
    const store = getCapabilities(stdin, stdout);

    await store.query();

    expect(stdout.getWrites().join("")).toBe("");
    expect(stdin.setRawMode).not.toHaveBeenCalled();
  });
});

describe("terminal reports", () => {
  test("ingest tracks focus and notifies", () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();
    const store = getCapabilities(stdin, stdout);

    const seen: Array<boolean | undefined> = [];
    const unsubscribe = store.subscribe(({ focused }) => {
      seen.push(focused);
    });

    expect(store.current.focused).toBeUndefined();
    expect(store.ingest(`${CSI}I`)).toBe(true);
    expect(store.current.focused).toBe(true);
    expect(store.ingest(`${CSI}O`)).toBe(true);
    expect(store.current.focused).toBe(false);
    expect(store.ingest(`${CSI}A`)).toBe(false);
    expect(store.ingest("x")).toBe(false);

    expect(seen).toEqual([true, false]);
    unsubscribe();
  });

  test("ingest keeps the terminal's own theme when the OS scheme flips", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();
    const store = getCapabilities(stdin, stdout);

    const promise = store.query();
    stdin.emit("data", `${OSC}11;rgb:0000/0000/0000${BEL}${CSI}?62c`);
    await promise;
    expect(store.current.theme.appearance).toBe("dark");

    const writesBefore = stdout.getWrites().length;
    expect(store.ingest(`${ESC}[?997;2n`)).toBe(true);
    // The known dark background wins; the OS preference is surfaced apart.
    expect(store.current.theme.appearance).toBe("dark");
    expect(store.current.theme.systemAppearance).toBe("light");
    // Without a registered runner, no automatic refresh query goes out.
    expect(stdout.getWrites().length).toBe(writesBefore);
  });

  test("ingest falls back to the OS report when no background is known", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();
    const store = getCapabilities(stdin, stdout);

    const promise = store.query();
    stdin.emit("data", `${CSI}?62c`);
    await promise;

    expect(store.ingest(`${ESC}[?997;2n`)).toBe(true);
    expect(store.current.theme.appearance).toBe("light");
  });

  test("ingest applies in-band resize pixel geometry", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();
    const store = getCapabilities(stdin, stdout);

    const promise = store.query();
    stdin.emit("data", `${CSI}?62c`);
    await promise;

    expect(store.ingest(`${ESC}[48;40;120;1200;1920t`)).toBe(true);
    expect(store.current.size.pixels).toEqual({
      textArea: { width: 1920, height: 1200 },
      cell: { width: 16, height: 30 },
    });
  });

  test("report modes follow the subscription lifecycle", async () => {
    const stdin = createQueryStdin();
    const stdout = createStdout();
    const store = getCapabilities(stdin, stdout);

    // Answer the query claiming focus + color scheme support, but not
    // in-band resize.
    const promise = store.query();
    stdin.emit("data", `${CSI}?1004;2$y${CSI}?2031;2$y${CSI}?2048;0$y${CSI}?62c`);
    await promise;

    // A registered runner marks a report feed as available (Ink's pipeline).
    const unregister = registerTerminalIntegration(stdout, { runQuery: async () => undefined });

    expect(stdout.getWrites().join("")).not.toContain(`${CSI}?1004h`);
    const unsubscribe = store.subscribe(() => {});

    const enabled = stdout.getWrites().join("");
    expect(enabled).toContain(`${CSI}?1004h`);
    expect(enabled).toContain(`${CSI}?2031h`);
    expect(enabled).not.toContain(`${CSI}?2048h`);

    unsubscribe();
    const disabled = stdout.getWrites().join("");
    expect(disabled).toContain(`${CSI}?1004l`);
    expect(disabled).toContain(`${CSI}?2031l`);

    unregister();
  });
});

describe("useCapabilities", () => {
  function Show() {
    const capabilities = useCapabilities();
    return (
      <Text>
        {capabilities.theme.appearance ?? "unknown"} kitty:
        {String(capabilities.supports.kittyKeyboard)} sync:
        {String(capabilities.supports.synchronizedOutput)} name:
        {capabilities.terminal.name ?? "?"}
      </Text>
    );
  }

  // The query batch is written to the same stdout as frames — a "frame" is
  // any write that isn't pure escape sequences.
  const lastFrame = (stdout: ReturnType<typeof createStdout>): string | undefined =>
    stdout
      .getWrites()
      .filter((write) => write.length > 0 && !write.startsWith(ESC))
      .at(-1);

  test("starts with the sync snapshot and fills in query results", async () => {
    stubCleanEnv();
    const stdin = createQueryStdin();
    const stdout = createStdout();

    render(<Show />, { stdout, stdin, debug: true, interactive: true });

    await delay(50);
    expect(lastFrame(stdout)).toBe("unknown kitty:undefined sync:undefined name:?");

    // The lazy query should have been sent by now — answer it.
    expect(stdout.getWrites().join("")).toContain(`${CSI}c`);
    stdin.emit(
      "data",
      `${OSC}11;rgb:0000/0000/0000${BEL}${CSI}?1u${CSI}?2026;1$y${ESC}P>|kitty(0.31.0)${ST}${CSI}?62c`,
    );

    await delay(50);
    expect(lastFrame(stdout)).toBe("dark kitty:true sync:true name:kitty");
  });

  test("never queries in non-interactive sessions", async () => {
    stubCleanEnv();
    const stdin = createQueryStdin();
    const stdout = createStdout();

    render(<Show />, { stdout, stdin, debug: true, interactive: false });

    await delay(50);
    expect(stdout.getWrites().join("")).not.toContain(`${CSI}c`);
    expect(lastFrame(stdout)).toBe("unknown kitty:undefined sync:undefined name:?");
  });

  test("push reports flow to components, never to key handlers", async () => {
    stubCleanEnv();
    const stdin = createQueryStdin();
    const stdout = createStdout();
    const inputs: string[] = [];

    function LiveShow() {
      const capabilities = useCapabilities();
      useInput((input) => {
        inputs.push(input);
      });

      return (
        <Text>
          {capabilities.theme.appearance ?? "unknown"} focused:{String(capabilities.focused)}
        </Text>
      );
    }

    render(<LiveShow />, { stdout, stdin, debug: true, interactive: true });
    await delay(50);

    // Answer the full query claiming support for all push report modes.
    stdin.emit(
      "data",
      `${OSC}11;rgb:0000/0000/0000${BEL}${CSI}?1004;2$y${CSI}?2031;2$y${CSI}?2048;2$y${CSI}?62c`,
    );
    await delay(50);
    expect(lastFrame(stdout)).toBe("dark focused:undefined");

    // The store enabled the supported report modes on the terminal.
    const written = stdout.getWrites().join("");
    expect(written).toContain(`${CSI}?1004h`);
    expect(written).toContain(`${CSI}?2031h`);
    expect(written).toContain(`${CSI}?2048h`);

    // A focus-out report arrives through the normal input pipeline.
    emitReadable(stdin as unknown as FakeStdin, `${CSI}O`);
    await delay(50);
    expect(lastFrame(stdout)).toBe("dark focused:false");

    // An OS color scheme report alone doesn't flip the theme — the known
    // dark background wins until the triggered refresh reads new colors.
    emitReadable(stdin as unknown as FakeStdin, `${ESC}[?997;2n`);
    await delay(50);
    expect(lastFrame(stdout)).toBe("dark focused:false");

    // The refresh asked for colors again; answer with a light background.
    stdin.emit("data", `${OSC}11;rgb:ffff/ffff/ffff${BEL}${CSI}?62c`);
    await delay(50);
    expect(lastFrame(stdout)).toBe("light focused:false");

    // None of the reports leaked into useInput.
    expect(inputs.join("")).not.toContain("997");
    expect(inputs.join("")).not.toContain("[O");
  });

  test("useCapabilitiesChange delivers next and previous snapshots", async () => {
    stubCleanEnv();
    const stdin = createQueryStdin();
    const stdout = createStdout();
    const changes: Array<{ focused: boolean | undefined; wasFocused: boolean | undefined }> = [];

    function Watcher() {
      useCapabilitiesChange((next, previous) => {
        if (next.focused !== previous.focused) {
          changes.push({ focused: next.focused, wasFocused: previous.focused });
        }
      });

      return <Text>watching</Text>;
    }

    render(<Watcher />, { stdout, stdin, debug: true, interactive: true });
    await delay(50);

    stdin.emit("data", `${CSI}?1004;2$y${CSI}?62c`);
    await delay(50);

    emitReadable(stdin as unknown as FakeStdin, `${CSI}O`);
    await delay(50);
    emitReadable(stdin as unknown as FakeStdin, `${CSI}I`);
    await delay(50);

    expect(changes).toEqual([
      { focused: false, wasFocused: undefined },
      { focused: true, wasFocused: false },
    ]);
  });
});
