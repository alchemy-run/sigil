/** @jsxImportSource react */
// Ported from react-router's declarative-mode hooks (lib/hooks.tsx, MIT),
// with the data-router branches removed.
import {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactElement,
} from "react";

import {
  LocationContext,
  NavigationContext,
  OutletContext,
  RouteContext,
} from "#/router/context.ts";
import {
  parsePath,
  type Location,
  type NavigationType,
  type Path,
  type To,
} from "#/router/history.ts";
import {
  getResolveToMatches,
  joinPaths,
  matchPath,
  matchRoutes,
  resolveTo,
  type Params,
  type PathMatch,
  type PathPattern,
  type RouteMatch,
  type RouteObject,
} from "#/router/matcher.ts";

const warned = new Set<string>();
const warnOnce = (key: string, message: string): void => {
  if (!warned.has(key)) {
    warned.add(key);
    console.warn(message);
  }
};

/**
Returns `true` when rendered inside a `<MemoryRouter>`. Useful for components
that optionally integrate with routing.
*/
export const useInRouterContext = (): boolean => useContext(LocationContext) != null;

/**
Returns the current `Location`.
*/
export const useLocation = (): Location => {
  const locationContext = useContext(LocationContext);
  if (!locationContext) {
    throw new Error("useLocation() may be used only in the context of a <MemoryRouter> component.");
  }

  return locationContext.location;
};

/**
Returns the type of navigation that produced the current location: `"POP"`,
`"PUSH"`, or `"REPLACE"`.
*/
export const useNavigationType = (): NavigationType => {
  const locationContext = useContext(LocationContext);
  if (!locationContext) {
    throw new Error(
      "useNavigationType() may be used only in the context of a <MemoryRouter> component.",
    );
  }

  return locationContext.navigationType;
};

const useNavigationContext = (hookName: string) => {
  const navigationContext = useContext(NavigationContext);
  if (!navigationContext) {
    throw new Error(`${hookName} may be used only in the context of a <MemoryRouter> component.`);
  }

  return navigationContext;
};

export type NavigateOptions = {
  /**
	Replace the current entry in the navigation stack instead of pushing a new
	one.
	*/
  replace?: boolean;

  /**
	Arbitrary state to attach to the destination location, readable via
	`useLocation().state`. Held in memory, never serialized.
	*/
  state?: unknown;
};

/**
Navigates to a destination, or through the navigation stack when passed a
number (`navigate(-1)` goes back).
*/
export type NavigateFunction = {
  (to: To, options?: NavigateOptions): void;
  (delta: number): void;
};

/**
Returns a stable function for imperative navigation.
*/
export const useNavigate = (): NavigateFunction => {
  const { navigator } = useNavigationContext("useNavigate()");
  const { matches } = useContext(RouteContext);
  const { pathname: locationPathname } = useLocation();

  const routePathnamesJson = JSON.stringify(getResolveToMatches(matches));

  // Navigating before the component has mounted (i.e. during render) is a
  // side effect in render; ignore it. Use <Navigate> or an effect instead.
  const activeRef = useRef(false);
  useLayoutEffect(() => {
    activeRef.current = true;
  });

  return useCallback(
    (to: To | number, options: NavigateOptions = {}) => {
      if (!activeRef.current) {
        return;
      }

      if (typeof to === "number") {
        navigator.go(to);
        return;
      }

      const path = resolveTo(to, JSON.parse(routePathnamesJson) as string[], locationPathname);
      (options.replace ? navigator.replace : navigator.push)(path, options.state);
    },
    [navigator, routePathnamesJson, locationPathname],
  );
};

/**
Returns whether the navigation stack has entries behind/ahead of the current
one — i.e. whether `navigate(-1)` / `navigate(1)` will move anywhere. Handy
for "Esc goes back, unless at root" bindings.
*/
export const useNavigationStack = (): { canGoBack: boolean; canGoForward: boolean } => {
  const { navigator } = useNavigationContext("useNavigationStack()");
  // Reading location subscribes this component to navigation changes, so the
  // returned booleans stay fresh.
  useLocation();

  return {
    canGoBack: navigator.canGoBack(),
    canGoForward: navigator.canGoForward(),
  };
};

