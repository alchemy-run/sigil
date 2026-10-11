import { ansiEscapes, type CursorShape } from "#/ansi/escapes.ts";
import {
  clearProgramStatus,
  notify,
  setPointerShape,
  setProgramStatus,
  setTerminalProgress,
  setWindowTitle,
  setWorkingDirectory,
  tmuxPassthrough,
  type ClipboardSelection,
  type ProgramStatus,
  type ProgramStatusState,
  type TerminalProgressState,
} from "#/ansi/osc.ts";
import { colorState, type ColorPolicy } from "#/capabilities/color-policy.ts";
import { getCapabilities, type CapabilitiesStore } from "#/capabilities/store.ts";
import type { CursorPosition } from "#/cursor-position.ts";
import type { ColorProfile } from "#/screen/color-profile.ts";
import type { Screen } from "#/screen/screen.ts";
import { serializeScreen } from "#/screen/serialize.ts";
import type { OutputStream } from "#/stream.ts";
import { copyToClipboard } from "#/terminal/clipboard.ts";
import { TerminalInput } from "#/terminal/input.ts";
import { ScreenPresenter } from "#/terminal/screen-presenter.ts";

/** Whether OSC 7501 program status reports are sent. */
export type ProgramStatusMode = "auto" | "enabled" | "disabled";

