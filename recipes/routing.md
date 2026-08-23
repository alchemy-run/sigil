# Routing

Sigil ships a purpose-built in-memory router under `@alchemy.run/sigil/router`. Its component model is a subset of [React Router](https://reactrouter.com)'s declarative mode — `MemoryRouter`, `Routes`, `Route`, `Outlet`, and the familiar hooks — so anything you know from React Router transfers directly. Everything URL- and DOM-specific is gone: routes aren't URLs, they're screen states.

```tsx
import React from "react";
import { render, Text } from "@alchemy.run/sigil";
import { MemoryRouter, Routes, Route, Link, Outlet } from "@alchemy.run/sigil/router";

function Layout() {
  return (
    <>
      <Link to="/" autoFocus>
        Home
      </Link>
      <Link to="/about">About</Link>
      <Outlet />
    </>
  );
}

function App() {
  return (
    <MemoryRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Text>Home screen</Text>} />
          <Route path="/about" element={<Text>About screen</Text>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

render(<App />);
```

## What's included

- **Components** — `MemoryRouter`, `Routes`, `Route`, `Outlet`, `Navigate`, and a terminal-native `Link`: a focusable text element. Focus it with <kbd>Tab</kbd>, activate it with <kbd>Enter</kbd>. The focused link renders inverse by default; pass a function as `children` to render based on `{ isFocused, isActive }` yourself.
- **Hooks** — `useNavigate`, `useLocation`, `useParams`, `useSearchParams`, `useMatch`, `useRoutes`, `useOutlet`, `useOutletContext`, `useResolvedPath`, `useNavigationType`, `useInRouterContext`, plus the Sigil-only `useNavigationStack` which reports `{ canGoBack, canGoForward }` — handy for "Esc goes back, unless at root" bindings.
- **Path features** — nested routes, index routes, pathless layout routes, dynamic segments (`:id`), optional segments (`:id?`, `edit?`), splats (`*`), route ranking, relative navigation (`navigate("..")` goes up one _route_), search params, and per-entry navigation `state`.

## How it differs from React Router

The behavior here is the intended behavior, not a compatibility shim:

- **No data APIs.** No loaders, actions, or `RouterProvider` — use React Suspense and your own data layer.
- **No URL semantics.** Paths have no hash and no percent-encoding: `navigate("/users/John Doe")` matches `:name` as the literal `John Doe`. There is no `basename`.
- **Matching is case-sensitive.** Route paths are code constants, not user-typed URLs.
- **`Link` renders `Text`, not `<a>`.** It participates in Sigil's focus system instead of the DOM's. For an actual clickable URL (OSC 8), use `<Hyperlink url="...">` from the main package instead.
- **Navigation is a React transition.** If the destination screen suspends, the current screen stays visible until the new one is ready.

Things to keep in mind:

- `MemoryRouter` starts at `"/"`. Set `initialEntries` (e.g. from CLI arguments) to deep-link into a screen.
- `useInput` handlers in a parent layout route keep firing while a child route is mounted — there is no capture/bubble phase. Give layout-level bindings keys that don't collide with the focused screen's.
- Route elements fully unmount on navigation. State that should survive leaving a screen belongs above `<Routes>`, in an `<Outlet context>`, or in the destination's location `state`.

See [`examples/router`](/examples/router) for a working example with nested routes, params, and links.
