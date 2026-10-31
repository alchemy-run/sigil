import { render, useStderr, Text } from "@alchemy.run/sigil";
import { useEffect } from "react";

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
