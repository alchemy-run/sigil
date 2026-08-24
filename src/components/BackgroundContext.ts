import { createContext } from "react";

import type { Paint } from "#/color/paint.ts";

export type BackgroundColor = Paint;

export const backgroundContext = createContext<BackgroundColor | undefined>(undefined);
