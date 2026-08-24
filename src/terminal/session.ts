import { ansiEscapes, type CursorShape } from "#/ansi/escapes.ts";
import { colorState, type ColorPolicy } from "#/capabilities/color-policy.ts";
import { getCapabilities, type CapabilitiesStore } from "#/capabilities/store.ts";
import type { CursorPosition } from "#/cursor-position.ts";
import type { ColorProfile } from "#/screen/color-profile.ts";
import type { Screen } from "#/screen/screen.ts";
import { serializeScreen } from "#/screen/serialize.ts";
import type { OutputStream } from "#/stream.ts";
import { TerminalInput } from "#/terminal/input.ts";
import { ScreenPresenter } from "#/terminal/screen-presenter.ts";

export type TerminalSessionOptions = {
  readonly stdin: NodeJS.ReadableStream;
  readonly stdout: OutputStream;
  readonly stderr: OutputStream;
  readonly colorPolicy?: ColorPolicy;
  readonly onCapabilitiesChange?: () => void;
};

export type TerminalMode = {
  readonly id: string;
  readonly enable: string;
  readonly disable: string;
};

export type TerminalCursor = {
  readonly position?: CursorPosition;
  readonly visible: boolean;
  readonly shape: CursorShape;
  readonly blinking: boolean;
  readonly color?: string;
};

type ActiveMode = TerminalMode & { count: number };

/** Instance-scoped terminal state and lifecycle ownership. */
export class TerminalSession {
  readonly stdin: NodeJS.ReadableStream;
  readonly stdout: OutputStream;
  readonly stderr: OutputStream;
  readonly capabilities: CapabilitiesStore;
  readonly input: TerminalInput;
  readonly #presenter: ScreenPresenter;

  cursor: TerminalCursor = {
    visible: true,
    shape: "block",
    blinking: true,
  };
  suspended = false;
  alternateScreen = false;
  inlineScreen = true;

  #policy: ColorPolicy;
  #profile: ColorProfile;
  #modes = new Map<string, ActiveMode>();
  #pendingWrites = new Set<Promise<void>>();
  #unsubscribe: () => void;
  #cleaned = false;

  constructor(options: TerminalSessionOptions) {
    this.stdin = options.stdin;
    this.stdout = options.stdout;
    this.stderr = options.stderr;
    this.capabilities = getCapabilities(this.stdin, this.stdout);
    this.input = new TerminalInput(this.capabilities);
    this.#presenter = new ScreenPresenter((data) => this.write(data), this.stdout);
    this.#policy = options.colorPolicy ?? "auto";
    this.#profile = colorState(this.capabilities.current, this.#policy).effective;
    this.#unsubscribe = this.capabilities.subscribe(
      (capabilities) => {
        const profile = colorState(capabilities, this.#policy).effective;
        if (profile !== this.#profile) {
          this.#profile = profile;
          this.#presenter.reset();
        }
        options.onCapabilitiesChange?.();
      },
      { resizes: false },
    );
  }

  get colorProfile(): ColorProfile {
    return this.#profile;
  }

  /** Encodes a structured frame at the terminal boundary. */
  encode(screen: Screen): string {
    return serializeScreen(screen, {
      colorProfile: this.colorProfile,
      styles: this.colorProfile !== "none",
    });
  }