export type TerminalSessionOptions = {
  readonly stdin: NodeJS.ReadableStream;
  readonly stdout: OutputStream;
  readonly stderr: OutputStream;
  readonly colorPolicy?: ColorPolicy;
  readonly programStatus?: ProgramStatusMode;
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
const imperativeProgressOwner = Symbol("imperative-progress");
const imperativeTitleOwner = Symbol("imperative-title");
// Root record key; real ids are never empty.
const rootStatus = "";
const statusKey = (status: ProgramStatus): string => status.id ?? rootStatus;
const isUnder = (key: string, parent: string): boolean =>
  parent === rootStatus || key === parent || key.startsWith(`${parent}/`);
// Results the user hasn't seen yet outlive their publisher, per the OSC 7501 spec.
const isSettled = (state: ProgramStatusState): boolean => state === "done" || state === "error";

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
  #progressActive = false;
  #progressSequence: string | undefined;
  #progressHeartbeat: ReturnType<typeof setInterval> | undefined;
  #progressPublishers = new Map<symbol, { state: TerminalProgressState; value?: number }>();
  #titlePublishers = new Map<symbol, string>();
  #titleActive = false;
  #statusPublishers = new Map<symbol, ProgramStatus>();
  #imperativeStatusOwners = new Map<string, symbol>();
  #statusWritten = new Map<string, { state: ProgramStatusState; sequence: string }>();
  #statusSupport: boolean | "pending" | undefined;
  #statusBeforeSuspension: Map<string, { state: ProgramStatusState; sequence: string }> | undefined;

  constructor(options: TerminalSessionOptions) {
    this.stdin = options.stdin;
    this.stdout = options.stdout;
    this.stderr = options.stderr;
    this.capabilities = getCapabilities(this.stdin, this.stdout);
    this.input = new TerminalInput(this.capabilities);
    this.#presenter = new ScreenPresenter((data) => this.write(data), this.stdout);
    this.#policy = options.colorPolicy ?? "auto";
    if (options.programStatus === "enabled") this.#statusSupport = true;
    if (options.programStatus === "disabled") this.#statusSupport = false;
    this.#profile = colorState(this.capabilities.current, this.#policy).effective;
    this.#unsubscribe = this.capabilities.subscribe(
      (capabilities) => {
        const profile = colorState(capabilities, this.#policy).effective;
        if (profile !== this.#profile) {
          this.#profile = profile;
          // Repaint in the new profile; the frame on screen still needs erasing.
          this.#presenter.invalidate();
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
    options: {
      readonly fullscreen?: boolean;
      readonly forceRewrite?: boolean;
    } = {},
  ): boolean {
    return this.#presenter.present(screen, {
      colorProfile: this.colorProfile,
      cursor: this.cursor.position,
      ...options,
    });
  }

  willPresent(
    screen: Screen,
    options: {
      readonly fullscreen?: boolean;
      readonly forceRewrite?: boolean;
    } = {},
  ): boolean {
    return this.#presenter.willPresent(
      screen,
      this.cursor.position,
      options.fullscreen,
      options.forceRewrite,
    );
  }

  /** Erases the presented frame; pass the current `columns` after a resize so the erase covers rows the emulator rewrapped. */
  clearFrame(options: { readonly columns?: number } = {}): void {
    this.#presenter.clear(options);
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
      // Repaint in the new profile; the frame on screen still needs erasing.
      this.#presenter.invalidate();
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

  /** Copy text to the clipboard; see {@link copyToClipboard} for the routes tried. */
  copyToClipboard(text: string, selection: ClipboardSelection = "clipboard"): boolean {
    return (
      copyToClipboard(text, { selection, stream: { write: (data) => this.write(data) } }).length > 0
    );
  }

  setTitle(title: string): boolean {
    return this.publishTitle(imperativeTitleOwner, title);
  }

  publishTitle(owner: symbol, title?: string): boolean {
    this.#titlePublishers.delete(owner);
    if (title !== undefined) this.#titlePublishers.set(owner, title);
    const current = [...this.#titlePublishers.values()].at(-1);
    if (current !== undefined) {
      this.#titleActive = true;
      return this.write(this.#wrapOsc(setWindowTitle(current)));
    }
    if (!this.#titleActive) return true;
    this.#titleActive = false;
    return this.write(this.#wrapOsc(setWindowTitle("")));
  }

  setWorkingDirectory(directory: URL | string): boolean {
    return this.write(this.#wrapOsc(setWorkingDirectory(directory)));
  }

  notify(title: string): boolean {
    return this.write(this.#wrapOsc(notify(title)));
  }

  setPointerShape(shape: string): boolean {
    return this.write(this.#wrapOsc(setPointerShape(shape)));
  }

  publishProgress(owner: symbol, state: TerminalProgressState, value?: number): boolean {
    this.#progressPublishers.delete(owner);
    if (state !== "inactive") this.#progressPublishers.set(owner, { state, value });
    return this.#applyPublishedProgress();
  }

  #applyPublishedProgress(): boolean {
    const current = [...this.#progressPublishers.values()].at(-1);
    return current === undefined
      ? this.#writeProgress("inactive")
      : this.#writeProgress(current.state, current.value);
  }

  /**
   * Update terminal-native progress. Active progress is reset during cleanup
   * so a completed or failed process cannot leave a stale terminal indicator.
   */
  setProgress(state: TerminalProgressState, value?: number): boolean {
    this.#progressPublishers.delete(imperativeProgressOwner);
    if (state !== "inactive") {
      this.#progressPublishers.set(imperativeProgressOwner, { state, value });
    }
    return this.#applyPublishedProgress();
  }

  #writeProgress(state: TerminalProgressState, value?: number): boolean {
    this.#progressActive = state !== "inactive";
    const sequence = this.#wrapOsc(setTerminalProgress(state, value));
    if (!this.#progressActive) {
      this.#stopProgressHeartbeat();
    } else {
      this.#progressSequence = sequence;
      if (this.#progressHeartbeat === undefined) {
        this.#progressHeartbeat = setInterval(() => {
          if (this.#progressSequence !== undefined) this.write(this.#progressSequence);
        }, 1000);
        this.#progressHeartbeat.unref?.();
      }
    }
    return this.write(sequence);
  }

  #stopProgressHeartbeat(): void {
    if (this.#progressHeartbeat !== undefined) {
      clearInterval(this.#progressHeartbeat);
      this.#progressHeartbeat = undefined;
    }
    this.#progressSequence = undefined;
  }

  /**
   * Publish an OSC 7501 record for `owner`, or withdraw it with `undefined`.
   * The latest publisher of an id wins. A withdrawn id with no publisher
   * left is cleared, unless it last reported `done` or `error`.
   */
  publishStatus(owner: symbol, status?: ProgramStatus): boolean {
    if (status !== undefined) setProgramStatus(status); // validate before mutating
    const previous = this.#statusPublishers.get(owner);
    this.#statusPublishers.delete(owner);
    if (status !== undefined) this.#statusPublishers.set(owner, status);
    const keys = new Set<string>();
    if (previous !== undefined) keys.add(statusKey(previous));
    if (status !== undefined) keys.add(statusKey(status));
    this.#detectStatusSupport();
    let written = true;
    for (const key of keys) written = this.#applyStatus(key) && written;
    return written;
  }

  // Reports are only sent once the terminal answers the OSC 7501 query
  // (multiplexers like tmux and screen don't). The `programStatus` option
  // skips the query. The query runs at most once per session.
  #detectStatusSupport(): void {
    if (this.#statusSupport !== undefined) return;
    const known = this.capabilities.current.supports.programStatus;
    if (known !== undefined) this.#statusSupport = known;
    else {
      this.#statusSupport = "pending";
      void this.capabilities
        .query()
        .then((capabilities) => capabilities.supports.programStatus === true)
        .catch(() => false)
        .then((supported) => {
          this.#statusSupport = supported;
          if (supported && !this.#cleaned) this.#flushStatus();
        });
    }
  }

  get #statusLive(): boolean {
    return this.#statusSupport === true && !this.suspended;
  }

  #flushStatus(): void {
    const keys = new Set([...this.#statusPublishers.values()].map(statusKey));
    for (const key of keys) this.#applyStatus(key);
  }

  /** Report program status (OSC 7501) for `status.id`, outside of any component. */
  setStatus(status: ProgramStatus): boolean {
    const key = statusKey(status);
    let owner = this.#imperativeStatusOwners.get(key);
    if (owner === undefined) {
      owner = Symbol("imperative-status");
      this.#imperativeStatusOwners.set(key, owner);
    }
    return this.publishStatus(owner, status);
  }

  /** Remove the imperative record for `id` (or the root) and clear it unless another publisher holds it. */
  clearStatus(id?: string): boolean {
    const key = id ?? rootStatus;
    const owner = this.#imperativeStatusOwners.get(key);
    this.#imperativeStatusOwners.delete(key);
    if (owner !== undefined) this.#statusPublishers.delete(owner);
    if (this.#currentStatus(key) !== undefined) return this.#applyStatus(key);
    if (!this.#statusLive || !this.#statusWritten.has(key)) return true;
    return this.#clearStatusRecords(key);
  }

  #currentStatus(key: string): ProgramStatus | undefined {
    return [...this.#statusPublishers.values()].findLast((status) => statusKey(status) === key);
  }

  #applyStatus(key: string): boolean {
    if (!this.#statusLive) return true;
    const current = this.#currentStatus(key);
    if (current !== undefined) {
      const sequence = setProgramStatus(current);
      if (this.#statusWritten.get(key)?.sequence === sequence) return true;
      this.#statusWritten.set(key, { state: current.state, sequence });
      return this.write(this.#wrapOsc(sequence));
    }
    const last = this.#statusWritten.get(key);
    if (last === undefined || isSettled(last.state)) return true;
    return this.#clearStatusRecords(key);
  }

  // `clear` also removes descendants (every record, for the root), so
  // re-report the ones that still have a publisher.
  #clearStatusRecords(key: string): boolean {
    for (const written of this.#statusWritten.keys())
      if (isUnder(written, key)) this.#statusWritten.delete(written);
    let ok = this.write(this.#wrapOsc(clearProgramStatus(key === rootStatus ? undefined : key)));
    const survivors = new Set(
      [...this.#statusPublishers.values()].map(statusKey).filter((other) => isUnder(other, key)),
    );
    for (const survivor of survivors) ok = this.#applyStatus(survivor) && ok;
    return ok;
  }

  enableMode(mode: TerminalMode): void;
  enableMode(enable: string, disable: string): void;
  enableMode(modeOrEnable: TerminalMode | string, disable?: string): void {
    const mode =
      typeof modeOrEnable === "string"
        ? {
            id: disable ?? modeOrEnable,
            enable: modeOrEnable,
            disable: disable ?? "",
          }
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
    // Nothing is working while another program has the terminal; resume()
    // reports the records again.
    if (this.#statusWritten.size > 0) {
      this.#statusBeforeSuspension = new Map(this.#statusWritten);
      this.#statusWritten.clear();
      this.write(this.#wrapOsc(clearProgramStatus()));
    }
    this.suspended = true;
  }

  resume(): void {
    if (!this.suspended) return;
    this.suspended = false;
    this.#presenter.reset();
    const before = this.#statusBeforeSuspension;
    this.#statusBeforeSuspension = undefined;
    if (before !== undefined && this.#statusLive) {
      // Settled records outlive their publishers, so restore those directly.
      for (const [key, entry] of before) {
        if (isSettled(entry.state) && this.#currentStatus(key) === undefined) {
          this.#statusWritten.set(key, entry);
          this.write(this.#wrapOsc(entry.sequence));
        }
      }
    }
    this.#flushStatus();
  }

  cleanup(): void {
    if (this.#cleaned) return;
    this.#cleaned = true;
    this.#unsubscribe();
    this.#stopProgressHeartbeat();
    this.#progressPublishers.clear();
    if (this.#progressActive) {
      try {
        this.stdout.write(this.#wrapOsc(setTerminalProgress("inactive")));
      } catch {}
      this.#progressActive = false;
    }
    this.#statusPublishers.clear();
    this.#imperativeStatusOwners.clear();
    for (const key of this.#statusWritten.keys()) {
      try {
        this.#applyStatus(key);
      } catch {}
    }
    this.#titlePublishers.clear();
    if (this.#titleActive) {
      try {
        this.stdout.write(this.#wrapOsc(setWindowTitle("")));
      } catch {}
      this.#titleActive = false;
    }
    // Return the cursor below the frame while its screen is still active.
    this.#presenter.done();
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
  }

  #wrapOsc(sequence: string): string {
    return this.capabilities.current.terminal.multiplexer === "tmux"
      ? tmuxPassthrough(sequence)
      : sequence;
  }
}
