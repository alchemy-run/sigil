import { render } from "#/index.ts";

const Test = () => {
  throw new Error("errored");
};

const app = render(<Test />);

try {
  await app.waitUntilExit();
} catch (error: unknown) {
  console.log((error as Error).message);
}
