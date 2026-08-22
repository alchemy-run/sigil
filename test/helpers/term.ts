import path from "node:path";

import { spawn } from "zigpty";

const fixturesDir = path.join(import.meta.dirname, "../fixtures");

type TermOptions = {
  env?: Record<string, string>;
  columns?: number;
  rows?: number;
  // Strip Synchronized Update Mode sequences (bsu/esu) so tests only see the
  // actual content, not the transport wrapper.
  stripSyncSequences?: boolean;
};

const term = (fixture: string, args: string[] = [], options: TermOptions = {}) => {
  const exit = Promise.withResolvers<void>();
  const ready = Promise.withResolvers<void>();

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    // Force non-CI even when the suite itself runs on CI: an empty string is
    // falsy under Sigil's `Boolean(process.env.CI)` detection. Tests that want
    // CI behavior override this via options.env.
    // eslint-disable-next-line @typescript-eslint/naming-convention
    CI: "",
    ...options.env,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    NODE_NO_WARNINGS: "1",
  };

  const ps = spawn("node", ["--import=tsx", path.join(fixturesDir, `${fixture}.tsx`), ...args], {
    name: "xterm-color",
    cols: options.columns ?? 100,
    cwd: fixturesDir,
    env,
    ...(options.rows === undefined ? {} : { rows: options.rows }),
  });

  const result = {
    write(input: string) {
      // Wait for the fixture to signal it's ready to accept input. Note that
      // only fixtures printing __READY__ ever unblock this; writing to any
      // other fixture silently queues the input forever.
      void ready.promise.then(() => {
        ps.write(input);
      });
    },
    output: "",
    waitForExit: async () => exit.promise,
  };

  ps.onData((data) => {
    let chunk = data.toString();

    if (options.stripSyncSequences) {
      chunk = chunk.replaceAll("\u001B[?2026h", "").replaceAll("\u001B[?2026l", "");
    }

    result.output += chunk;

    if (result.output.includes("__READY__")) {
      ready.resolve();
    }
  });

  ps.onExit(({ exitCode }) => {
    if (exitCode === 0) {
      exit.resolve();
      return;
    }

    exit.reject(new Error(`Process exited with non-zero exit code: ${exitCode}`));
  });

  return result;
};

export default term;
