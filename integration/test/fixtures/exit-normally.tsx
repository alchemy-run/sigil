import { Text, render } from "@alchemy.run/sigil";

const { waitUntilExit } = render(<Text>Hello World</Text>);

await waitUntilExit();
console.log("exited");
