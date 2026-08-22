import { useContext } from "react";

import { StderrContext } from "#/components/StderrContext.ts";

/**
A React hook that returns the stderr stream.
*/
export const useStderr = () => useContext(StderrContext);
