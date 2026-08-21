import process from "node:process";

import React, { useState, useCallback, useEffect } from "react";

import { render, useInput, useApp, Text } from "../../src/index.ts";

function App() {
  const { exit } = useApp();
  const [input, setInput] = useState("");

  const handleInput = useCallback((newInput: string) => {
    setInput((previousInput: string) => previousInput + newInput);
  }, []);

  useInput(handleInput);
  useInput(handleInput, { isActive: false });

  useEffect(() => {
    process.stdout.write("__READY__");
  }, []);

  useEffect(() => {
    setTimeout(exit, 100);
  }, [exit]);

  return <Text>{input}</Text>;
}

const app = render(<App />);

await app.waitUntilExit();
console.log("exited");
