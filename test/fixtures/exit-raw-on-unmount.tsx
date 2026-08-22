import { useEffect } from "react";

import { render, Text, useStdin } from "#/index.ts";

function Test() {
  const { setRawMode } = useStdin();

  useEffect(() => {
    setRawMode(true);
  }, [setRawMode]);

  return <Text>Hello World</Text>;
}

const app = render(<Test />);

setTimeout(() => {
  app.unmount();
}, 500);

await app.waitUntilExit();
console.log("exited");
