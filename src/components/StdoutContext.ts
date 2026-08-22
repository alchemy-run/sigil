import { createContext } from "react";

import type { OutputStream } from "#/stream.ts";

export type Props = {
  /**
	Stdout stream passed to `render()` in `options.stdout` or `process.stdout` by default.
	*/
  readonly stdout: OutputStream;

  /**
	Write any string to stdout while preserving Ink's output. It's useful when you want to display external information outside of Ink's rendering and ensure there's no conflict between the two. It's similar to `<Static>`, except it can't accept components; it only works with strings.
	*/
  readonly write: (data: string) => void;
};

/**
`StdoutContext` is a React context that exposes the stdout stream where Ink renders your app.
*/
// eslint-disable-next-line @typescript-eslint/naming-convention
export const StdoutContext = createContext<Props>({
  stdout: process.stdout,
  write() {},
});

StdoutContext.displayName = "InternalStdoutContext";
