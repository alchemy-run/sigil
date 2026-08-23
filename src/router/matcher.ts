// Route matching, ranking, and path resolution. Ported from react-router's
// agnostic matcher (lib/router/utils.ts, MIT) with the URL-specific parts
// removed: no basename, no percent-encoding/decoding, and matching is always
// case-sensitive — route paths are code constants, not user-typed URLs.
import { type ReactNode } from "react";

import { parsePath, type Location, type Path, type To } from "#/router/history.ts";

/**
A route definition. Used as JSX via `<Route>` or passed as plain objects to
`useRoutes`.
*/
export type RouteObject = {
  /**
	The path pattern to match against the current location, relative to the
	parent route. Supports `:param` dynamic segments, optional segments
	(`:param?`, `edit?`), and a trailing `*` splat.
	*/
  path?: string;

  /**
	An index route renders in its parent's `<Outlet>` at the parent's exact path.
	Index routes cannot have children.
	*/
  index?: boolean;

  /**
	The element to render when this route matches.
	*/
  element?: ReactNode;

  /**
	Nested child routes, rendered into this route's `<Outlet>`.
	*/
  children?: RouteObject[];
};

/**
Parsed params from dynamic segments of a matched path. The splat segment, if
any, is available under the `"*"` key.
*/
export type Params<Key extends string = string> = {
  readonly [key in Key]: string | undefined;
};

/**
A route object matched against a location, along with the params and the
portion of the pathname it consumed.
*/
export type RouteMatch<RouteObjectType extends RouteObject = RouteObject> = {
  params: Params;
  pathname: string;
  pathnameBase: string;
  route: RouteObjectType;
};

/**
A pattern for matching some portion of a pathname with `matchPath`.
*/
export type PathPattern = {
  /**
	The path pattern to match against.
	*/
  path: string;

  /**
	Should be `true` (the default) if the pattern must consume the entire
	pathname; `false` allows matching a prefix.
	*/
  end?: boolean;
};

/**
The result of matching a `PathPattern` against a pathname.
*/
export type PathMatch<ParamKey extends string = string> = {
  params: Params<ParamKey>;
  pathname: string;
  pathnameBase: string;
  pattern: PathPattern;
};

export const joinPaths = (paths: string[]): string => paths.join("/").replace(/\/\/+/g, "/");

