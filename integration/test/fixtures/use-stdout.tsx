import { render, useStdout, Text } from "@alchemy.run/sigil";
import { useEffect } from "react";

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
