# Sigil terminal-core roadmap

> Status (2026-08-24): the structured-renderer migration is complete. The
> historical phases below record how the prototype arrived here; this section is
> the authoritative description of the active runtime.

## Current objective: one structured render pipeline

Sigil only needs Ink's React composition model. Public API compatibility and
ANSI-output compatibility are not goals unless a Sigil consumer explicitly
needs them.

### 1. Make `Screen` the renderer result

- [x] Remove the public `incrementalRendering` option.
- [x] Present structured screens through the session-owned presenter.
- [x] Return structured frames from the renderer instead of `{output, screen}`
      hybrids.
- [x] Remove eager serialization and the `ScreenCanvas.get()` string snapshot.
- [x] Keep accessible output as an explicit text-only render result.
- [x] Represent static output as a separate screen until the terminal boundary.

### 2. Collapse the host painting path

- [x] Replace `Output`/`ScreenCanvas` with clipped painting into `Screen`.
- [x] Replace `renderNodeToOutput` with the small `paintTree` traversal.
- [x] Store semantic text styles on host nodes only; remove native Chalk
      transforms.
- [x] Flatten nested text into styled graphemes, wrap it, resolve paints at final
      bounds, and write resolved cells directly.
- [x] Remove `StyledChar` and identity-based metadata side channels from native
      rendering.
- [x] Strip ANSI from ordinary text and keep ANSI generation at an explicit
      `Transform` boundary rather than detecting it inside native text.
- [x] Preserve `<Transform>` through one serialize/callback/parse adapter.
- [x] Provide `AnsiText` as the direct structured boundary for trusted external
      ANSI logs and tool output.
- [x] Expose typed OSC helpers for clipboard, terminal progress, notifications,
      titles, working directories, and pointer shapes; integrate clipboard and
      progress with `TerminalSession` lifecycle and tmux passthrough.
- [x] Add React OSC hooks backed by the renderer-owned terminal session and a
      centralized progress publisher registry.

### 3. Give the terminal session presentation ownership

- [x] Move frame comparison, cursor movement, fallback redraws, encoding, and
      writes behind `TerminalSession.present(frame)`.
- [x] Delete `log-update` and remove the inline string presenter from normal
      rendering; its text presenter remains accessibility-only.
- [x] Make resize, suspend/resume, alternate-screen transitions, and cleanup
      invalidate one session-owned frame state.
- [x] Route normal rendering and presentation through `renderFrame` and the
      terminal session.
- [x] Differentially rewrite inline frames from their first changed row while
      retaining synchronized-output atomicity and safe full-redraw fallbacks.

### 4. Remove speculative and duplicate abstractions

- [x] Either use `Drawable`/`Scene` as the React painting mechanism or remove
      them until layers and portals require them.
- [x] Remove duplicate active-path frame buffers, string renderers, text styles,
      and color state.
- [x] Keep ANSI parsing/serialization as terminal-boundary and explicit-transform
      utilities, not renderer intermediates.
- [x] Review subpath exports against actual consumer needs and remove unused
      public surface.

### 5. Prove the converged runtime

- [x] Preserve tests describing desired React composition, layout, input,
      focus, lifecycle, and accessibility behavior.
- [x] Replace obsolete raw-ANSI-in-`Text` expectations with the structured-text
      contract.
- [x] Test full redraw, sparse diff, resize, wide grapheme, static output,
      alternate screen, suspend/resume, and cleanup through the single pipeline.
- [x] Fix process listener leaks and make typecheck and the full test suite clean.
- [x] Commit the convergence in reviewable checkpoints before adding more
      terminal-core features.

Sigil should provide an Ink-familiar React API backed by a cohesive, cell-based terminal runtime. Compatibility is preserved where it does not compromise the architecture; Sigil's own consumers may migrate across deliberate API improvements.

## Invariants

