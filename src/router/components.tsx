/** @jsxImportSource react */
// MemoryRouter/Routes/Route/Navigate/Outlet are ported from react-router's
// declarative components (lib/components.tsx, MIT). Link is Sigil-native.
import {
  Children,
  Fragment,
  isValidElement,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import { Text, type Props as TextProps } from "#/components/Text.tsx";
import { useFocus } from "#/hooks/use-focus.ts";
import { useInput } from "#/hooks/use-input.ts";
import { LocationContext, NavigationContext, type Navigator } from "#/router/context.ts";
import {
  createMemoryHistory,
  type InitialEntry,
  type Location,
  type To,
} from "#/router/history.ts";
import {
  useLocation,
  useNavigate,
  useOutlet,
  useResolvedPath,
  useRoutes,
} from "#/router/hooks.tsx";
import { normalizePathname, type RouteObject } from "#/router/matcher.ts";

export type MemoryRouterProps = {
  /**
	The navigation stack to start with. Defaults to `["/"]`.
	*/
  initialEntries?: InitialEntry[];

  /**
	The index of the initial entry to render. Defaults to the last entry.
	*/
  initialIndex?: number;

  children?: ReactNode;
};

/**
The routing container for a Sigil app. Stores the navigation stack in memory —
routes aren't URLs, they're screen states.

```tsx
<MemoryRouter>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/settings" element={<Settings />} />
  </Routes>
</MemoryRouter>
```
*/
export function MemoryRouter({ initialEntries, initialIndex, children }: MemoryRouterProps) {
  const historyRef = useRef<ReturnType<typeof createMemoryHistory> | null>(null);
  historyRef.current ??= createMemoryHistory({ initialEntries, initialIndex });

  const history = historyRef.current;
  const [state, setState] = useState({
    action: history.action,
    location: history.location,
  });

  // Navigation is a transition: if the destination screen suspends, the
  // current screen stays visible until it's ready.
  useLayoutEffect(
    () =>
      history.listen(({ action, location }) => {
        startTransition(() => {
          setState({ action, location });
        });
      }),
    [history],
  );

  const navigator = useMemo<Navigator>(
    () => ({
      push: (to, historyState) => history.push(to, historyState),
      replace: (to, historyState) => history.replace(to, historyState),
      go: (delta) => history.go(delta),
      canGoBack: () => history.canGoBack,
      canGoForward: () => history.canGoForward,
    }),
    [history],
  );

  const navigationContext = useMemo(() => ({ navigator }), [navigator]);
  const locationContext = useMemo(
    () => ({ location: state.location, navigationType: state.action }),
    [state],
  );

  return (
    <NavigationContext.Provider value={navigationContext}>
      <LocationContext.Provider value={locationContext}>{children}</LocationContext.Provider>
    </NavigationContext.Provider>
  );
}

export type RouteProps = {
  /**
	The path pattern to match, relative to the parent route. Supports `:param`
	dynamic segments, optional segments (`:param?`, `edit?`), and a trailing
	`*` splat.
	*/
  path?: string;

  /**
	Render this route in the parent's `<Outlet>` at the parent's exact path.
	Index routes cannot have children.
	*/
  index?: boolean;

  /**
	The element to render when this route matches.
	*/
  element?: ReactNode;

  /**
	Nested `<Route>` elements, rendered into this route's `<Outlet>`.
	*/
  children?: ReactNode;
};

/**
Declares a route. Only valid as a child of `<Routes>` or another `<Route>`.
*/
export function Route(_props: RouteProps): ReactElement | null {
  throw new Error(
    "A <Route> is only ever to be used as the child of a <Routes> element, " +
      "never rendered directly. Please wrap your <Route> in a <Routes>.",
  );
}

function createRoutesFromChildren(children: ReactNode): RouteObject[] {
  const routes: RouteObject[] = [];

  Children.forEach(children, (element) => {
    if (!isValidElement(element)) {
      // Ignore non-elements. This allows people to more easily inline
      // conditionals in their route config.
      return;
    }

    if (element.type === Fragment) {
      // Transparently support React.Fragment and its children.
      routes.push(
        ...createRoutesFromChildren((element.props as { children?: ReactNode }).children),
      );
      return;
    }

    if (element.type !== Route) {
      throw new Error(
        `[${typeof element.type === "string" ? element.type : ((element.type as { name?: string }).name ?? "unknown")}] ` +
          `is not a <Route> component. All component children of <Routes> must be a <Route> or <React.Fragment>.`,
      );
    }

    const props = element.props as RouteProps;
    const route: RouteObject = {
      path: props.path,
      index: props.index,
      element: props.element,
    };

    if (props.children) {
      route.children = createRoutesFromChildren(props.children);
    }

    routes.push(route);
  });

  return routes;
}

export type RoutesProps = {
  children?: ReactNode;

  /**
	Match against this location instead of the current one. Useful for
	rendering a screen other than the one navigated to (e.g. transitions).
	*/
  location?: Partial<Location> | string;
};

/**
Renders the branch of child `<Route>` elements that best matches the current
location.
*/
export function Routes({ children, location }: RoutesProps): ReactElement | null {
  return useRoutes(createRoutesFromChildren(children), location);
}

export type OutletProps = {
  /**
	A value to make available to descendant routes via `useOutletContext()`.
	*/
  context?: unknown;
};

/**
Renders the matching child route of a parent route, or nothing if no child
matches.
*/
export function Outlet(props: OutletProps): ReactElement | null {
  return useOutlet(props.context);
}

export type NavigateProps = {
  to: To;
  replace?: boolean;
  state?: unknown;
};

/**
Navigates as soon as it renders. The component form of `useNavigate`, for
declarative redirects:

```tsx
<Route path="/" element={<Navigate to="/home" replace />} />
```
*/
export function Navigate({ to, replace, state }: NavigateProps): null {
  const navigate = useNavigate();
  const { pathname, search } = useResolvedPath(to);

  useEffect(() => {
    navigate({ pathname, search }, { replace, state });
  }, [navigate, pathname, search, replace, state]);

  return null;
}

type LinkRenderState = {
  /**
	Whether this link currently has focus.
	*/
  isFocused: boolean;

  /**
	Whether the current location is the link's destination or a descendant of
	it.
	*/
  isActive: boolean;
};

export type LinkProps = Omit<TextProps, "children"> & {
  /**
	The destination to navigate to when the link is activated.
	*/
  to: To;

  /**
	Replace the current entry in the navigation stack instead of pushing.
	*/
  replace?: boolean;

  /**
	State to attach to the destination location.
	*/
  state?: unknown;

  /**
	Focus this link if nothing else is focused yet.
	*/
  autoFocus?: boolean;

  /**
	An ID for programmatic focus via `useFocusManager().focus(id)`.
	*/
  id?: string;

  /**
	Link content. Pass a function to take full control of rendering based on
	focus and active state.
	*/
  children?: ReactNode | ((state: LinkRenderState) => ReactNode);
};

/**
A focusable navigation element — the terminal's `<a>` tag. Focus it with
<kbd>Tab</kbd> and activate it with <kbd>Enter</kbd>. By default the focused
link renders inverse; pass a function as `children` (or any `Text` props) to
customize.

```tsx
<Link to="/settings">Settings</Link>
```
*/
export function Link({
  to,
  replace = false,
  state,
  autoFocus = false,
  id,
  children,
  ...textProps
}: LinkProps) {
  const navigate = useNavigate();
  const path = useResolvedPath(to);
  const { pathname: locationPathname } = useLocation();
  const { isFocused } = useFocus({ autoFocus, id });

  const toPathname = normalizePathname(path.pathname);
  const isActive =
    locationPathname === toPathname ||
    (locationPathname.startsWith(toPathname) && locationPathname.charAt(toPathname.length) === "/");

  const activate = useCallback(() => {
    navigate({ pathname: path.pathname, search: path.search }, { replace, state });
  }, [navigate, path.pathname, path.search, replace, state]);

  useInput(
    (_input, key) => {
      if (key.return) {
        activate();
      }
    },
    { isActive: isFocused },
  );

  if (typeof children === "function") {
    return <>{children({ isFocused, isActive })}</>;
  }

  return (
    <Text inverse={isFocused} {...textProps}>
      {children}
    </Text>
  );
}
