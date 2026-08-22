import { Box, Text, render } from "#/index.ts";

function Erase() {
  return (
    <Box flexDirection="column">
      <Text>A</Text>
      <Text>B</Text>
      <Text>C</Text>
    </Box>
  );
}

process.stdout.rows = Number(process.argv[2]);
render(<Erase />);