- [x] Preserve the useful Ink-compatible component model while allowing deliberate API improvements.
- [x] Keep React as the application and state model; do not introduce a competing `Init`/`Update`/`View` framework.
- [x] Keep semantic colors, styles, links, and graphemes structured until terminal serialization.
- [x] Treat ANSI as an input/output encoding, not the renderer's intermediate representation.
- [x] Scope terminal state, capabilities, color policy, and output buffers to a render instance and stream.
- [x] Use one canonical ANSI grammar and one canonical grapheme-width implementation throughout the project.
- [x] Preserve attribution for retained or derived code; prefer cohesive implementations and upstream specifications over additional piecemeal ports.

## Phase 0: Freeze the compatibility contract

- [x] Record the complete `"."` runtime export surface.
- [x] Record the complete `"."` TypeScript export surface.
- [x] Define the compatibility target: the component/lifecycle behavior suite is retained; terminal-core extensions live on focused subpaths.
- [x] Add the initial compile-time contract for Ink-compatible components, `render()`, render options, and render instances.
- [x] Add behavior fixtures covering:
  - [x] `Text`, nested `Text`, modifiers, colors, and wrapping.
  - [x] `Box`, Yoga layout, borders, padding, margins, and overflow.
  - [x] `Static`, `Transform`, `Newline`, and `Spacer`.
  - [x] Input, focus, cursor, stdout/stderr, and app lifecycle hooks.
  - [x] Interactive, non-interactive, alternate-screen, and screen-reader modes.
  - [x] `renderToString()`.
- [x] Exercise representative third-party Ink components through package aliasing.
- [x] Capture baseline renderer benchmarks: frame time, allocations, output bytes, and changed-cell workloads.
- [x] Make the compatibility suite a required gate for the remaining phases.

## Phase 1: Establish structured terminal primitives

- [x] Design immutable public/internal types for:
  - [x] `Color` and the absence of a color value.
  - [x] `CellStyle`, including foreground, background, underline color, underline style, and attribute flags.
  - [x] `Hyperlink`.
  - [x] `Cell`, containing one grapheme cluster, display width, style, and link.
  - [x] `Point`, `Rect`, and clipping regions.
  - [x] `Line` and `Screen`.
- [x] Distinguish an unwritten/transparent cell from an explicit blank cell.
- [x] Define channel-level composition semantics for glyphs, foregrounds, backgrounds, modifiers, and links.
- [x] Consolidate grapheme segmentation and terminal width calculation behind one service.
- [x] Consolidate ANSI parsing behind one ECMA-48 parser.
- [x] Parse external ANSI strings into structured cells without losing:
  - [x] Compound and colon-form SGR sequences.
  - [x] 16-, 256-, and 24-bit colors.
  - [x] Underline styles and underline colors.
  - [x] OSC 8 hyperlinks.
  - [x] Combining and double-width graphemes.
- [x] Serialize structured cell runs into minimal ANSI style/link transitions.
- [x] Add round-trip, malformed-input, property, and fuzz tests.

## Phase 2: Replace `Output` with a cell screen

- [x] Implement a resizable `Screen`/`Canvas` cell buffer.
- [x] Support rectangular fill, clipping, and ordered drawing.
- [x] Correctly clear both halves of partially overwritten wide graphemes.
- [x] Preserve a destination background when a later glyph has no explicit background.
- [x] Allow an explicit source background to replace the destination background.
- [x] Track dirty cells or dirty spans as drawing occurs.
- [x] Evaluate a `Drawable` extension point, then remove it when the React renderer converged on direct canvas painting.
- [x] Adapt the existing renderer to draw into `Screen` while keeping the root React API unchanged.
- [x] Retain an ANSI compatibility path for `<Transform>` and pre-styled external strings.
- [x] Remove normal text/background/border rendering's dependency on ANSI tokenization.
- [x] Match the Phase 0 output fixtures before removing the old `Output` implementation.

## Phase 3: Make terminal capabilities and color instance-scoped

