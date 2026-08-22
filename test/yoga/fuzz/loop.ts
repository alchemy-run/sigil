import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
// SPDX-License-Identifier: MIT
import { setImmediate } from "node:timers/promises";

import { Yoga } from "#/yoga/index.ts";
import type { Yoga as YogaApi } from "#/yoga/index.ts";

import Reference, { loadReferenceYoga } from "../reference/index.ts";
import { generateCase, type FuzzCase } from "./case.ts";
import { caseSeed, diagnosticJson, errorDetails, loopOptions, type ErrorDetails } from "./cli.ts";
import {
  assertEqualLayouts,
  assertInvariants,
  executeCase,
  type LayoutSnapshot,
} from "./execute.ts";

interface SuccessfulOutcome {
  readonly status: "ok";
  readonly layout: LayoutSnapshot;
}

interface FailedOutcome {
  readonly status: "error";
  readonly error: ErrorDetails;
}

type Outcome = SuccessfulOutcome | FailedOutcome;

interface FailureRecord {
  readonly version: 2;
  readonly fingerprint: string;
  readonly phase: string;
  readonly firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
  recentSeeds: number[];
  readonly replay: string;
  readonly reference: {
    readonly engine: "Yoga WASM";
    readonly numericPrecision: "binary64";
    readonly patch: "patches/yoga-f64.patch";
  };
  readonly campaign: {
    readonly baseSeed: number;
    readonly firstCaseIndex: number;
    readonly maxNodes: number;
  };
  readonly runtime: {
    readonly node: string;
    readonly platform: NodeJS.Platform;
    readonly architecture: string;
  };
  readonly error: ErrorDetails;
  readonly outcomes: {
    readonly javascript: Outcome;
    readonly javascriptRepeat?: Outcome;
    readonly wasm: Outcome;
  };
  readonly case: FuzzCase;
}

let reference = Reference as unknown as YogaApi;
const campaign = loopOptions();
const failureDirectory = path.join(import.meta.dirname, "../../../.reference/fuzz-failures/loop/");
mkdirSync(failureDirectory, { recursive: true });

const records = new Map<string, FailureRecord>();
for (const filename of readdirSync(failureDirectory)) {
  if (!filename.endsWith(".json")) continue;
  const path = `${failureDirectory}/${filename}`;
  try {
    const record = JSON.parse(readFileSync(path, "utf8")) as FailureRecord;
    if (record.version === 2 && record.fingerprint) {
      records.set(record.fingerprint, record);
    }
  } catch (error) {
    console.error(`Ignoring unreadable failure record ${path}`, error);
  }
}

function outcome(engine: YogaApi, fuzzCase: FuzzCase): Outcome {
  try {
    return { status: "ok", layout: executeCase(engine, fuzzCase) };
  } catch (error) {
    return { status: "error", error: errorDetails(error) };
  }
}

function normalizedMessage(error: ErrorDetails): string {
  return error.message
    .replace(/^.*\.hadOverflow:/, "<path>.hadOverflow:")
    .replace(/JavaScript=.*?, WASM=.*$/, "JavaScript=<value>, WASM=<value>");
}

function recordFailure(
  phase: string,
  fuzzCase: FuzzCase,
  caseIndex: number,
  details: ErrorDetails,
  javascript: Outcome,
  wasm: Outcome,
  javascriptRepeat?: Outcome,
): void {
  const signature = `${phase}\n${details.name}\n${normalizedMessage(details)}`;
  const fingerprint = createHash("sha256").update(signature).digest("hex").slice(0, 16);
  const now = new Date().toISOString();
  const existing = records.get(fingerprint);
  if (existing) {
    existing.lastSeenAt = now;
    existing.occurrences++;
    existing.recentSeeds = [
      ...existing.recentSeeds.filter((seed) => seed !== fuzzCase.seed),
      fuzzCase.seed,
    ].slice(-16);
    writeRecord(existing);
    return;
  }

  const record: FailureRecord = {
    version: 2,
    fingerprint,
    phase,
    firstSeenAt: now,
    lastSeenAt: now,
    occurrences: 1,
    recentSeeds: [fuzzCase.seed],
    replay:
      `vpr fuzz:differential -- --seed ${fuzzCase.seed} --runs 1 ` +
      `--max-nodes ${campaign.maxNodes}`,
    reference: {
      engine: "Yoga WASM",
      numericPrecision: "binary64",
      patch: "patches/yoga-f64.patch",
    },
    campaign: {
      baseSeed: campaign.seed,
      firstCaseIndex: caseIndex,
      maxNodes: campaign.maxNodes,
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
    },
    error: details,
    outcomes: {
      javascript,
      ...(javascriptRepeat === undefined ? {} : { javascriptRepeat }),
      wasm,
    },
    case: fuzzCase,
  };
  records.set(fingerprint, record);
  writeRecord(record);
  console.error(
    `\nnew ${phase} failure ${fingerprint} at seed ${fuzzCase.seed}: ${details.message}`,
  );
  console.error(`replay: ${record.replay}`);
}

