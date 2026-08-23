import { setTimeout as delay } from "node:timers/promises";

import React from "react";
import { expect, test, describe } from "vite-plus/test";

import { chalk } from "#/ansi/chalk.ts";
import { stripAnsi } from "#/ansi/strip.ts";
import { render, Box, Text, useInput } from "#/index.ts";
import {
  generatePath,
  matchPath,
  matchRoutes,
  resolvePath,
  Link,
  MemoryRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useNavigationStack,
  useParams,
  useSearchParams,
  type RouteObject,
} from "#/router/index.ts";

import { createStdin, emitReadable, type FakeStdin } from "./helpers/create-stdin.ts";
import createStdout from "./helpers/create-stdout.ts";
import { renderToString } from "./helpers/render-to-string.ts";

describe("matchPath", () => {
  test("matches static paths, ignoring trailing slashes", () => {
    expect(matchPath("/about", "/about")).toMatchObject({ pathname: "/about" });
    expect(matchPath("/about", "/about/")).not.toBeNull();
    expect(matchPath("/about", "/contact")).toBeNull();
  });

  test("is case-sensitive", () => {
    expect(matchPath("/About", "/about")).toBeNull();
    expect(matchPath("/About", "/About")).not.toBeNull();
  });

  test("extracts params from dynamic segments", () => {
    expect(matchPath("/users/:id", "/users/42")?.params).toEqual({ id: "42" });
  });

  test("does not percent-decode param values", () => {
    expect(matchPath("/users/:name", "/users/John%20Doe")?.params).toEqual({
      name: "John%20Doe",
    });
  });

  test("captures splats", () => {
    const match = matchPath("/files/*", "/files/a/b/c");
    expect(match?.params).toEqual({ "*": "a/b/c" });
    expect(match?.pathnameBase).toBe("/files");
  });

  test("supports optional dynamic segments", () => {
    expect(matchPath("/users/:id?", "/users")?.params).toEqual({ id: undefined });
    expect(matchPath("/users/:id?", "/users/42")?.params).toEqual({ id: "42" });
  });

  test("supports optional static segments", () => {
    expect(matchPath("/users/edit?", "/users")).not.toBeNull();
    expect(matchPath("/users/edit?", "/users/edit")).not.toBeNull();
  });

  test("does not match prefixes across segment boundaries when end is false", () => {
    expect(matchPath({ path: "/user", end: false }, "/user-preferences")).toBeNull();
    expect(matchPath({ path: "/user", end: false }, "/user/settings")).not.toBeNull();
  });

  test("rejects a splat that does not follow a slash", () => {
    expect(() => matchPath("/files*", "/files/a")).toThrow(/must always follow/);
  });
});

describe("matchRoutes", () => {
  const routes: RouteObject[] = [
    { path: "/", element: null },
    {
      path: "/users",
      children: [{ index: true }, { path: "new" }, { path: ":id" }, { path: "*" }],
    },
  ];

  test("prefers static segments over dynamic ones", () => {
    const matches = matchRoutes(routes, "/users/new");
    expect(matches?.at(-1)?.route.path).toBe("new");
  });

  test("prefers dynamic segments over splats", () => {
    const matches = matchRoutes(routes, "/users/42");
    expect(matches?.at(-1)?.route.path).toBe(":id");
    expect(matches?.at(-1)?.params).toEqual({ id: "42" });
  });

  test("falls back to the splat for deeper paths", () => {
    const matches = matchRoutes(routes, "/users/42/posts");
    expect(matches?.at(-1)?.route.path).toBe("*");
  });

  test("matches index routes at the parent path", () => {
    const matches = matchRoutes(routes, "/users");
    expect(matches?.at(-1)?.route.index).toBe(true);
  });

  test("returns null when nothing matches", () => {
    expect(matchRoutes(routes, "/nope/nope")).toBeNull();
  });

  test("rejects index routes with children", () => {
    expect(() => matchRoutes([{ index: true, children: [{ path: "x" }] }], "/")).toThrow(
      /Index routes must not have child routes/,
    );
  });
});

