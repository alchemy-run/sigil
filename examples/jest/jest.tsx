import { setTimeout as delay } from "node:timers/promises";

import { useState, useEffect, useCallback } from "react";

import { Static, Box, render } from "#/index.ts";

import Summary from "./summary.tsx";
import Test from "./test.tsx";

const paths = [
  "tests/login.js",
  "tests/signup.js",
  "tests/forgot-password.js",
  "tests/reset-password.js",
  "tests/view-profile.js",
  "tests/edit-profile.js",
  "tests/delete-profile.js",
  "tests/posts.js",
  "tests/post.js",
  "tests/comments.js",
];

type TestResult = {
  path: string;
  status: string;
};

function Jest() {
  const [startTime] = useState(Date.now);
  const [completedTests, setCompletedTests] = useState<TestResult[]>([]);
  const [runningTests, setRunningTests] = useState<TestResult[]>([]);

  const runTest = useCallback(async (path: string) => {
    setRunningTests((previous) => [
      ...previous,
      {
        status: "runs",
        path,
      },
    ]);

    await delay(1000 * Math.random());

    setRunningTests((previous) => previous.filter((test) => test.path !== path));
    setCompletedTests((previous) => [
      ...previous,
      {
        status: Math.random() < 0.5 ? "pass" : "fail",
        path,
      },
    ]);
  }, []);

  useEffect(() => {
    // Run the test queue with a concurrency of 4.
    const pending = [...paths];
    const runNext = async (): Promise<void> => {
      const path = pending.shift();
      if (path === undefined) {
        return;
      }

      await runTest(path);
      await runNext();
    };

    for (let worker = 0; worker < 4; worker++) {
      void runNext();
    }
  }, [runTest]);

  return (
    <Box flexDirection="column">
      <Static items={completedTests}>
        {(test) => <Test key={test.path} status={test.status} path={test.path} />}
      </Static>

      {runningTests.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {runningTests.map((test) => (
            <Test key={test.path} status={test.status} path={test.path} />
          ))}
        </Box>
      )}

      <Summary
        isFinished={runningTests.length === 0}
        passed={completedTests.filter((test) => test.status === "pass").length}
        failed={completedTests.filter((test) => test.status === "fail").length}
        time={`${((Date.now() - startTime) / 1000).toFixed(1)}s`}
      />
    </Box>
  );
}

render(<Jest />);
