import { Text, render } from "#/index.ts";

const { waitUntilExit } = render(<Text>Hello World</Text>);

await waitUntilExit();
console.log("exited");
