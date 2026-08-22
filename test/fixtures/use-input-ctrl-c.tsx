import React from "react";

import { render, useInput, useApp } from "#/index.ts";

function UserInput() {
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === "c" && key.ctrl) {
      exit();
      return;
    }

    throw new Error("Crash");
  });

  React.useEffect(() => {
    process.stdout.write("__READY__");
  }, []);

  return null;
}

const app = render(<UserInput />, { exitOnCtrlC: false });

await app.waitUntilExit();
console.log("exited");