- [x] Separate terminal facts from user color policy:
  - [x] Detected/reported terminal color capability.
  - [x] `NO_COLOR`, `FORCE_COLOR`, and explicit render policy.
  - [x] Effective output color profile.
- [x] Define profiles for no-color, ANSI-16, ANSI-256, and truecolor output.
- [x] Move the effective profile from global `chalk.level` state into the render/session instance.
- [x] Pass the effective profile to screen serialization and terminal diffing.
- [x] Apply capability-query upgrades to the correct output stream.
- [x] Schedule a redraw when a capability or terminal palette change affects rendered output.
- [x] Resolve named ANSI colors through the terminal-reported palette when available.
- [x] Use a documented canonical palette until a terminal palette reply is available.
- [x] Add an explicit `renderToString()` color-profile option for deterministic output.
- [x] Test simultaneous render instances with different streams and color profiles.
- [x] Decide and document how already-emitted `<Static>` content behaves after a profile upgrade.

## Phase 4: Introduce a terminal session

- [x] Create a `TerminalSession` foundation that owns:
  - [x] stdin, stdout, and stderr.
  - [x] Capability state and terminal queries.
  - [x] Input decoding and report ingestion.
  - [x] Enabled terminal modes and their cleanup.
  - [x] Cursor position, shape, visibility, and color.
  - [x] Current and next screens.
  - [x] Output buffering, backpressure, and flush completion.
  - [x] Suspend/resume and terminal restoration.
  - [x] Alternate-screen and inline-screen state.
- [x] Split scheduling, console capture, terminal modes, rendering, presentation, and lifecycle management out of `ink.tsx`.
- [x] Make session cleanup idempotent and safe during errors, signals, React cleanup, and partial initialization.
- [x] Ensure multiple sessions cannot accidentally share mutable terminal state.
- [x] Preserve `render()`'s existing synchronous Ink-compatible return value while asynchronous terminal discovery continues through the session.

## Phase 5: Replace line-string updates with cell diffing

- [x] Maintain current and next screen buffers.
- [x] Diff styled cells rather than completed ANSI strings.
- [x] Emit minimal style and hyperlink transitions.
- [x] Track the terminal cursor and current pen style.
- [x] Choose efficient absolute or relative cursor movement based on available capabilities and output cost.
- [x] Skip unchanged cells and lines.
- [x] Handle frame growth, shrinkage, terminal resize, wrapping, and bottom-margin scrolling through cell diffs or explicit safe full-frame fallbacks.
- [x] Treat inline and alternate-screen rendering as explicit strategies.
- [x] Integrate synchronized output when supported.
- [x] Retain safe full-redraw fallbacks for unknown or inconsistent terminal state.
- [x] Replace `log-update` in the renderer after parity tests pass; retain its standalone compatibility tests until removal.
- [x] Compare output correctness in Ghostty WASM and xterm-based test environments.
- [x] Benchmark sparse updates, animation, large tables, full-screen redraws, and wide-grapheme workloads.

## Phase 6: Move the React host renderer to structured drawing

- [x] Store semantic style data on host nodes alongside the compatibility transform while native text migration is in progress.
- [x] Draw `Box` backgrounds and borders directly into the screen.
- [x] Remove solid-background inheritance through ANSI-wrapping React context once cell composition provides equivalent behavior.
- [x] Rasterize native text after Yoga layout and wrapping, using final cell coordinates.
- [x] Make clipping and overflow operate on cell rectangles.
- [x] Keep `<Transform>` as an explicit compatibility boundary:
  - [x] Serialize the transformed subtree.
  - [x] Invoke the user callback.
  - [x] Parse the callback result back into structured cells.
- [x] Make `renderToString()` and interactive rendering consume the same structured scene.
- [x] Remove encode-to-ANSI-then-parse loops from all native rendering paths.

## Phase 7: Publish cohesive subpath APIs

