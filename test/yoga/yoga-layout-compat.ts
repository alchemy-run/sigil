// The vendored upstream Yoga tests import `yoga-layout`'s default export.
// The library itself has no default exports, so the vitest alias points here.
import { Yoga } from "#/yoga/index.ts";

export * from "#/yoga/index.ts";
export default Yoga;
