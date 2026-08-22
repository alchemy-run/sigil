import { createContext } from "react";

import { type ForegroundColorName } from "#/ansi/sgr.ts";
import { type LiteralUnion } from "#/types.ts";

export type BackgroundColor = LiteralUnion<ForegroundColorName, string>;

export const backgroundContext = createContext<BackgroundColor | undefined>(undefined);
