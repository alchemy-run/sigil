import { createContext } from "react";

import { type CursorPosition } from "#/cursor-position.ts";

export type Props = {
  /**
	Set the cursor position relative to the Ink output.

	Pass `undefined` to hide the cursor.
	*/
  readonly setCursorPosition: (position: CursorPosition | undefined) => void;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const CursorContext = createContext<Props>({
  setCursorPosition() {},
});

CursorContext.displayName = "InternalCursorContext";
