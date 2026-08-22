import { render, Text } from "#/index.ts";

const app = render(<Text>Hello</Text>, { debug: true });

app.unmount();
await app.waitUntilExit();
process.stdout.write("DONE");
