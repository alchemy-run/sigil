import process from "node:process";

import { render, Text } from "../../src/index.ts";

const app = render(<Text>Hello</Text>, { debug: true });

app.unmount();
await app.waitUntilExit();
process.stdout.write("DONE");
