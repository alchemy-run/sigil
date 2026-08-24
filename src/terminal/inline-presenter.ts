import { cliCursor } from "#/ansi/cursor.ts";
import { ansiEscapes } from "#/ansi/escapes.ts";
import {
  buildCursorOnlySequence,
  buildCursorSuffix,
  buildReturnToBottomPrefix,
  cursorPositionChanged,
  hideCursorEscape,
  type CursorPosition,
} from "#/cursor-position.ts";

export type InlinePresenter = {
  clear: () => void;
  done: () => void;
  reset: () => void;
  sync: (output: string) => void;
  setCursorPosition: (position: CursorPosition | undefined) => void;
  isCursorDirty: () => boolean;
  willRender: (output: string) => boolean;
  (output: string): boolean;
};

/** Full-rewrite fallback and cursor state for the structured inline renderer. */
export function createInlinePresenter(
  stream: NodeJS.WritableStream,
  options: { readonly showCursor?: boolean } = {},
): InlinePresenter {
  let previousLineCount = 0;
  let previousOutput = "";
  let hasHiddenCursor = false;
  let cursorPosition: CursorPosition | undefined;
  let cursorDirty = false;
  let previousCursorPosition: CursorPosition | undefined;
  let cursorWasShown = false;
  const showCursor = options.showCursor ?? false;

  const activeCursor = () => (cursorDirty ? cursorPosition : undefined);
  const hasChanges = (output: string, cursor: CursorPosition | undefined) =>
    output !== previousOutput || cursorPositionChanged(cursor, previousCursorPosition);

  const present = (output: string): boolean => {
    if (!showCursor && !hasHiddenCursor) {
      cliCursor.hide(stream);
      hasHiddenCursor = true;
    }
    const cursor = activeCursor();
    cursorDirty = false;
    const cursorChanged = cursorPositionChanged(cursor, previousCursorPosition);
    if (!hasChanges(output, cursor)) return false;
    const lines = output.split("\n");
    const suffix = buildCursorSuffix(lines.length - 1, cursor);
    if (output === previousOutput && cursorChanged) {
      stream.write(
        buildCursorOnlySequence({
          cursorWasShown,
          previousLineCount,
          previousCursorPosition,
          cursorPosition: cursor,
        }),
      );
    } else {
      previousOutput = output;
      stream.write(
        buildReturnToBottomPrefix(cursorWasShown, previousLineCount, previousCursorPosition) +
          ansiEscapes.eraseLines(previousLineCount) +
          output +
          suffix,
      );
      previousLineCount = lines.length;
    }
    previousCursorPosition = cursor ? { ...cursor } : undefined;
    cursorWasShown = cursor !== undefined;
    return true;
  };

  present.clear = () => {
    stream.write(
      buildReturnToBottomPrefix(cursorWasShown, previousLineCount, previousCursorPosition) +
        ansiEscapes.eraseLines(previousLineCount),
    );
    previousOutput = "";
    previousLineCount = 0;
    previousCursorPosition = undefined;
    cursorWasShown = false;
  };
  present.done = () => {
    previousOutput = "";
    previousLineCount = 0;
    previousCursorPosition = undefined;
    cursorWasShown = false;
    if (!showCursor) {
      cliCursor.show(stream);
      hasHiddenCursor = false;
    }
  };
  present.reset = () => {
    previousOutput = "";
    previousLineCount = 0;
    previousCursorPosition = undefined;
    cursorWasShown = false;
  };
  present.sync = (output: string) => {
    const cursor = activeCursor();
    cursorDirty = false;
    const lines = output.split("\n");
    previousOutput = output;
    previousLineCount = lines.length;
    if (!cursor && cursorWasShown) stream.write(hideCursorEscape);
    if (cursor) stream.write(buildCursorSuffix(lines.length - 1, cursor));
    previousCursorPosition = cursor ? { ...cursor } : undefined;
    cursorWasShown = cursor !== undefined;
  };
  present.setCursorPosition = (position: CursorPosition | undefined) => {
    cursorPosition = position;
    cursorDirty = true;
  };
  present.isCursorDirty = () => cursorDirty;
  present.willRender = (output: string) => hasChanges(output, activeCursor());
  return present;
}
