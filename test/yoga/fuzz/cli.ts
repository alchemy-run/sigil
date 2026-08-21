// SPDX-License-Identifier: MIT

import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { FuzzCase } from "./case.ts";

export interface FuzzOptions {
  readonly seed: number;
  readonly runs: number;
  readonly maxNodes: number;
}

export interface FuzzLoopOptions {
  readonly seed: number;
  readonly maxNodes: number;
  readonly reportEvery: number;
}

export interface ErrorDetails {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly cause?: ErrorDetails | string;
}

function argument(name: string): string | undefined {
  const inline = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function integerArgument(name: string, fallback: number): number {
  const raw = argument(name);
  const parsed = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
  return parsed;
}

export function options(defaultRuns: number): FuzzOptions {
  const randomSeed = randomBytes(4).readUInt32LE();
  const result = {
    seed: integerArgument("seed", randomSeed) >>> 0,
    runs: integerArgument("runs", defaultRuns),
    maxNodes: integerArgument("max-nodes", 24),
  };
  if (result.maxNodes === 0) throw new Error("--max-nodes must be at least 1");
  return result;
}

export function loopOptions(): FuzzLoopOptions {
  const randomSeed = randomBytes(4).readUInt32LE();
  const result = {
    seed: integerArgument("seed", randomSeed) >>> 0,
    maxNodes: integerArgument("max-nodes", 24),
    reportEvery: integerArgument("report-every", 1_000),
  };
  if (result.maxNodes === 0) throw new Error("--max-nodes must be at least 1");
  if (result.reportEvery === 0) throw new Error("--report-every must be at least 1");
  return result;
}

export function errorDetails(error: unknown): ErrorDetails {
  if (!(error instanceof Error)) {
    return { name: typeof error, message: String(error) };
  }
  const cause =
    error.cause instanceof Error
      ? errorDetails(error.cause)
      : error.cause === undefined
        ? undefined
        : (JSON.stringify(error.cause) ?? "undefined");
  return {
    name: error.name,
    message: error.message,
    ...(error.stack === undefined ? {} : { stack: error.stack }),
    ...(cause === undefined ? {} : { cause }),
  };
}

export function diagnosticJson(value: unknown): string {
  return `${JSON.stringify(
    value,
    (_key, item: unknown) =>
      typeof item === "number" && !Number.isFinite(item) ? { $number: String(item) } : item,
    2,
  )}\n`;
}

export function caseSeed(baseSeed: number, index: number): number {
  return (baseSeed + Math.imul(index, 0x9e3779b9)) >>> 0;
}

export function reportFailure(
  kind: string,
  fuzzCase: FuzzCase,
  maxNodes: number,
  error: unknown,
): never {
  const directory = path.join(import.meta.dirname, "../../../.reference/fuzz-failures/");
  const filename = `${kind.replaceAll(":", "-")}-${fuzzCase.seed}.json`;
  mkdirSync(directory, { recursive: true });
  const replay = `vpr ${kind} -- --seed ${fuzzCase.seed} --runs 1 ` + `--max-nodes ${maxNodes}`;
  writeFileSync(
    `${directory}/${filename}`,
    diagnosticJson({
      version: 1,
      kind,
      seed: fuzzCase.seed,
      maxNodes,
      recordedAt: new Date().toISOString(),
      replay,
      runtime: {
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
      },
      error: errorDetails(error),
      case: fuzzCase,
    }),
  );
  console.error(`\n${kind} fuzz failure for seed ${fuzzCase.seed}`);
  console.error(`Replay with: ${replay}`);
  console.error(`Case written to .reference/fuzz-failures/${filename}`);
  throw error;
}

export function reportSuccess(kind: string, optionsValue: FuzzOptions): void {
  console.log(
    `${kind}: ${optionsValue.runs} cases passed ` +
      `(seed=${optionsValue.seed}, maxNodes=${optionsValue.maxNodes})`,
  );
}
