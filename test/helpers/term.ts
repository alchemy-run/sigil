import path from "node:path";
import process from "node:process";

import { spawn } from "zigpty";

const fixturesDir = path.join(import.meta.dirname, "../fixtures");

const term = (fixture: string, args: string[] = []) => {
  let resolve: (value?: any) => void;
  let reject: (error?: Error) => void;

  const exitPromise = new Promise((resolve2, reject2) => {
    resolve = resolve2;
    reject = reject2;
  });

  let readyResolve: () => void;
  const readyPromise = new Promise<void>((r) => {
    readyResolve = r;
  });

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    NODE_NO_WARNINGS: "1",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    CI: "false",
  };

  const ps = spawn("node", ["--import=tsx", path.join(fixturesDir, `${fixture}.tsx`), ...args], {
    name: "xterm-color",
    cols: 100,
    cwd: fixturesDir,
    env,
  });

  const result = {
    write(input: string) {
      // Wait for the fixture to signal it's ready to accept input

      void readyPromise.then(() => {
        ps.write(input);
      });
    },
    output: "",
    waitForExit: async () => exitPromise,
  };

  ps.onData((data) => {
    result.output += data.toString();

    if (result.output.includes("__READY__")) {
      readyResolve();
    }
  });

  ps.onExit(({ exitCode }) => {
    if (exitCode === 0) {
      resolve();
      return;
    }

    reject(new Error(`Process exited with non-zero exit code: ${exitCode}`));
  });

  return result;
};

export default term;
