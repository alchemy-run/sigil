import { useLayoutEffect, useState } from "react";
import { expect, test } from "vite-plus/test";

import { Static, Text, renderToString } from "#/index.ts";

for (const shouldReplace of [false, true]) {
  test(`renderToString reflects a layout-effect Static ${shouldReplace ? "replacement" : "removal"}`, () => {
    function Example() {
      const [updated, setUpdated] = useState(false);
      useLayoutEffect(() => {
        setUpdated(true);
      }, []);

      return (
        <>
          {!updated || shouldReplace ? (
            <Static key={updated ? "new" : "old"} items={[updated ? "New" : "Old"]}>
              {(item) => <Text key={item}>{item}</Text>}
            </Static>
          ) : null}
          <Text>Live</Text>
        </>
      );
    }

    expect(renderToString(<Example />)).toBe(shouldReplace ? "New\nLive" : "Live");
  });
}

test("layout-effect appends to the same Static retain earlier items", () => {
  function Example() {
    const [items, setItems] = useState(["First"]);
    useLayoutEffect(() => {
      setItems(["First", "Second"]);
    }, []);

    return <Static items={items}>{(item) => <Text key={item}>{item}</Text>}</Static>;
  }

  expect(renderToString(<Example />)).toBe("First\nSecond");
});

test("replacement Static survives cleanup in static-only output", () => {
  let cleanupCount = 0;
  function Example() {
    const [updated, setUpdated] = useState(false);
    useLayoutEffect(() => {
      setUpdated(true);
      return () => {
        cleanupCount++;
      };
    }, []);

    return (
      <Static key={String(updated)} items={[updated ? "New" : "Old"]}>
        {(item) => <Text key={item}>{item}</Text>}
      </Static>
    );
  }

  expect(renderToString(<Example />)).toBe("New");
  expect(cleanupCount).toBe(1);
});
