# Yoga

Sigil lays out with `src/yoga/`, a TypeScript port of
[Yoga](https://github.com/facebook/yoga). Upstream is tracked as the
`.vendor/yoga` submodule; the port follows its C++ sources
(`yoga/algorithm/*.cpp`) file for file.

## Verification

- `vp test` runs upstream's JavaScript test suite
  (`.vendor/yoga/javascript/tests`) against the port, plus ports of upstream's
  C++ tests in `test/yoga/`.
- The differential tests and fuzzers (`vpr fuzz:differential`, `vpr fuzz:loop`)
  compare the port against a reference wasm build of the submodule, built by
  `vpr build:reference` into `.reference/` with the patches below applied.
  Failures from the loop fuzzer are recorded in `.reference/fuzz-failures/`.

## Patches

`scripts/build-reference.ts` applies these to the submodule, in order, for the
reference build, and reverts them afterwards:

| Patch                                  | Why                                                                                                                                                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yoga-f64.patch`                       | Yoga compiles with 32-bit floats; JavaScript numbers are doubles. The patch switches Yoga to `double` so the reference matches the port exactly.                                                                      |
| `yoga-flex-item-percent-min-max.patch` | Carries the port's fix for [yoga#872](https://github.com/react/yoga/issues/872) (below), so the fuzzer keeps comparing like with like. Same fix as the unmerged [yoga#1903](https://github.com/react/yoga/pull/1903). |

## Differences from upstream

### Percentage min/max sizes on flex items (yoga#872)

Upstream resolves a flex item's percentage `min-width`/`max-width` (and
heights) against the container's own owner — the item's grandparent — in the
flex-line and free-space steps. A `minWidth="50%"` child of a 10-wide row in an
80-column terminal came out 40 wide.

The port resolves them against the container's content box, gated by a new
errata bit, `FlexItemPercentMinMaxAgainstOwner`:

- New Yoga configs set it, keeping upstream's geometry, so upstream's tests
  pass unchanged. (One Chrome-generated test, `percentage_flex_basis_main_min_width`,
  depends on it: with the fix, Yoga clamps the flex basis too early and gives
  128/72 instead of Chrome's 120/80.)
- Sigil's renderer clears it (`src/dom.ts`), so Box `minWidth`/`maxWidth`
  percentages resolve against the parent.

### Errata defaults

Sigil's renderer config uses Yoga's defaults except for the bit above:
`MinSizeUndefinedInsteadOfAuto` (pre-§4.5 shrink behavior) and
`FlexFirstPassUsesRunningTotals` stay set.

## Known behavior kept on purpose

**Text positions round down.** A node with a measure function is a text node,
which Yoga rounds so its content is never cut off: size up, position down.
Sigil keeps this. As a result, `justifyContent="space-around"` puts two
1-wide texts in a 5-wide row at `A  B` (x = 0.75 and 3.25 both floor), where
Ink's skipped test expects ` A B`. Rounding text like a Box instead
(`setNodeType(NODE_TYPE_DEFAULT)`) fixes that but makes centred text lean
right in odd gaps, lets squeezed text round to zero width, and changes
overlap behavior, so it isn't applied.

## Updating upstream

1. Move `.vendor/yoga` to the new upstream commit.
2. Rebase the patches: apply each in order with `git apply --3way`, resolve,
   and regenerate it from the submodule's diff (applying the earlier patches
   first, so each patch only carries its own change).
3. Port the C++ changes to `src/yoga/`, including new errata and enum values
   in `src/yoga/generated/YGEnums.ts`, and port new C++ tests to `test/yoga/`.
4. `vpr build:reference`, `vp test`, then a long `vpr fuzz:loop`. Add new
   errata defaults to the fuzzer's errata pool in `test/yoga/fuzz/case.ts`.
