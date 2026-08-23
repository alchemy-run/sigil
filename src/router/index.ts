// A purpose-built in-memory router for terminal apps. The matching engine and
// component model are ported from react-router's declarative mode (MIT), with
// everything URL- and DOM-specific removed: no basename, no hash, no percent
// encoding, no data APIs. Route paths are screen states, not URLs.
export type { InitialEntry, Location, NavigationType, Path, To } from "#/router/history.ts";
export { createPath, parsePath } from "#/router/history.ts";
export type { Params, PathMatch, PathPattern, RouteMatch, RouteObject } from "#/router/matcher.ts";
export { generatePath, matchPath, matchRoutes, resolvePath } from "#/router/matcher.ts";
export type { Navigator } from "#/router/context.ts";
export type { NavigateFunction, NavigateOptions } from "#/router/hooks.tsx";
export {
  createSearchParams,
  useInRouterContext,
  useLocation,
  useMatch,
  useNavigate,
  useNavigationStack,
  useNavigationType,
  useOutlet,
  useOutletContext,
  useParams,
  useResolvedPath,
  useRoutes,
  useSearchParams,
} from "#/router/hooks.tsx";
export type {
  LinkProps,
  MemoryRouterProps,
  NavigateProps,
  OutletProps,
  RouteProps,
  RoutesProps,
} from "#/router/components.tsx";
export { Link, MemoryRouter, Navigate, Outlet, Route, Routes } from "#/router/components.tsx";
