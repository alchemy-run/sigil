import { Box, Text, render } from "#/index.ts";

function Clear() {
  return (
    <Box flexDirection="column">
      <Text>A</Text>
      <Text>B</Text>
      <Text>C</Text>
    </Box>
  );
}

const { clear } = render(<Clear />);
clear();
