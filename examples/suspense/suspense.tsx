import React from "react";

import { render, Text } from "#/index.ts";

let promise: Promise<void> | undefined;
let state: string | undefined;
let value: string | undefined;

const read = () => {
  if (!promise) {
    promise = new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    state = "pending";

    void (async () => {
      await promise;
      state = "done";
      value = "Hello World";
    })();
  }

  if (state === "pending") {
    throw promise;
  }

  if (state === "done") {
    return value;
  }
};

function Example() {
  const message = read();
  return <Text>{message}</Text>;
}

function Fallback() {
  return <Text>Loading...</Text>;
}

render(
  <React.Suspense fallback={<Fallback />}>
    <Example />
  </React.Suspense>,
);