/**
Returns the params from all dynamic segments matched by the current route and
its ancestors.
*/
export const useParams = <
  ParamsOrKey extends Record<string, string | undefined> | string = string,
>(): Readonly<[ParamsOrKey] extends [string] ? Params<ParamsOrKey> : Partial<ParamsOrKey>> => {
  const { matches } = useContext(RouteContext);
  const routeMatch = matches[matches.length - 1];
  return (routeMatch ? routeMatch.params : {}) as Readonly<
    [ParamsOrKey] extends [string] ? Params<ParamsOrKey> : Partial<ParamsOrKey>
  >;
};

/**
Matches a path pattern against the current location's pathname. Returns the
match (with params) or `null`.
*/
export const useMatch = <ParamKey extends string = string>(
  pattern: PathPattern | string,
): PathMatch<ParamKey> | null => {
  const { pathname } = useLocation();
  return matchPath<ParamKey>(pattern, pathname);
};

/**
Resolves a `To` value against the current route, exactly as `useNavigate`
would. Useful for building navigation UI.
*/
export const useResolvedPath = (to: To): Path => {
  const { matches } = useContext(RouteContext);
  const { pathname: locationPathname } = useLocation();
  return resolveTo(to, getResolveToMatches(matches), locationPathname);
};

/**
Returns the element for the child route at this level of the route hierarchy,
or `null` if there is none. Used internally by `<Outlet>`.
*/
export const useOutlet = (context?: unknown): ReactElement | null => {
  const { outlet } = useContext(RouteContext);
  if (outlet) {
    return <OutletContext.Provider value={context}>{outlet}</OutletContext.Provider>;
  }

  return outlet;
};

/**
Returns the value passed to the nearest parent `<Outlet context={...}>`.
*/
export const useOutletContext = <Context = unknown,>(): Context =>
  useContext(OutletContext) as Context;

type SearchParamsInit = string | string[][] | Record<string, string | string[]> | URLSearchParams;

/**
Creates a `URLSearchParams` from common initializer shapes, including
`{ key: ["a", "b"] }` for repeated keys.
*/
export const createSearchParams = (init: SearchParamsInit = ""): URLSearchParams =>
  new URLSearchParams(
    typeof init === "string" || Array.isArray(init) || init instanceof URLSearchParams
      ? init
      : Object.keys(init).flatMap((key) => {
          const value = init[key];
          return Array.isArray(value)
            ? value.map((v) => [key, v] as [string, string])
            : [[key, value] as [string, string]];
        }),
  );

type SetSearchParams = (
  nextInit: SearchParamsInit | ((prev: URLSearchParams) => SearchParamsInit),
  navigateOptions?: NavigateOptions,
) => void;

/**
Returns the current location's search params and a setter that navigates to
the same pathname with the new params.
*/
export const useSearchParams = (
  defaultInit?: SearchParamsInit,
): [URLSearchParams, SetSearchParams] => {
  const defaultSearchParamsRef = useRef(createSearchParams(defaultInit));
  const hasSetSearchParamsRef = useRef(false);

  const location = useLocation();
  const searchParams = useMemo(() => {
    const params = createSearchParams(location.search);

    // Fill in defaults only until the setter is first used, so cleared params
    // don't resurrect their default values.
    if (!hasSetSearchParamsRef.current) {
      for (const key of defaultSearchParamsRef.current.keys()) {
        if (!params.has(key)) {
          for (const value of defaultSearchParamsRef.current.getAll(key)) {
            params.append(key, value);
          }
        }
      }
    }

    return params;
  }, [location.search]);

  const navigate = useNavigate();
  const setSearchParams = useCallback<SetSearchParams>(
    (nextInit, navigateOptions) => {
      const newSearchParams = createSearchParams(
        typeof nextInit === "function" ? nextInit(new URLSearchParams(searchParams)) : nextInit,
      );
      hasSetSearchParamsRef.current = true;
      navigate(`?${newSearchParams.toString()}`, navigateOptions);
    },
    [navigate, searchParams],
  );

  return [searchParams, setSearchParams];
};

