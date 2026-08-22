import React from "react";

import { Box, Text, render } from "#/index.ts";

const names = [
  "Maya Chen",
  "Amara Diallo",
  "Piotr Nowak",
  "Sana Iqbal",
  "Leo Fischer",
  "Ines Castro",
  "Yuki Tanaka",
  "Noa Levi",
  "Owen Reid",
  "Zara Ahmed",
];

const users = names.map((name, index) => ({
  id: index,
  name,
  email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
}));

function Table() {
  return (
    <Box flexDirection="column" width={80}>
      <Box>
        <Box width="10%">
          <Text>ID</Text>
        </Box>

        <Box width="50%">
          <Text>Name</Text>
        </Box>

        <Box width="40%">
          <Text>Email</Text>
        </Box>
      </Box>

      {users.map((user) => (
        <Box key={user.id}>
          <Box width="10%">
            <Text>{user.id}</Text>
          </Box>

          <Box width="50%">
            <Text>{user.name}</Text>
          </Box>

          <Box width="40%">
            <Text>{user.email}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

render(<Table />);
