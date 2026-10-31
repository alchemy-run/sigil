import { beforeEach, expect, test, vi } from "vite-plus/test";

import { BEL, ESC, ST } from "#/ansi/escapes.ts";
import { setClipboard, tmuxPassthrough } from "#/ansi/osc.ts";

type SpawnSync = (
  command: string,
  args: readonly string[],
  options: { input?: unknown },
) => { status: number };
const spawnSync = vi.hoisted(() => vi.fn<SpawnSync>(() => ({ status: 0 })));
vi.mock("node:child_process", () => ({ spawnSync }));

const { copyToClipboard, maxClipboardSequenceLength, screenPassthrough } =
  await import("#/terminal/clipboard.ts");

const stream = () => {
  const writes: string[] = [];
  return { writes, write: (data: string) => (writes.push(data), true) };
};

const commands = () => spawnSync.mock.calls.map(([command, args]) => [command, ...args]);

beforeEach(() => {
  spawnSync.mockClear();
  spawnSync.mockImplementation(() => ({ status: 0 }));
});

test("writes plain OSC 52 outside multiplexers", () => {
  const out = stream();
  const methods = copyToClipboard("hi", { stream: out, env: { SIGIL_CLIPBOARD: "osc52" } });
  expect(out.writes).toEqual([setClipboard("hi")]);
  expect(methods).toEqual(["osc52"]);
});

test("inside tmux, sends plain and passthrough OSC 52 and loads the tmux buffer", () => {
  const out = stream();
  const methods = copyToClipboard("hi", {
    stream: out,
    env: { TMUX: "/tmp/tmux-1000/default,1,0", SSH_TTY: "/dev/pts/1" },
  });
  // Plain covers `set-clipboard on`, the wrapped copy `allow-passthrough on`.
  expect(out.writes).toEqual([setClipboard("hi") + tmuxPassthrough(setClipboard("hi"))]);
  expect(commands()).toEqual([["tmux", "load-buffer", "-w", "-"]]);
  expect(spawnSync.mock.calls[0]?.[2]).toMatchObject({ input: "hi" });
  expect(methods).toEqual(["osc52", "tmux"]);
});

test("inside GNU screen, wraps a BEL-terminated sequence in chunked DCS", () => {
  const out = stream();
  const text = "x".repeat(2000);
  copyToClipboard(text, { stream: out, env: { STY: "1234.pts-0", SIGIL_CLIPBOARD: "osc52" } });

  const sequence = `${setClipboard(text).slice(0, -ST.length)}${BEL}`;
  expect(out.writes).toEqual([screenPassthrough(sequence)]);
  const chunks = out.writes.join("").split(ST).filter(Boolean);
  expect(chunks.length).toBeGreaterThan(1);
  for (const chunk of chunks) {
    expect(chunk.startsWith(`${ESC}P`)).toBe(true);
    // An ST inside a chunk would end screen's DCS early.
    expect(chunk.length).toBeLessThanOrEqual(768);
  }
  expect(chunks.map((chunk) => chunk.slice(2)).join("")).toBe(sequence);
});

test("skips OSC 52 when the sequence is longer than terminals accept", () => {
  const out = stream();
  const text = "x".repeat(maxClipboardSequenceLength);
  const methods = copyToClipboard(text, { stream: out, env: { SIGIL_CLIPBOARD: "osc52" } });
  expect(out.writes).toEqual([]);
  expect(methods).toEqual([]);
});

test("uses the system clipboard tool for local sessions", () => {
  const out = stream();
  const methods = copyToClipboard("hi", { stream: out, env: { WAYLAND_DISPLAY: "wayland-0" } });
  if (process.platform === "linux") {
    expect(commands()).toEqual([["wl-copy"]]);
    expect(methods).toEqual(["osc52", "native"]);
  }
});

test("falls back from xclip to xsel", () => {
  if (process.platform !== "linux") return;
  spawnSync.mockImplementation((command) => ({ status: command === "xclip" ? 1 : 0 }));
  const methods = copyToClipboard("hi", { stream: stream(), env: { DISPLAY: ":0" } });
  expect(commands()).toEqual([
    ["xclip", "-selection", "clipboard"],
    ["xsel", "--clipboard", "--input"],
  ]);
  expect(methods).toEqual(["osc52", "native"]);
});

test("never uses the system clipboard over SSH", () => {
  const methods = copyToClipboard("hi", {
    stream: stream(),
    env: { SSH_CONNECTION: "1.2.3.4 1 5.6.7.8 22", DISPLAY: ":0" },
  });
  expect(commands()).toEqual([]);
  expect(methods).toEqual(["osc52"]);
});

test("only OSC 52 for selections other than the clipboard", () => {
  const out = stream();
  const methods = copyToClipboard("hi", {
    stream: out,
    selection: "primary",
    env: { TMUX: "x", DISPLAY: ":0" },
  });
  expect(commands()).toEqual([]);
  expect(methods).toEqual(["osc52"]);
});