export const normalizePathname = (pathname: string): string =>
  pathname.replace(/\/+$/, "").replace(/^\/*/, "/");

export const normalizeSearch = (search: string): string =>
  !search || search === "?" ? "" : search.startsWith("?") ? search : `?${search}`;

type RouteMeta<RouteObjectType extends RouteObject> = {
  relativePath: string;
  childrenIndex: number;
  route: RouteObjectType;
};

type RouteBranch<RouteObjectType extends RouteObject> = {
  path: string;
  score: number;
  routesMeta: RouteMeta<RouteObjectType>[];
};

/**
Matches a set of (possibly nested) routes against a location and returns the
chain of matches from the root route down to the leaf, or `null` if nothing
matches.
*/
export function matchRoutes<RouteObjectType extends RouteObject = RouteObject>(
  routes: RouteObjectType[],
  locationArg: Partial<Location> | string,
): RouteMatch<RouteObjectType>[] | null {
  const location = typeof locationArg === "string" ? parsePath(locationArg) : locationArg;
  const pathname = location.pathname ?? "/";

  const branches = flattenRoutes(routes);
  rankRouteBranches(branches);

  let matches = null;
  for (let index = 0; matches == null && index < branches.length; index++) {
    matches = matchRouteBranch(branches[index]!, pathname);
  }

  return matches;
}

function flattenRoutes<RouteObjectType extends RouteObject>(
  routes: RouteObjectType[],
  branches: RouteBranch<RouteObjectType>[] = [],
  parentsMeta: RouteMeta<RouteObjectType>[] = [],
  parentPath = "",
  hasParentOptionalSegments = false,
): RouteBranch<RouteObjectType>[] {
  const flattenRoute = (
    route: RouteObjectType,
    index: number,
    insideOptional: boolean,
    relativePath = route.path ?? "",
  ): void => {
    const meta: RouteMeta<RouteObjectType> = {
      relativePath,
      childrenIndex: index,
      route,
    };

    if (meta.relativePath.startsWith("/")) {
      if (!meta.relativePath.startsWith(parentPath)) {
        // Optional-segment explosion produces sibling variants that can't all
        // line up with an absolute child path; discard the mismatches.
        if (insideOptional) {
          return;
        }

        throw new Error(
          `Absolute route path "${meta.relativePath}" nested under path "${parentPath}" is not valid. ` +
            `An absolute child route path must start with the combined path of all its parent routes.`,
        );
      }

      meta.relativePath = meta.relativePath.slice(parentPath.length);
    }

    const path = joinPaths([parentPath, meta.relativePath]);
    const routesMeta = parentsMeta.concat(meta);

    // Traverse depth-first so child routes rank before their parents in the
    // flattened list.
    if (route.children && route.children.length > 0) {
      if (route.index) {
        throw new Error(
          `Index routes must not have child routes. Please remove all child routes from route path "${path}".`,
        );
      }

      flattenRoutes(
        route.children as RouteObjectType[],
        branches,
        routesMeta,
        path,
        insideOptional,
      );
    }

    // Routes without a path never match by themselves unless they are index
    // routes, so don't add them to the list of possible branches.
    if (route.path == null && !route.index) {
      return;
    }

    branches.push({ path, score: computeScore(path, route.index), routesMeta });
  };

  routes.forEach((route, index) => {
    if (route.path === "" || !route.path?.includes("?")) {
      flattenRoute(route, index, hasParentOptionalSegments);
    } else {
      for (const exploded of explodeOptionalSegments(route.path)) {
        flattenRoute(route, index, true, exploded);
      }
    }
  });

  return branches;
}

// Computes all combinations of optional path segments for a given path.
// For example, `/one/:two?/three/:four?` explodes to `/one/three`,
// `/one/:two/three`, `/one/three/:four`, and `/one/:two/three/:four`.
function explodeOptionalSegments(path: string): string[] {
  const segments = path.split("/");
  if (segments.length === 0) {
    return [];
  }

  const [first = "", ...rest] = segments;
  const isOptional = first.endsWith("?");
  const required = first.replace(/\?$/, "");

  if (rest.length === 0) {
    // An empty string means "omit this optional segment".
    return isOptional ? [required, ""] : [required];
  }

  const restExploded = explodeOptionalSegments(rest.join("/"));
  const result: string[] = [];

  // Emit the required variant for all children before the omitted variant so
  // parent optional segments rank as required ahead of deeper ones.
  result.push(
    ...restExploded.map((subpath) => (subpath === "" ? required : [required, subpath].join("/"))),
  );

  if (isOptional) {
    result.push(...restExploded);
  }

  return result.map((exploded) => (path.startsWith("/") && exploded === "" ? "/" : exploded));
}

const paramRe = /^:[\w-]+$/;
const dynamicSegmentValue = 3;
const indexRouteValue = 2;
const emptySegmentValue = 1;
const staticSegmentValue = 10;
const splatPenalty = -2;
const isSplat = (segment: string) => segment === "*";

function computeScore(path: string, index: boolean | undefined): number {
  const segments = path.split("/");
  let initialScore = segments.length;
  if (segments.some(isSplat)) {
    initialScore += splatPenalty;
  }

  if (index) {
    initialScore += indexRouteValue;
  }

  return segments
    .filter((segment) => !isSplat(segment))
    .reduce(
      (score, segment) =>
        score +
        (paramRe.test(segment)
          ? dynamicSegmentValue
          : segment === ""
            ? emptySegmentValue
            : staticSegmentValue),
      initialScore,
    );
}

function rankRouteBranches(branches: RouteBranch<RouteObject>[]): void {
  branches.sort((a, b) =>
    a.score !== b.score
      ? b.score - a.score
      : compareIndexes(
          a.routesMeta.map((meta) => meta.childrenIndex),
          b.routesMeta.map((meta) => meta.childrenIndex),
        ),
  );
}

function compareIndexes(a: number[], b: number[]): number {
  const siblings = a.length === b.length && a.slice(0, -1).every((n, index) => n === b[index]);

  // Sibling routes with identical scores match in source order; non-siblings
  // rank equally.
  return siblings ? a[a.length - 1]! - b[b.length - 1]! : 0;
}

function matchRouteBranch<RouteObjectType extends RouteObject>(
  branch: RouteBranch<RouteObjectType>,
  pathname: string,
): RouteMatch<RouteObjectType>[] | null {
  const { routesMeta } = branch;

  const matchedParams: Record<string, string | undefined> = {};
  let matchedPathname = "/";
  const matches: RouteMatch<RouteObjectType>[] = [];
  for (let index = 0; index < routesMeta.length; index++) {
    const meta = routesMeta[index]!;
    const end = index === routesMeta.length - 1;
    const remainingPathname =
      matchedPathname === "/" ? pathname : pathname.slice(matchedPathname.length) || "/";
    const match = matchPath({ path: meta.relativePath, end }, remainingPathname);

    if (!match) {
      return null;
    }

    Object.assign(matchedParams, match.params);

    matches.push({
      params: matchedParams,
      pathname: joinPaths([matchedPathname, match.pathname]),
      pathnameBase: normalizePathname(joinPaths([matchedPathname, match.pathnameBase])),
      route: meta.route,
    });

    if (match.pathnameBase !== "/") {
      matchedPathname = joinPaths([matchedPathname, match.pathnameBase]);
    }
  }

  return matches;
}

/**
Matches a single path pattern against a pathname. Returns the match with
extracted params, or `null` if the pattern does not match.
*/
export function matchPath<ParamKey extends string = string>(
  pattern: PathPattern | string,
  pathname: string,
): PathMatch<ParamKey> | null {
  if (typeof pattern === "string") {
    pattern = { path: pattern, end: true };
  }

  const [matcher, compiledParams] = compilePath(pattern.path, pattern.end);

  const match = pathname.match(matcher);
  if (!match) {
    return null;
  }

  const matchedPathname = match[0];
  let pathnameBase = matchedPathname.replace(/(.)\/+$/, "$1");
  const captureGroups = match.slice(1);
  const params = compiledParams.reduce<Record<string, string | undefined>>(
    (memo, { paramName, isOptional }, index) => {
      // Compute pathnameBase from the raw splat value: everything before the
      // splat is the base consumed by this pattern.
      const value = captureGroups[index];
      if (paramName === "*") {
        const splatValue = value || "";
        pathnameBase = matchedPathname
          .slice(0, matchedPathname.length - splatValue.length)
          .replace(/(.)\/+$/, "$1");
      }

      memo[paramName] = isOptional && !value ? undefined : value || "";
      return memo;
    },
    {},
  );

  return {
    params: params as Params<ParamKey>,
    pathname: matchedPathname,
    pathnameBase,
    pattern,
  };
}

type CompiledPathParam = { paramName: string; isOptional?: boolean };

function compilePath(path: string, end = true): [RegExp, CompiledPathParam[]] {
  if (path !== "*" && path.endsWith("*") && !path.endsWith("/*")) {
    throw new Error(
      `Route path "${path}" is invalid because the \`*\` character must always follow a \`/\` in the pattern. ` +
        `Please change the route path to "${path.replace(/\*$/, "/*")}".`,
    );
  }

  const params: CompiledPathParam[] = [];
  let regexpSource =
    "^" +
    path
      .replace(/\/*\*?$/, "") // Ignore trailing / and /*, handled below
      .replace(/^\/*/, "/") // Make sure it has a leading /
      .replace(/[\\.*+^${}|()[\]]/g, "\\$&") // Escape special regex chars
      .replace(/\/:([\w-]+)(\?)?/g, (_: string, paramName: string, isOptional) => {
        params.push({ paramName, isOptional: isOptional != null });
        return isOptional ? "/?([^\\/]+)?" : "/([^\\/]+)";
      }) // Dynamic segment
      .replace(/\/([\w-]+)\?(\/|$)/g, "(/$1)?$2"); // Optional static segment

  if (path.endsWith("*")) {
    params.push({ paramName: "*" });
    regexpSource +=
      path === "*" || path === "/*"
        ? "(.*)$" // Already matched the initial /, just match the rest
        : "(?:\\/(.+)|\\/*)$"; // Don't include the / in params["*"]
  } else if (end) {
    // When matching to the end, ignore trailing slashes
    regexpSource += "\\/*$";
  } else if (path !== "" && path !== "/") {
    // Match a prefix only up to a segment boundary, so "/user" does not
    // match "/user-preferences".
    regexpSource += "(?:(?=\\/|$))";
  }

  return [new RegExp(regexpSource), params];
}

/**
Interpolates params into a route path pattern.

```ts
generatePath("/users/:id", { id: "42" }); // "/users/42"
```
*/
export function generatePath(
  originalPath: string,
  params: Record<string, string | null> = {},
): string {
  const path = originalPath;
  if (path.endsWith("*") && path !== "*" && !path.endsWith("/*")) {
    throw new Error(
      `Route path "${path}" is invalid because the \`*\` character must always follow a \`/\` in the pattern. ` +
        `Please change the route path to "${path.replace(/\*$/, "/*")}".`,
    );
  }

  const prefix = path.startsWith("/") ? "/" : "";

  const segments = path
    .split(/\/+/)
    .map((segment, index, array) => {
      const isLastSegment = index === array.length - 1;

      // Only apply the splat if it's the last segment
      if (isLastSegment && segment === "*") {
        return params["*"] ?? "";
      }

      const keyMatch = segment.match(/^:([\w-]+)(\??)$/);
      if (keyMatch) {
        const key = keyMatch[1]!;
        const optional = keyMatch[2];
        const param = params[key];
        if (optional !== "?" && param == null) {
          throw new Error(`Missing ":${key}" param`);
        }

        return param ?? "";
      }

      // Remove any optional markers from optional static segments
      return segment.replace(/\?$/g, "");
    })
    .filter((segment) => !!segment);

  return prefix + segments.join("/");
}

/**
Resolves a `To` value against a starting pathname, handling `.` and `..`
segments.
*/
export function resolvePath(to: To, fromPathname = "/"): Path {
  const { pathname: toPathname, search = "" } = typeof to === "string" ? parsePath(to) : to;

  const pathname = toPathname
    ? toPathname.startsWith("/")
      ? toPathname
      : resolvePathname(toPathname, fromPathname)
    : fromPathname;

  return {
    pathname,
    search: normalizeSearch(search),
  };
}

function resolvePathname(relativePath: string, fromPathname: string): string {
  const segments = fromPathname.replace(/\/+$/, "").split("/");

  for (const segment of relativePath.split("/")) {
    if (segment === "..") {
      // Keep the root "" segment so the pathname starts at /
      if (segments.length > 1) {
        segments.pop();
      }
    } else if (segment !== ".") {
      segments.push(segment);
    }
  }

  return segments.length > 1 ? segments.join("/") : "/";
}

// Ancestor routes that do not contribute a path segment (index routes,
// pathless layouts) are ignored for relative navigation, so `..` always means
// "up one route that has a path".
function getPathContributingMatches<T extends RouteMatch>(matches: T[]): T[] {
  return matches.filter(
    (match, index) => index === 0 || (match.route.path && match.route.path.length > 0),
  );
}

export function getResolveToMatches(matches: RouteMatch[]): string[] {
  const pathMatches = getPathContributingMatches(matches);

  // Use the full pathname for the leaf match so splat values are included in
  // "." links.
  return pathMatches.map((match, index) =>
    index === pathMatches.length - 1 ? match.pathname : match.pathnameBase,
  );
}

export function resolveTo(toArg: To, routePathnames: string[], locationPathname: string): Path {
  const to: Partial<Path> = typeof toArg === "string" ? parsePath(toArg) : { ...toArg };

  if (to.pathname?.includes("?")) {
    throw new Error(
      `Cannot include a '?' character in a manually specified \`to.pathname\` field ` +
        `[${JSON.stringify(to)}]. Please separate it out to the \`to.search\` field.`,
    );
  }

  const isEmptyPath = toArg === "" || to.pathname === "";
  const toPathname = isEmptyPath ? "/" : to.pathname;

  let from: string;
  if (toPathname == null) {
    // A search-only `to` is relative to the current location, not the route.
    from = locationPathname;
  } else {
    let routePathnameIndex = routePathnames.length - 1;

    // Each leading `..` segment means "go up one route", not "up one URL
    // segment" — routes are the unit of navigation here.
    if (toPathname.startsWith("..")) {
      const toSegments = toPathname.split("/");

      while (toSegments[0] === "..") {
        toSegments.shift();
        routePathnameIndex -= 1;
      }

      to.pathname = toSegments.join("/");
    }

    from = routePathnameIndex >= 0 ? routePathnames[routePathnameIndex]! : "/";
  }

  const path = resolvePath(to, from);

  // Preserve an explicit trailing slash from the original `to` value, or from
  // the current location for "."-style links.
  const hasExplicitTrailingSlash = toPathname && toPathname !== "/" && toPathname.endsWith("/");
  const hasCurrentTrailingSlash =
    (isEmptyPath || toPathname === ".") && locationPathname.endsWith("/");
  if (!path.pathname.endsWith("/") && (hasExplicitTrailingSlash || hasCurrentTrailingSlash)) {
    path.pathname += "/";
  }

  return path;
}
