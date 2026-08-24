import { useContext, useRef, useCallback, useInsertionEffect } from "react";

import { CursorContext } from "#/components/CursorContext.ts";
import { type CursorPosition } from "#/cursor-position.ts";

/**
A React hook that returns methods to control the terminal cursor position.

Setting a cursor position makes the cursor visible at the specified coordinates (relative to the Ink output origin). This is useful for IME (Input Method Editor) support, where the composing character is displayed at the cursor location.

Pass `undefined` to hide the cursor.
*/
export const useCursor = () => {
  const context = useContext(CursorContext);
  const positionRef = useRef<CursorPosition | undefined>(undefined);

  const setCursorPosition = useCallback((position: CursorPosition | undefined) => {
    positionRef.current = position;
  }, []);

  // Propagate cursor position to the terminal presenter only during commit.
  // useInsertionEffect runs before resetAfterCommit (which triggers onRender),
  // and does NOT run for abandoned concurrent renders (e.g. suspended components).
  // This prevents cursor state from leaking across render boundaries.
  useInsertionEffect(() => {
    context.setCursorPosition(positionRef.current);
    return () => {
      context.setCursorPosition(undefined);
    };
  });

  return { setCursorPosition };
};
