import { spawn as spawnProcess } from "node:child_process";
import * as path from "node:path";

import { test, expect } from "vite-plus/test";

import { gameReducer } from "../examples/alternate-screen/alternate-screen.tsx";

test("snake can move into the tail cell when the tail moves away", () => {
  const state = {
    snake: [
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ],
    food: { x: 0, y: 0 },
    score: 3,
    gameOver: false,
    won: false,
    frame: 10,
  };

  const nextState = gameReducer(state, {
    type: "tick",
    direction: "down",
  });

  expect(nextState.gameOver).toBe(false);
  expect(nextState.snake).toEqual([
    { x: 2, y: 2 },
    { x: 2, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
  ]);
  expect(nextState.score).toBe(state.score);
});

test("snake ends with a win when it fills the board", async () => {
  const fixturePath = path.join(
    import.meta.dirname,
    "fixtures/alternate-screen-full-board-win.tsx",
  );
  const childProcess = spawnProcess("node", ["--import=tsx", fixturePath], {
    cwd: import.meta.dirname,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  if (!childProcess.stdout || !childProcess.stderr) {
    expect.fail("Fixture process did not expose stdout/stderr pipes");
    return;
  }

  childProcess.stdout.on("data", (data: Uint8Array | string) => {
    stdout += typeof data === "string" ? data : data.toString();
  });

  childProcess.stderr.on("data", (data: Uint8Array | string) => {
    stderr += typeof data === "string" ? data : data.toString();
  });

  const result = await new Promise<{ timedOut: true } | { timedOut: false; exitCode: number }>(
    (resolve, reject) => {
      const timeout = setTimeout(() => {
        childProcess.kill();
        resolve({ timedOut: true });
      }, 1000);

      childProcess.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      childProcess.on("close", (exitCode) => {
        clearTimeout(timeout);
        resolve({ timedOut: false, exitCode: exitCode ?? 0 });
      });
    },
  );

  if (result.timedOut) {
    expect.fail("Fixture hung instead of finishing the full-board win case");
    return;
  }

  expect(result.exitCode).toBe(0);

  const nextState = JSON.parse(stdout);

  expect(nextState.gameOver).toBe(true);
  expect(nextState.won).toBe(true);
  expect(nextState.score).toBe(297);
  expect(nextState.snakeLength).toBe(300);
});
