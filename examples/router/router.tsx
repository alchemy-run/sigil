import React from "react";

import { render, useApp, useInput, Box, Text } from "#/index.ts";
import {
  Link,
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useNavigationStack,
  useParams,
} from "#/router/index.ts";

const users = [
  { id: "1", name: "Ada Lovelace" },
  { id: "2", name: "Grace Hopper" },
  { id: "3", name: "Katherine Johnson" },
];

function Layout() {
  const { exit } = useApp();
  const navigate = useNavigate();
  const { canGoBack } = useNavigationStack();

  useInput((input, key) => {
    if (input === "q") {
      exit();
    }

    if (key.escape && canGoBack) {
      navigate(-1);
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={2}>
        <Link to="/" autoFocus>
          Home
        </Link>
        <Link to="/users">Users</Link>
      </Box>
      <Outlet />
      <Text dimColor>Tab to move focus, Enter to follow a link, Esc to go back, q to quit.</Text>
    </Box>
  );
}

function Home() {
  return <Text>Welcome! Head over to the users screen.</Text>;
}

function UserList() {
  return (
    <Box flexDirection="column">
      {users.map((user) => (
        <Link key={user.id} to={user.id}>
          {user.name}
        </Link>
      ))}
    </Box>
  );
}

function UserDetails() {
  const { id } = useParams();
  const user = users.find((candidate) => candidate.id === id);

  return (
    <Text>
      Viewing <Text bold>{user?.name ?? "an unknown user"}</Text> (id: {id})
    </Text>
  );
}

function App() {
  return (
    <MemoryRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/users">
            <Route index element={<UserList />} />
            <Route path=":id" element={<UserDetails />} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

render(<App />);
