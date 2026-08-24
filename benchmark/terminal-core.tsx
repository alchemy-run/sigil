import { performance } from "node:perf_hooks";

import React from "react";

import { Box, renderToString, Text } from "#/index.ts";
import { createCell, Screen, serializeScreen } from "#/screen/index.ts";

type Result = {
  readonly name: string;
  readonly iterations: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly allocationBytes: number;
  readonly outputBytes: number;
  readonly budgetMs: number;
  readonly budgetAllocationBytes: number;
  readonly budgetOutputBytes: number;
};

const cell = (value: string, width = 1) => createCell(value, width);

const screen = (width: number, height: number, wide = false): Screen => {
  const output = new Screen(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x += wide ? 2 : 1)
      output.setCell(x, y, cell(wide ? "界" : "x", wide ? 2 : 1));
  }
  output.takeDirtySpans();
  return output;
};

const measure = (
  name: string,
  iterations: number,
  budgetMs: number,
  budgetAllocationBytes: number,
  budgetOutputBytes: number,
  workload: () => string,
): Result => {
  for (let index = 0; index < Math.min(iterations, 20); index++) workload();
  const beforeHeap = process.memoryUsage().heapUsed;
  const timings: number[] = [];
  let outputBytes = 0;
  for (let index = 0; index < iterations; index++) {
    const start = performance.now();
    const output = workload();
    timings.push(performance.now() - start);
    outputBytes += Buffer.byteLength(output);
  }
  const allocationBytes = Math.max(0, process.memoryUsage().heapUsed - beforeHeap) / iterations;
  timings.sort((left, right) => left - right);
  return {
    name,
    iterations,
    medianMs: timings[Math.floor(iterations / 2)],
    p95Ms: timings[Math.floor(iterations * 0.95)],
    allocationBytes,
    outputBytes: outputBytes / iterations,
    budgetMs,
    budgetAllocationBytes,
    budgetOutputBytes,
  };
};

const full = screen(120, 40);
for (let y = 0; y < full.height; y++) full.setCell(y % full.width, y, cell("!"));
const wide = screen(120, 40, true);

const table = (
  <Box flexDirection="column">
    {Array.from({ length: 50 }, (_, row) => (
      <Box key={row} width={100} justifyContent="space-between">
        <Text color={row % 2 === 0 ? "cyan" : "green"}>row {row}</Text>
        <Text>{"value".repeat(12)}</Text>
      </Box>
    ))}
  </Box>
);

const results = [
  measure("react-large-table", 100, 25, 2_000_000, 6000, () =>
    renderToString(table, { columns: 120, colorProfile: "truecolor" }),
  ),
  measure("full-screen-serialization", 500, 4, 500_000, 5000, () =>
    serializeScreen(full, { colorProfile: "truecolor" }),
  ),
  measure("wide-screen-serialization", 500, 4, 500_000, 10_000, () =>
    serializeScreen(wide, { colorProfile: "truecolor" }),
  ),
];

process.stdout.write(`${JSON.stringify(results, undefined, 2)}\n`);
if (process.argv.includes("--check")) {
  const failures = results.filter(
    (result) =>
      result.p95Ms > result.budgetMs ||
      result.allocationBytes > result.budgetAllocationBytes ||
      result.outputBytes > result.budgetOutputBytes,
  );
  if (failures.length > 0) {
    process.stderr.write(
      `Performance budget exceeded: ${failures.map((result) => result.name).join(", ")}\n`,
    );
    process.exitCode = 1;
  }
}
