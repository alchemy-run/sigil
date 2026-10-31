import { render, Text, useStdin } from "@alchemy.run/sigil";
import { useEffect } from "react";

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
