import { render, Text, useStdin, useStdout, useStderr } from "#/index.ts";

function Example() {
  const { stdin } = useStdin();
  const { stdout } = useStdout();
  const { stderr } = useStderr();
  return (
    <Text>
      Default streams:{" "}
      {String(stdin === process.stdin && stdout === process.stdout && stderr === process.stderr)}
    </Text>
  );
}

const instance = render(<Example />, {
  stdin: undefined,
  stdout: undefined,
  stderr: undefined,
  patchConsole: false,
});
await instance.waitUntilRenderFlush();
instance.unmount();
await instance.waitUntilExit();