/**
Matches a set of route objects against the current location (or an override)
and returns the rendered element tree. The plain-object alternative to
`<Routes>`.
*/
export const useRoutes = (
  routes: RouteObject[],
  locationArg?: Partial<Location> | string,
): ReactElement | null => {
  if (!useInRouterContext()) {
    throw new Error("useRoutes() may be used only in the context of a <MemoryRouter> component.");
  }

  const { matches: parentMatches } = useContext(RouteContext);
  const routeMatch = parentMatches[parentMatches.length - 1];
  const parentParams = routeMatch ? routeMatch.params : {};
  const parentPathnameBase = routeMatch ? routeMatch.pathnameBase : "/";
  const parentRoute = routeMatch?.route;

  const locationFromContext = useLocation();

  let location;
  if (locationArg) {
    const parsedLocationArg =
      typeof locationArg === "string" ? parsePath(locationArg) : locationArg;

    if (parentPathnameBase !== "/" && !parsedLocationArg.pathname?.startsWith(parentPathnameBase)) {
      throw new Error(
        `When overriding the location using \`<Routes location>\` or \`useRoutes(routes, location)\`, ` +
          `the location pathname must begin with the portion of the pathname that was matched by ` +
          `all parent routes. The current pathname base is "${parentPathnameBase}" but pathname ` +
          `"${parsedLocationArg.pathname}" was given in the \`location\` prop.`,
      );
    }

    location = parsedLocationArg;
  } else {
    location = locationFromContext;
  }

  const pathname = location.pathname ?? "/";

  let remainingPathname = pathname;
  if (parentPathnameBase !== "/") {
    const parentSegments = parentPathnameBase.replace(/^\//, "").split("/");
    const segments = pathname.replace(/^\//, "").split("/");
    remainingPathname = `/${segments.slice(parentSegments.length).join("/")}`;
  }

  const matches = matchRoutes(routes, { pathname: remainingPathname });

  // Descendant <Routes> under a parent route without a trailing "*" can never
  // see deeper paths — the parent stops matching as soon as the location goes
  // past its own path.
  const parentPath = parentRoute?.path ?? "";
  if (parentRoute && !parentPath.endsWith("*")) {
    warnOnce(
      `descendant-routes:${routeMatch.pathname}`,
      `You rendered descendant <Routes> (or called useRoutes()) at "${routeMatch.pathname}" ` +
        `(under <Route path="${parentPath}">) but the parent route path has no trailing "*". ` +
        `This means if you navigate deeper, the parent won't match anymore and therefore the ` +
        `child routes will never render. Please change the parent to <Route path="${
          parentPath === "/" ? "*" : `${parentPath}/*`
        }">.`,
    );
  }

  if (matches == null && !parentRoute) {
    warnOnce(
      `no-match:${pathname}${location.search ?? ""}`,
      `No routes matched location "${pathname}${location.search ?? ""}".`,
    );
  }

  return renderMatches(
    matches &&
      matches.map((match) => ({
        ...match,
        params: { ...parentParams, ...match.params },
        pathname: joinPaths([parentPathnameBase, match.pathname]),
        pathnameBase:
          match.pathnameBase === "/"
            ? parentPathnameBase
            : joinPaths([parentPathnameBase, match.pathnameBase]),
      })),
    parentMatches,
  );
};

function renderMatches(
  matches: RouteMatch[] | null,
  parentMatches: RouteMatch[],
): ReactElement | null {
  if (matches == null) {
    return null;
  }

  return matches.reduceRight<ReactElement | null>((outlet, match, index) => {
    const matchesUpToHere = parentMatches.concat(matches.slice(0, index + 1));

    return (
      <RouteContext.Provider value={{ outlet, matches: matchesUpToHere }}>
        {match.route.element ?? outlet}
      </RouteContext.Provider>
    );
  }, null);
}
