import { useContext } from "react";

import StderrContext from "../components/StderrContext.ts";

/**
A React hook that returns the stderr stream.
*/
const useStderr = () => useContext(StderrContext);
export default useStderr;
