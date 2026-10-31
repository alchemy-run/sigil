import { expect, test } from "vite-plus/test";

import { Box, Text, Static, renderToString } from "#/index.ts";

for (const height of [0, 1, 2, 3]) {
  test(`Static preserves ${height} blank rows before dynamic output`, () => {
    const output = renderToString(
      <>
        <Static items={["blank"]}>{(item) => <Box key={item} height={height} />}</Static>
        <Text>after</Text>
      </>,
    );
    const expected = renderToString(
      <Box flexDirection="column">
        <Box height={height} />
        <Text>after</Text>
      </Box>,
    );

    expect(expected).toBe("\n".repeat(height) + "after");
    expect(output).toBe(expected);
  });
}

for (const content of [undefined, "", " ", "\n"]) {
  test(`Static preserves whitespace content ${JSON.stringify(content)}`, () => {
    const item = <Text>{content}</Text>;
    const output = renderToString(
      <>
        <Static items={["item"]}>{(key) => <Box key={key}>{item}</Box>}</Static>
        <Text>after</Text>
      </>,
    );
    const expected = renderToString(
      <Box flexDirection="column">
        {item}
        <Text>after</Text>
      </Box>,
    );

    expect(output).toBe(expected);
  });
}

test("empty Static does not insert a blank row", () => {
  const output = renderToString(
    <>
      <Static items={[] as string[]}>{(item) => <Text key={item}>{item}</Text>}</Static>
      <Text>after</Text>
    </>,
  );

  expect(output).toBe("after");
});
