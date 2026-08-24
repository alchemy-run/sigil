# API stability

Sigil is pre-1.0. The root `@alchemy.run/sigil` entry point targets Ink-compatible component and lifecycle behavior and is guarded by runtime and compile-time contract tests.

Focused subpaths are the preferred home for terminal-core APIs:

- `ansi`, `capabilities`, `color`, `screen`, `style`, and `terminal` are experimental while their types are refined.
- `testing` is test-support API and may evolve with the emulator and frame model.
- New low-level primitives are not added to the root entry point unless they directly extend an Ink-compatible component prop.

Breaking a subpath API is allowed before 1.0 when it produces a more cohesive model. Release notes must call out migrations. The root component surface receives a higher compatibility bar, but Sigil may deliberately diverge where maintaining Ink behavior would compromise terminal correctness.
