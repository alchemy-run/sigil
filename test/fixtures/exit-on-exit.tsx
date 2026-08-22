import { useState, useEffect } from "react";

import { render, Text, useApp } from "../../src/index.ts";

function Test() {
  const [counter, setCounter] = useState(0);
  const { exit } = useApp();

  useEffect(() => {
    setTimeout(exit, 500);

    const timer = setInterval(() => {
      setCounter((previous) => previous + 1);
    }, 100);

    return () => {
      clearInterval(timer);
    };
  }, [exit]);

  return <Text>Counter: {counter}</Text>;
}

const app = render(<Test />);

await app.waitUntilExit();
console.log("exited");
