import { render, Text } from "@alchemy.run/sigil";

const app = render(<Text>Hello World</Text>);

setTimeout(() => {
  app.unmount();
}, 500);

await app.waitUntilExit();
console.log("exited");
