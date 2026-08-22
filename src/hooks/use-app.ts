import { useContext } from "react";

import { AppContext } from "#/components/AppContext.ts";

/**
A React hook that returns app lifecycle methods like `exit()` and `waitUntilRenderFlush()`.
*/
export const useApp = () => useContext(AppContext);
