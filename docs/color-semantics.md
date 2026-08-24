# Color and composition semantics

Colors remain full-precision semantic values until terminal serialization. The session then emits truecolor, quantizes to ANSI-256 or ANSI-16, or emits no color according to its effective profile. Named ANSI colors resolve through the terminal-reported palette when available and otherwise use the canonical xterm-compatible palette.

Linear gradients are sampled over the final laid-out paint rectangle. OKLab is the default interpolation space; CIELAB, RGB, and HSV are available explicitly. `perimeterGradient()` wraps a discrete CIELAB blend clockwise around a rectangle, accepts a cell offset for rotation, and matches Lip Gloss border-blend sampling. Alpha composites only when the destination channel is known.

An omitted `Box` background is transparent during composition. `backgroundColor=""` instead paints explicit blank cells with the terminal-default background, which erases lower-layer glyphs without drawing a hard-coded color.

CSS-style blend modes are intentionally deferred. A terminal cell has foreground and background channels rather than a browser compositing surface, and terminals may reinterpret bold and indexed colors. A blend-mode API needs explicit rules for unknown destination colors, inverse text, glyph replacement, and profile quantization before it can be stable.

Text dithering is also deferred because alternating foreground cells harms readability and animation stability. Optional ordered dithering may be appropriate for large, background-only, static regions after visual and byte-cost benchmarks establish useful defaults. It must never be silently applied to text.