  present(
    screen: Screen,
    options: { readonly fullscreen?: boolean; readonly forceRewrite?: boolean } = {},
  ): boolean {
    return this.#presenter.present(screen, {
      colorProfile: this.colorProfile,
      cursor: this.cursor.position,
      ...options,
    });
  }

  willPresent(
    screen: Screen,
    options: { readonly fullscreen?: boolean; readonly forceRewrite?: boolean } = {},
  ): boolean {
    return this.#presenter.willPresent(
      screen,
      this.cursor.position,
      options.fullscreen,
      options.forceRewrite,
    );
  }

  clearFrame(): void {
    this.#presenter.clear();
  }

  resetFrame(): void {
    this.#presenter.reset();
  }

  finishFrame(): void {
    this.#presenter.done();
  }

  setColorPolicy(policy: ColorPolicy): void {
    this.#policy = policy;
    const profile = colorState(this.capabilities.current, policy).effective;
    if (profile !== this.#profile) {
      this.#profile = profile;
      this.#presenter.reset();
    }
  }

  /** Writes through the session and tracks callback-based backpressure completion. */
  write(data: string): boolean {
    let settle!: () => void;
    const completion = new Promise<void>((resolve) => {
      settle = resolve;
    });
    this.#pendingWrites.add(completion);
    try {
      return this.stdout.write(data, () => {
        this.#pendingWrites.delete(completion);
        settle();
      });
    } catch (error) {
      this.#pendingWrites.delete(completion);
      settle();
      throw error;
    }
  }

  async flush(): Promise<void> {
    await Promise.all(this.#pendingWrites);
  }

  enableMode(mode: TerminalMode): void;
  enableMode(enable: string, disable: string): void;
  enableMode(modeOrEnable: TerminalMode | string, disable?: string): void {
    const mode =
      typeof modeOrEnable === "string"
        ? { id: disable ?? modeOrEnable, enable: modeOrEnable, disable: disable ?? "" }
        : modeOrEnable;
    const active = this.#modes.get(mode.id);
    if (active) {
      active.count++;
      return;
    }
    this.write(mode.enable);
    this.#modes.set(mode.id, { ...mode, count: 1 });
  }

  disableMode(idOrDisable: string): void {
    const entry =
      this.#modes.get(idOrDisable) ??
      [...this.#modes.values()].find((mode) => mode.disable === idOrDisable);
    if (!entry) return;
    if (--entry.count > 0) return;
    this.#modes.delete(entry.id);
    this.write(entry.disable);
  }

  setCursor(position: CursorPosition | undefined): void {
    this.cursor = { ...this.cursor, position, visible: position !== undefined };
  }

  setCursorAppearance(options: {
    readonly visible?: boolean;
    readonly shape?: CursorShape;
    readonly blinking?: boolean;
    readonly color?: string | null;
  }): void {
    const next = {
      ...this.cursor,
      ...(options.visible === undefined ? {} : { visible: options.visible }),
      ...(options.shape === undefined ? {} : { shape: options.shape }),
      ...(options.blinking === undefined ? {} : { blinking: options.blinking }),
      ...(options.color === undefined ? {} : { color: options.color ?? undefined }),
    };
    let output = "";
    if (next.shape !== this.cursor.shape || next.blinking !== this.cursor.blinking)
      output += ansiEscapes.cursorShape(next.shape, next.blinking);
    if (options.color !== undefined)
      output +=
        options.color === null
          ? ansiEscapes.resetCursorColor
          : ansiEscapes.cursorColor(options.color);
    if (next.visible !== this.cursor.visible)
      output += next.visible ? ansiEscapes.cursorShow : ansiEscapes.cursorHide;
    this.cursor = next;
    if (output) this.write(output);
  }

  setAlternateScreen(enabled: boolean, options: { hideCursor?: boolean } = {}): void {
    if (enabled === this.alternateScreen) return;
    this.alternateScreen = enabled;
    this.inlineScreen = !enabled;
    if (enabled) {
      this.enableMode({
        id: "alternate-screen",
        enable: ansiEscapes.enterAlternativeScreen,
        disable: ansiEscapes.exitAlternativeScreen,
      });
      if (options.hideCursor) this.setCursorAppearance({ visible: false });
    } else {
      this.disableMode("alternate-screen");
    }
    this.#presenter.reset();
  }

  beginSuspension(): void {
    if (this.suspended) throw new Error("The terminal session is already suspended");
    this.suspended = true;
  }

  resume(): void {
    if (!this.suspended) return;
    this.suspended = false;
    this.#presenter.reset();
  }

  cleanup(): void {
    if (this.#cleaned) return;
    this.#cleaned = true;
    this.#unsubscribe();
    for (const mode of [...this.#modes.values()].reverse()) {
      try {
        this.stdout.write(mode.disable);
      } catch {}
    }
    if (this.cursor.color !== undefined) {
      try {
        this.stdout.write(ansiEscapes.resetCursorColor);
      } catch {}
    }
    if (!this.cursor.visible) {
      try {
        this.stdout.write(ansiEscapes.cursorShow);
      } catch {}
    }
    this.#modes.clear();
    this.alternateScreen = false;
    this.inlineScreen = true;
    this.suspended = false;
    this.cursor = { visible: true, shape: "block", blinking: true };
    this.#presenter.done();
  }
}
