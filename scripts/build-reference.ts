// Builds the f64-patched Yoga reference wasm from the .vendor/yoga submodule.
// The differential tests and fuzzers compare src/yoga against this build.
// Yoga compiles its wasm with 32-bit floats; the f64 patch switches it to
// doubles so layouts compare exactly against the TypeScript engine.

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const javascriptDirectory = fileURLToPath(new URL("../.vendor/yoga/javascript/", import.meta.url));
const yogaDirectory = fileURLToPath(new URL("../.vendor/yoga/", import.meta.url));
const f64Patch = fileURLToPath(new URL("../patches/yoga-f64.patch", import.meta.url));
const generatedReferenceDirectory = fileURLToPath(
  new URL("../.reference/yoga-f64/", import.meta.url),
);
const just = fileURLToPath(
  new URL("../.vendor/yoga/javascript/node_modules/just-task/bin/just.js", import.meta.url),
);

function run(command: string, args: readonly string[], cwd: string = javascriptDirectory): void {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.signal ?? result.status}`);
  }
}

function canApply(args: readonly string[]): boolean {
  const result = spawnSync("git", ["apply", "--check", ...args, f64Patch], {
    cwd: yogaDirectory,
    stdio: "ignore",
  });
  if (result.error) throw result.error;
  return result.status === 0;
}

if (!existsSync(just)) {
  // Yoga's repository uses a Yarn v1 workspace. Installing just this package
  // avoids modern package managers migrating its pinned repository lockfile.
  run("npm", ["install", "--workspaces=false", "--ignore-scripts", "--no-package-lock"]);
}

const patchWasAlreadyApplied = !canApply([]);
if (patchWasAlreadyApplied && !canApply(["--reverse"])) {
  throw new Error(
    "Yoga f64 patch cannot be applied or reversed; the submodule has conflicting changes",
  );
}

if (patchWasAlreadyApplied) {
  console.log("Yoga f64 patch was already applied; recovering this build");
} else {
  console.log("Applying patches/yoga-f64.patch to the Yoga submodule");
  run("git", ["apply", f64Patch], yogaDirectory);
}

try {
  run(process.execPath, [just, "build", "--config", "just.config.cjs"]);
  mkdirSync(`${generatedReferenceDirectory}/generated`, { recursive: true });
  copyFileSync(
    `${javascriptDirectory}/src/wrapAssembly.ts`,
    `${generatedReferenceDirectory}/wrapAssembly.ts`,
  );
  copyFileSync(
    `${javascriptDirectory}/src/generated/YGEnums.ts`,
    `${generatedReferenceDirectory}/generated/YGEnums.ts`,
  );
  copyFileSync(
    `${javascriptDirectory}/binaries/yoga-wasm-base64-esm.js`,
    `${generatedReferenceDirectory}/yoga-wasm-base64-esm.js`,
  );
} finally {
  console.log("Restoring the Yoga submodule");
  run("git", ["apply", "--reverse", f64Patch], yogaDirectory);
}
