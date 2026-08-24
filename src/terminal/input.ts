import type { CapabilitiesStore } from "#/capabilities/store.ts";
import { createInputParser, type InputEvent } from "#/input-parser.ts";

export type MouseButton = "left" | "middle" | "right" | "none" | "wheel-up" | "wheel-down";
export type TerminalMouseEvent = {
  readonly type: "press" | "release" | "move" | "wheel";
  readonly x: number;
  readonly y: number;
  readonly button: MouseButton;
  readonly shift: boolean;
  readonly alt: boolean;
  readonly ctrl: boolean;
};

const sgrMouse = /^\u001B\[<(\d+);(\d+);(\d+)([Mm])$/;

/** Stateful stdin decoder that separates terminal reports from application input. */
export class TerminalInput {
  readonly #parser = createInputParser();
  readonly #capabilities: CapabilitiesStore;
  readonly #mouseListeners = new Set<(event: TerminalMouseEvent) => void>();

  constructor(capabilities: CapabilitiesStore) {
    this.#capabilities = capabilities;
  }

  push(chunk: string): InputEvent[] {
    return this.#parser.push(chunk).filter((event) => {
      if (typeof event !== "string") return true;
      if (this.#capabilities.ingest(event)) return false;
      const mouse = parseMouseEvent(event);
      if (!mouse) return true;
      for (const listener of this.#mouseListeners) listener(mouse);
      return false;
    });
  }

  subscribeMouse(listener: (event: TerminalMouseEvent) => void): () => void {
    this.#mouseListeners.add(listener);
    return () => this.#mouseListeners.delete(listener);
  }

  hasPendingEscape(): boolean {
    return this.#parser.hasPendingEscape();
  }

  flushPendingEscape(): string | undefined {
    return this.#parser.flushPendingEscape();
  }

  reset(): void {
    this.#parser.reset();
  }
}

export function parseMouseEvent(sequence: string): TerminalMouseEvent | undefined {
  const match = sequence.match(sgrMouse);
  if (!match) return;
  const code = Number(match[1]);
  const column = Number(match[2]);
  const row = Number(match[3]);
  if (column < 1 || row < 1) return;
  const wheel = (code & 64) !== 0;
  const move = (code & 32) !== 0;
  const buttonCode = code & 3;
  const button: MouseButton = wheel
    ? buttonCode === 0
      ? "wheel-up"
      : "wheel-down"
    : (["left", "middle", "right", "none"] as const)[buttonCode]!;
  return {
    type: wheel
      ? "wheel"
      : move
        ? "move"
        : match[4] === "m" || buttonCode === 3
          ? "release"
          : "press",
    x: column - 1,
    y: row - 1,
    button,
    shift: (code & 4) !== 0,
    alt: (code & 8) !== 0,
    ctrl: (code & 16) !== 0,
  };
}