function writeRecord(record: FailureRecord): void {
  const path = `${failureDirectory}/${record.phase}-${record.fingerprint}.json`;
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, diagnosticJson(record));
  renameSync(temporaryPath, path);
}

let stoppingSignal: NodeJS.Signals | undefined;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    stoppingSignal = signal;
  });
}

console.log(
  `fuzz:loop started (seed=${campaign.seed}, maxNodes=${campaign.maxNodes}, ` +
    `existingFailures=${records.size})`,
);

let caseIndex = 0;
let failureCount = 0;
const startedAt = performance.now();
while (stoppingSignal === undefined) {
  const fuzzCase = generateCase(caseSeed(campaign.seed, caseIndex), campaign.maxNodes);
  const javascript = outcome(Yoga, fuzzCase);
  const javascriptRepeat = outcome(Yoga, fuzzCase);
  const wasm = outcome(reference, fuzzCase);

  if (javascript.status === "error") {
    failureCount++;
    recordFailure(
      "javascript-crash",
      fuzzCase,
      caseIndex,
      javascript.error,
      javascript,
      wasm,
      javascriptRepeat,
    );
  } else if (javascriptRepeat.status === "error") {
    failureCount++;
    recordFailure(
      "javascript-repeat-crash",
      fuzzCase,
      caseIndex,
      javascriptRepeat.error,
      javascript,
      wasm,
      javascriptRepeat,
    );
  } else {
    try {
      assertInvariants(javascript.layout, javascriptRepeat.layout);
    } catch (error) {
      failureCount++;
      recordFailure(
        "javascript-invariant",
        fuzzCase,
        caseIndex,
        errorDetails(error),
        javascript,
        wasm,
        javascriptRepeat,
      );
    }

    if (wasm.status === "error") {
      failureCount++;
      recordFailure(
        "wasm-crash",
        fuzzCase,
        caseIndex,
        wasm.error,
        javascript,
        wasm,
        javascriptRepeat,
      );
      // An Emscripten abort permanently poisons that module instance. Replace
      // it immediately so one real crash does not turn every later case into
      // another "Aborted()" and flood the terminal/corpus.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion no-await-in-loop
      reference = (await loadReferenceYoga()) as unknown as YogaApi;
      console.error("restarted Yoga WASM after crash");
    } else {
      try {
        assertEqualLayouts(javascript.layout, wasm.layout);
      } catch (error) {
        failureCount++;
        const phase =
          error instanceof Error && error.message.includes(".hadOverflow:")
            ? "differential-overflow"
            : "differential";
        recordFailure(
          phase,
          fuzzCase,
          caseIndex,
          errorDetails(error),
          javascript,
          wasm,
          javascriptRepeat,
        );
      }
    }
  }

  caseIndex++;
  if (caseIndex % campaign.reportEvery === 0) {
    const elapsedSeconds = (performance.now() - startedAt) / 1_000;
    console.log(
      `fuzz:loop ${caseIndex} cases, ${failureCount} failures, ` +
        `${records.size} unique, ${(caseIndex / elapsedSeconds).toFixed(1)} cases/s`,
    );
  }
  if (caseIndex % 100 === 0) {
    await setImmediate();
  }
}

console.log(
  `fuzz:loop stopped by ${stoppingSignal} after ${caseIndex} cases ` +
    `(${failureCount} failures, ${records.size} unique)`,
);
process.exitCode = stoppingSignal === "SIGINT" ? 130 : 143;
