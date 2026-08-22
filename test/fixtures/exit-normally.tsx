import { Text, render } from "../../src/index.ts";

const { waitUntilExit } = render(<Text>Hello World</Text>);

await waitUntilExit();
console.log("exited");
