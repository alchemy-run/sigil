import { render, Text } from "#/index.ts";

const app = render(<Text>Hello World</Text>);

setTimeout(() => {
  app.unmount();
}, 500);

await app.waitUntilExit();
console.log("exited");
