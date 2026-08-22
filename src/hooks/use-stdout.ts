import { useContext } from "react";

import { StdoutContext } from "#/components/StdoutContext.ts";

/**
A React hook that returns the stdout stream where Ink renders your app.
*/
export const useStdout = () => useContext(StdoutContext);
