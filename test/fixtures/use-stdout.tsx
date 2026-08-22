import { useEffect } from "react";

import { render, useStdout, Text } from "../../src/index.ts";

function WriteToStdout() {
  const { write } = useStdout();

  useEffect(() => {
    write("Hello from Ink to stdout\n");
  }, [write]);

  return <Text>Hello World</Text>;
}

const app = render(<WriteToStdout />);

await app.waitUntilExit();
console.log("exited");
