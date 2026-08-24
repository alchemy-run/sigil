import { EventEmitter } from "node:events";

import type { ColorProfile } from "#/screen/color-profile.ts";
import type { Screen } from "#/screen/screen.ts";
import { serializeScreen } from "#/screen/serialize.ts";

export class VirtualOutput extends EventEmitter {
  columns: number;
  rows: number;
  isTTY: boolean;
  writable = true;
  writableEnded = false;
  destroyed = false;
  #chunks: string[] = [];

  constructor(options: { columns?: number; rows?: number; isTTY?: boolean } = {}) {
    super();
    this.columns = options.columns ?? 80;
    this.rows = options.rows ?? 24;
    this.isTTY = options.isTTY ?? true;
  }

  write(
    chunk: Uint8Array | string,
    encodingOrCallback?: BufferEncoding | (() => void),
    callback?: () => void,
  ): boolean {
    this.#chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
    const done = typeof encodingOrCallback === "function" ? encodingOrCallback : callback;
    queueMicrotask(() => done?.());
    return true;
  }

  output(): string {
    return this.#chunks.join("");
  }
  writes(): readonly string[] {
    return this.#chunks;
  }
  reset(): void {
    this.#chunks = [];
  }
  resize(columns: number, rows: number): void {
    this.columns = columns;
    this.rows = rows;
    this.emit("resize");
  }
}

export type RecordedFrame = {
  readonly timestamp: number;
  readonly screen: Screen;
  readonly output: string;
};

export class FrameRecorder {
  #frames: RecordedFrame[] = [];
  readonly colorProfile: ColorProfile;
  constructor(colorProfile: ColorProfile = "truecolor") {
    this.colorProfile = colorProfile;
  }
  record(screen: Screen, timestamp = performance.now()): RecordedFrame {
    const frame = {
      timestamp,
      screen,
      output: serializeScreen(screen, { colorProfile: this.colorProfile }),
    };
    this.#frames.push(frame);
    return frame;
  }
  frames(): readonly RecordedFrame[] {
    return this.#frames;
  }
  clear(): void {
    this.#frames = [];
  }
}

export const screenText = (screen: Screen): string =>
  screen
    .toRows()
    .map((row) =>
      row
        .filter((cell) => cell.width > 0)
        .map((cell) => cell.grapheme)
        .join("")
        .trimEnd(),
    )
    .join("\n");

export function assertScreenText(screen: Screen, expected: string): void {
  const actual = screenText(screen);
  if (actual !== expected) throw new Error(`Expected screen:\n${expected}\n\nReceived:\n${actual}`);
}
