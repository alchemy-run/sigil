# Sigil architecture

Sigil keeps Ink's React component model while replacing its terminal internals with structured data.

## Rendering pipeline

1. React reconciles `Text`, `Box`, and extension components into host nodes.
2. Yoga computes final cell geometry.
3. `paintTree` draws semantic `Cell` values through a clipped `Canvas` into a `Screen`. Colors, links, attributes, paints, and grapheme widths remain structured here.
4. `renderFrame` returns a `Screen` (plus a separate static `Screen`) rather than an ANSI string. Accessible rendering is an explicit text-only result.
5. A `TerminalSession` selects the effective color profile and owns input, capability reports, presentation, terminal modes, cursor state, writes, flush completion, and cleanup. ANSI serialization occurs only at this boundary.

Inline presentation retains the previous structured screen. Stable leading rows are left untouched; updates erase and rewrite only the suffix beginning at the first changed row. Width changes, presentation-mode transitions, external output, suspension, and invalidated terminal state use a safe full rewrite. Interactive writes are enclosed in synchronized-output sequences so capable terminals display each update atomically.

ANSI is an edge format. Ordinary `Text` strips embedded terminal controls.
`AnsiText` parses explicitly trusted external output directly into structured
cells before wrapping. `Transform` remains the more general compatibility path:
it serializes its semantic subtree, invokes the callback, and parses the result
back into cells.

## Package boundaries

- `@alchemy.run/sigil` is the Ink-compatible React surface.
- `@alchemy.run/sigil/ansi` contains the canonical ANSI grammar, escapes, measurement, slicing, wrapping, compatibility styling, and typed OSC integrations for clipboard, progress, notifications, titles, working directories, and pointer shapes.
- `@alchemy.run/sigil/capabilities` separates detected terminal facts, application policy, and effective output profiles.
- `@alchemy.run/sigil/color` contains semantic colors, gradients, interpolation, blending, and palettes.
- `@alchemy.run/sigil/screen` contains cells, geometry, canvases, serialization, and diff encoding.
- `@alchemy.run/sigil/terminal` owns terminal sessions, input decoding, reports, modes, cursor state, and lifecycle.

The emulator-backed test harness, virtual streams, and screen/frame assertions under `src/testing/` are internal while their APIs are evolving.

## Extension rules

React component libraries should stay on the root component API. Terminal integrations should create one `TerminalSession` per stream pair and must call `cleanup()`; cleanup is idempotent. New composition features belong in the React host renderer instead of a parallel scene graph.

Prefer `TerminalSession.copyToClipboard()` and `TerminalSession.setProgress()`
inside applications. They apply tmux passthrough automatically, and session
progress is refreshed once per second so terminal timeout behavior cannot hide
long-running work. Cleanup clears active progress. The lower-level OSC builders
remain available from `@alchemy.run/sigil/ansi` for integrations that own their
writes.

React renderers should prefer `useProgress`, `useClipboard`, `useTitle`,
`useWorkingDirectory`, `useNotification`, and `usePointerShape`. These hooks
publish through the renderer-owned session. Progress publishers share one
registry: the most recently updated mounted publisher is active, and unmounting
it restores the previous publisher or clears terminal progress.
