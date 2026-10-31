import fs from "node:fs";

import { Text, render } from "@alchemy.run/sigil";
import { useEffect } from "react";

function App() {
  useEffect(
    () => () => {
      fs.writeSync(process.stdout.fd, "unmounted");
    },
    [],
  );

  return <Text>Hello World</Text>;
}

render(<App />);

// `signal-exit` 4 replaces `process.emit` when it registers an exit handler
// and restores whatever it saw when it unloads. Do the same here, so any exit
// hook installed through `process.emit` before this point would be dropped.
// oxlint-disable-next-line typescript/unbound-method -- restored onto `process` below
const originalEmit = process.emit;
process.emit = function (this: NodeJS.Process, ...args: Parameters<typeof originalEmit>) {
  return originalEmit.apply(this, args);
} as typeof process.emit;
await new Promise((resolve) => setTimeout(resolve, 10));
process.emit = originalEmit;

process.exit(0);
