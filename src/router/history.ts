// Ported from react-router's createMemoryHistory (lib/router/history.ts, MIT),
// without URL semantics: no hash, no href/URL creation, no encoding.

/**
The type of navigation that produced the current location:

- `"POP"` — moving through existing history entries (`navigate(-1)`, initial load).
- `"PUSH"` — a new entry was added to the stack.
- `"REPLACE"` — the current entry was overwritten.
*/
export type NavigationType = "POP" | "PUSH" | "REPLACE";

/**
The two parseable pieces of a route path. Sigil routes have no hash — a
terminal has no scroll anchors.
*/
export type Path = {
  /**
	The path of the screen, beginning with `/`.
	*/
  pathname: string;

  /**
	The query string, beginning with `?`, or an empty string.
	*/
  search: string;
};

/**
An entry in the navigation stack.
*/
export type Location<State = unknown> = Path & {
  /**
	Arbitrary state attached to this entry via `navigate(to, {state})`. Unlike the
	browser, this is held in memory and never serialized — any value works.
	*/
  state: State;

  /**
	A unique key for this entry, stable across re-renders. Useful as a React
	`key` to remount a screen when re-navigating to the same path.
	*/
  key: string;
};

/**
A destination to navigate to: either a path string (`"/users/123?tab=posts"`)
or a partial `Path` object.
*/
export type To = string | Partial<Path>;

/**
Splits a path string into its pathname and search parts.
*/
export const parsePath = (path: string): Partial<Path> => {
  const parsedPath: Partial<Path> = {};

  if (path) {
    const searchIndex = path.indexOf("?");
    if (searchIndex >= 0) {
      parsedPath.search = path.slice(searchIndex);
      path = path.slice(0, searchIndex);
    }

    if (path) {
      parsedPath.pathname = path;
    }
  }

  return parsedPath;
};

/**
Joins a `Path` back into a single string.
*/
export const createPath = ({ pathname = "/", search = "" }: Partial<Path>): string =>
  pathname + (search && search !== "?" ? (search.startsWith("?") ? search : `?${search}`) : "");

type Update = {
  action: NavigationType;
  location: Location;
  delta: number;
};

type Listener = (update: Update) => void;

/**
The in-memory navigation stack backing `<MemoryRouter>`.
*/
export type MemoryHistory = {
  readonly index: number;
  readonly action: NavigationType;
  readonly location: Location;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  push: (to: To, state?: unknown) => void;
  replace: (to: To, state?: unknown) => void;
  go: (delta: number) => void;
  listen: (listener: Listener) => () => void;
};

/**
An entry to seed the navigation stack with: a path string or a partial
`Location` (which may carry `state`).
*/
export type InitialEntry = string | Partial<Location>;

type MemoryHistoryOptions = {
  initialEntries?: InitialEntry[];
  initialIndex?: number;
};

export const createMemoryHistory = ({
  initialEntries = ["/"],
  initialIndex,
}: MemoryHistoryOptions = {}): MemoryHistory => {
  let keyCounter = 0;
  const createKey = () => `k${keyCounter++}`;

  const createLocation = (to: To, state: unknown = null): Location => {
    const path = typeof to === "string" ? parsePath(to) : to;
    const location: Location = {
      pathname: path.pathname ?? "/",
      search: path.search ?? "",
      state,
      key: createKey(),
    };
    if (!location.pathname.startsWith("/")) {
      throw new Error(
        `Route pathnames must be absolute, but "${location.pathname}" was used to initialize the navigation stack.`,
      );
    }

    return location;
  };

  const entries: Location[] = initialEntries.map((entry) =>
    createLocation(entry, typeof entry === "string" ? null : (entry.state ?? null)),
  );
  let index = Math.min(Math.max(initialIndex ?? entries.length - 1, 0), entries.length - 1);
  let action: NavigationType = "POP";
  let listener: Listener | null = null;

  const history: MemoryHistory = {
    get index() {
      return index;
    },
    get action() {
      return action;
    },
    get location() {
      return entries[index]!;
    },
    get canGoBack() {
      return index > 0;
    },
    get canGoForward() {
      return index < entries.length - 1;
    },
    push(to, state) {
      action = "PUSH";
      const nextLocation = createLocation(to, state);
      index += 1;
      // Pushing truncates any forward entries, exactly like browser history.
      entries.splice(index, entries.length, nextLocation);
      listener?.({ action, location: nextLocation, delta: 1 });
    },
    replace(to, state) {
      action = "REPLACE";
      const nextLocation = createLocation(to, state);
      entries[index] = nextLocation;
      listener?.({ action, location: nextLocation, delta: 0 });
    },
    go(delta) {
      action = "POP";
      const nextIndex = Math.min(Math.max(index + delta, 0), entries.length - 1);
      const actualDelta = nextIndex - index;
      index = nextIndex;
      listener?.({ action, location: entries[index]!, delta: actualDelta });
    },
    listen(newListener) {
      if (listener) {
        throw new Error("A memory history only supports one listener at a time.");
      }

      listener = newListener;
      return () => {
        listener = null;
      };
    },
  };

  return history;
};
