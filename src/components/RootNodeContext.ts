import { createContext } from "react";

import type { DOMElement } from "#/dom.ts";

/**
The `ink-root` node of the tree being rendered, so hooks can subscribe to its layout commits before any of their refs attach.
*/
// eslint-disable-next-line @typescript-eslint/naming-convention
export const RootNodeContext = createContext<DOMElement | undefined>(undefined);

RootNodeContext.displayName = "InternalRootNodeContext";
