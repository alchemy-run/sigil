import { render, Text } from "@alchemy.run/sigil";

const app = render(<Text>Hello</Text>, { debug: true });

app.unmount();
await app.waitUntilExit();
process.stdout.write("DONE");
