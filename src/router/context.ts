import { createContext, type ReactElement } from "react";

import { type Location, type NavigationType, type Path } from "#/router/history.ts";
import { type RouteMatch } from "#/router/matcher.ts";

/**
The imperative interface `useNavigate` drives. Backed by the memory history
inside `<MemoryRouter>`.
*/
export type Navigator = {
  push: (to: Path, state?: unknown) => void;
  replace: (to: Path, state?: unknown) => void;
  go: (delta: number) => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
};

export type NavigationContextObject = {
  navigator: Navigator;
};

export const NavigationContext = createContext<NavigationContextObject | null>(null);

export type LocationContextObject = {
  location: Location;
  navigationType: NavigationType;
};

export const LocationContext = createContext<LocationContextObject | null>(null);

export type RouteContextObject = {
  outlet: ReactElement | null;
  matches: RouteMatch[];
};

export const RouteContext = createContext<RouteContextObject>({
  outlet: null,
  matches: [],
});

export const OutletContext = createContext<unknown>(null);