describe("path utils", () => {
  test("generatePath interpolates params without encoding", () => {
    expect(generatePath("/users/:id", { id: "42" })).toBe("/users/42");
    expect(generatePath("/users/:name", { name: "John Doe" })).toBe("/users/John Doe");
    expect(generatePath("/files/*", { "*": "a/b" })).toBe("/files/a/b");
    expect(() => generatePath("/users/:id", {})).toThrow(/Missing ":id" param/);
  });

  test("resolvePath handles relative segments", () => {
    expect(resolvePath("../settings", "/users/42")).toEqual({
      pathname: "/users/settings",
      search: "",
    });
    expect(resolvePath("?tab=posts", "/users")).toEqual({
      pathname: "/users",
      search: "?tab=posts",
    });
  });
});

describe("rendering", () => {
  test("renders the matching route", () => {
    const output = renderToString(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Text>Home</Text>} />
          <Route path="/about" element={<Text>About</Text>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(output).toBe("Home");
  });

  test("starts at the last initial entry", () => {
    const output = renderToString(
      <MemoryRouter initialEntries={["/", "/about"]}>
        <Routes>
          <Route path="/" element={<Text>Home</Text>} />
          <Route path="/about" element={<Text>About</Text>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(output).toBe("About");
  });

  test("renders nested routes through an Outlet", () => {
    const output = renderToString(
      <MemoryRouter initialEntries={["/users/42"]}>
        <Routes>
          <Route
            path="/users"
            element={
              <Box flexDirection="column">
                <Text>Users</Text>
                <Outlet />
              </Box>
            }
          >
            <Route index element={<Text>List</Text>} />
            <Route path=":id" element={<UserId />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(output).toBe("Users\nUser 42");
  });

  test("renders a pathless layout route around children", () => {
    const output = renderToString(
      <MemoryRouter>
        <Routes>
          <Route
            element={
              <Box flexDirection="column">
                <Text>Shell</Text>
                <Outlet />
              </Box>
            }
          >
            <Route path="/" element={<Text>Home</Text>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(output).toBe("Shell\nHome");
  });

  test("renders nothing when no route matches", () => {
    const output = renderToString(
      <MemoryRouter initialEntries={["/nope"]}>
        <Routes>
          <Route path="/" element={<Text>Home</Text>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(output).toBe("");
  });

  test("rejects a non-Route child passed to Routes", () => {
    const stdout = createStdout();
    render(
      <MemoryRouter>
        <Routes>
          <Text>not a route</Text>
        </Routes>
      </MemoryRouter>,
      { stdout },
    );

    expect(stripAnsi(stdout.getWrites().join(""))).toContain("must be a <Route>");
  });
});

function UserId() {
  const { id } = useParams();
  return <Text>User {id}</Text>;
}

type Harness = {
  stdin: FakeStdin;
  lastFrame: () => string;
};

const renderApp = (element: React.JSX.Element): Harness => {
  const stdout = createStdout();
  const stdin = createStdin();
  render(element, { stdout, stdin, debug: true });

  return { stdin, lastFrame: () => stdout.get() };
};

function NavigateOnKey({ to, input: expected }: { to: string | number; input: string }) {
  const navigate = useNavigate();

  useInput((input) => {
    if (input === expected) {
      if (typeof to === "number") {
        navigate(to);
      } else {
        navigate(to);
      }
    }
  });

  return null;
}

describe("navigation", () => {
  test("navigate pushes a new location", async () => {
    const { stdin, lastFrame } = renderApp(
      <MemoryRouter>
        <NavigateOnKey to="/about" input="a" />
        <Routes>
          <Route path="/" element={<Text>Home</Text>} />
          <Route path="/about" element={<Text>About</Text>} />
        </Routes>
      </MemoryRouter>,
    );

    await delay(50);
    expect(lastFrame()).toBe("Home");

    emitReadable(stdin, "a");
    await delay(50);
    expect(lastFrame()).toBe("About");
  });

  test("navigate(-1) goes back through the stack", async () => {
    const { stdin, lastFrame } = renderApp(
      <MemoryRouter initialEntries={["/", "/about"]}>
        <NavigateOnKey to={-1} input="b" />
        <Routes>
          <Route path="/" element={<Text>Home</Text>} />
          <Route path="/about" element={<Text>About</Text>} />
        </Routes>
      </MemoryRouter>,
    );

    await delay(50);
    expect(lastFrame()).toBe("About");

    emitReadable(stdin, "b");
    await delay(50);
    expect(lastFrame()).toBe("Home");
  });

  test("relative navigation resolves against the current route", async () => {
    function Details() {
      const navigate = useNavigate();
      useInput((input) => {
        if (input === "u") {
          navigate("..");
        }
      });

      return <Text>Details</Text>;
    }

    const { stdin, lastFrame } = renderApp(
      <MemoryRouter initialEntries={["/users/42"]}>
        <Routes>
          <Route path="/users">
            <Route index element={<Text>List</Text>} />
            <Route path=":id" element={<Details />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await delay(50);
    expect(lastFrame()).toBe("Details");

    emitReadable(stdin, "u");
    await delay(50);
    expect(lastFrame()).toBe("List");
  });

  test("<Navigate> redirects on render", async () => {
    const { lastFrame } = renderApp(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/welcome" replace />} />
          <Route path="/welcome" element={<Text>Welcome</Text>} />
        </Routes>
      </MemoryRouter>,
    );

    await delay(50);
    expect(lastFrame()).toBe("Welcome");
  });

  test("location state is delivered to the destination", async () => {
    function Sender() {
      const navigate = useNavigate();
      useInput((input) => {
        if (input === "s") {
          navigate("/receiver", { state: { from: "sender" } });
        }
      });

      return <Text>Sender</Text>;
    }

    function Receiver() {
      const location = useLocation();
      return <Text>Got {(location.state as { from: string }).from}</Text>;
    }

    const { stdin, lastFrame } = renderApp(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Sender />} />
          <Route path="/receiver" element={<Receiver />} />
        </Routes>
      </MemoryRouter>,
    );

    await delay(50);
    emitReadable(stdin, "s");
    await delay(50);
    expect(lastFrame()).toBe("Got sender");
  });

  test("useNavigationStack reflects the stack position", async () => {
    function Status() {
      const { canGoBack, canGoForward } = useNavigationStack();
      return (
        <Text>
          back:{String(canGoBack)} forward:{String(canGoForward)}
        </Text>
      );
    }

    const { stdin, lastFrame } = renderApp(
      <MemoryRouter>
        <NavigateOnKey to="/next" input="n" />
        <Routes>
          <Route path="/" element={<Status />} />
          <Route path="/next" element={<Status />} />
        </Routes>
      </MemoryRouter>,
    );

    await delay(50);
    expect(lastFrame()).toBe("back:false forward:false");

    emitReadable(stdin, "n");
    await delay(50);
    expect(lastFrame()).toBe("back:true forward:false");
  });
});

describe("useSearchParams", () => {
  test("reads and writes search params", async () => {
    function Filters() {
      const [searchParams, setSearchParams] = useSearchParams({ tab: "all" });

      useInput((input) => {
        if (input === "p") {
          setSearchParams({ tab: "posts" });
        }
      });

      return <Text>tab:{searchParams.get("tab")}</Text>;
    }

    const { stdin, lastFrame } = renderApp(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Filters />} />
        </Routes>
      </MemoryRouter>,
    );

    await delay(50);
    expect(lastFrame()).toBe("tab:all");

    emitReadable(stdin, "p");
    await delay(50);
    expect(lastFrame()).toBe("tab:posts");
  });
});

describe("Link", () => {
  test("focuses with tab and navigates with enter", async () => {
    const { stdin, lastFrame } = renderApp(
      <MemoryRouter>
        <Box flexDirection="column">
          <Link to="/about">About</Link>
          <Routes>
            <Route path="/" element={<Text>Home</Text>} />
            <Route path="/about" element={<Text>About screen</Text>} />
          </Routes>
        </Box>
      </MemoryRouter>,
    );

    await delay(50);
    expect(lastFrame()).toBe("About\nHome");

    emitReadable(stdin, "\t");
    await delay(50);
    emitReadable(stdin, "\r");
    await delay(50);
    // The link keeps focus after navigating, so it renders inverse.
    expect(lastFrame()).toBe(`${chalk.inverse("About")}\nAbout screen`);
  });

  test("exposes focus and active state to a function child", async () => {
    const { lastFrame } = renderApp(
      <MemoryRouter initialEntries={["/about/team"]}>
        <Box flexDirection="column">
          <Link to="/about">
            {({ isActive, isFocused }) => (
              <Text>
                about active:{String(isActive)} focused:{String(isFocused)}
              </Text>
            )}
          </Link>
          <Link to="/contact">
            {({ isActive }) => <Text>contact active:{String(isActive)}</Text>}
          </Link>
        </Box>
      </MemoryRouter>,
    );

    await delay(50);
    expect(lastFrame()).toBe(
      ["about active:true focused:false", "contact active:false"].join("\n"),
    );
  });
});
