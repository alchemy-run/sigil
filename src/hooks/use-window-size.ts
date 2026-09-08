import { useMemo, useSyncExternalStore } from "react";

import { getCapabilities } from "#/capabilities/store.ts";
import { useStdinContext } from "#/hooks/use-stdin.ts";
import { useStdout } from "#/hooks/use-stdout.ts";

/**
Dimensions of the terminal window.
*/
export type WindowSize = {
  /**
	Number of columns (horizontal character cells).
	*/
  readonly columns: number;

  /**
	Number of rows (vertical character cells).
	*/
  readonly rows: number;
};

/**
A React hook that returns the current terminal window dimensions and re-renders the component whenever the terminal is resized.

Reads the capabilities store, so on terminals that send in-band size reports
(mode 2048) the dimensions are the emulator's own, arriving after it has
rewrapped its screen; elsewhere they are the stream's `columns`/`rows`.
Subscribing to dimensions does not initiate capability queries. In-band reports
are used when another consumer has explicitly enabled capability discovery.
*/
export const useWindowSize = (): WindowSize => {
  const { stdin } = useStdinContext();
  const { stdout } = useStdout();
  const store = getCapabilities(stdin, stdout);
  const { size } = useSyncExternalStore(store.subscribe, () => store.current);
  return useMemo(() => ({ columns: size.columns, rows: size.rows }), [size.columns, size.rows]);
};
