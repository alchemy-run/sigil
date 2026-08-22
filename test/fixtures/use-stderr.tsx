import { useEffect } from "react";

import { render, useStderr, Text } from "#/index.ts";

function WriteToStderr() {
  const { write } = useStderr();

  useEffect(() => {
    write("Hello from Ink to stderr\n");
  }, [write]);

  return <Text>Hello World</Text>;
}

const app = render(<WriteToStderr />);

await app.waitUntilExit();
console.log("exited");
