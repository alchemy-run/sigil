import { render, Text, useApp, useStdin } from "@alchemy.run/sigil";
import { useEffect } from "react";

function Test() {
  const { exit } = useApp();
  const { setRawMode } = useStdin();

  useEffect(() => {
    setRawMode(true);
    setTimeout(exit, 500);
  }, [exit, setRawMode]);

  return <Text>Hello World</Text>;
}

const app = render(<Test />);

await app.waitUntilExit();
console.log("exited");