- [x] Redesign `@alchemy.run/sigil/ansi` around the canonical parser, serializer, measurement, slicing, wrapping, and escape primitives.
- [x] Redesign `@alchemy.run/sigil/capabilities` around stream-scoped stores, facts, policy, and effective profiles.
- [x] Add `@alchemy.run/sigil/terminal` for sessions, events, modes, and terminal lifecycle.
- [x] Add `@alchemy.run/sigil/screen` for cells, screens, canvases, serialization, diffing, and geometry.
- [x] Add `@alchemy.run/sigil/color` for colors, profiles, interpolation, quantization, and paints.
- [x] Add `@alchemy.run/sigil/testing` for virtual streams, screen assertions, terminal emulation, and frame recording.
- [x] Keep new primitives mostly out of the root entry point unless they directly extend an Ink-compatible component prop.
- [x] Document which subpath APIs are stable and which remain experimental.

## Phase 8: Add native colors, gradients, and composition

- [x] Define a common `Paint` type accepted by supported foreground and background props.
- [x] Add color constructors for RGB, indexed ANSI, named ANSI, adaptive light/dark, and explicit per-profile colors.
- [x] Add reusable color interpolation and blending utilities.
- [x] Implement linear gradients with:
  - [x] Two or more stops.
  - [x] Explicit stop offsets.
  - [x] Horizontal, vertical, and angled projection.
  - [x] OKLab default interpolation.
  - [x] Optional CIELAB, RGB, and HSV interpolation.
- [x] Add clockwise perimeter gradients with cell rotation and Lip Gloss `Blend1D` parity for smooth border blends.
- [x] Sample gradients analytically across the final laid-out paint rectangle.
- [x] Sample at full color precision before profile quantization.
- [x] Downsample each sampled color to ANSI-256 or ANSI-16 at serialization.
- [x] Emit no color styling while preserving content and layout for no-color output.
- [x] Coalesce adjacent cells that quantize to the same terminal color.
- [x] Support native text foreground and background gradients.
- [x] Support `Box` background gradients while preserving them beneath child text.
- [x] Add border paints after text and box backgrounds are stable.
- [x] Represent alpha internally and composite it against known destination cells.
- [x] Defer CSS-like blend modes and default text dithering until their terminal semantics are specified.
- [x] Consider optional ordered dithering for large background-only regions; defer it pending dedicated visual and animation-stability measurements.

## Phase 9: Layers, interaction, and extension points

- [x] Remove the unused standalone scene graph, drawable, overlay, and hit-testing prototypes.
- [ ] Add layers, portals, and pointer routing through React composition when a consumer needs them.

## Phase 10: Quality and ecosystem readiness

- [x] Add model-based tests for cursor, pen, screen, and terminal mode state.
- [x] Add differential tests against terminal emulators and selected Charm behavior where semantics match.
- [x] Expand fuzzing for wrapping, clipping, screen composition, and resize sequences. (ANSI parsing/property fuzzing is covered.)
- [x] Add golden tests for every color profile and terminal appearance.
- [x] Add failure-injection tests for interrupted writes, closed streams, suspend/resume, and query timeouts.
- [x] Establish performance budgets for render latency, allocations, and emitted bytes.
- [x] Add examples for standalone styling, React applications, gradients, layers, mouse interaction, and alternate-screen applications.
- [x] Publish an architecture guide for component authors and low-level renderer integrations.
- [x] Audit third-party notices after each replaced implementation; remove notices only when no derived code remains.

## First delivery milestone

The first milestone is complete when:

- [x] The root compatibility suite passes unchanged.
- [x] Native `Text`, `Box`, and border rendering produce structured cells without creating intermediate ANSI strings.
- [x] Rendering is stream/profile scoped and responds correctly to capability upgrades.
- [x] The cell renderer can perform correct full and incremental updates.
- [x] `<Transform>` remains compatible through the explicit ANSI adapter.
- [x] The legacy `Output`, renderer `log-update`, and global color-state dependencies are removed from the active rendering pipeline.

Only after this milestone should native gradients become the primary feature deliverable.
