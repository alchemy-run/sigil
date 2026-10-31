// Builds the patched Yoga reference wasm from the .vendor/yoga submodule.
// The differential tests and fuzzers compare src/yoga against this build.
// Yoga compiles its wasm with 32-bit floats; the f64 patch switches it to
// doubles so layouts compare exactly against the TypeScript engine. The
// patches after it carry fixes src/yoga makes on top of upstream Yoga.

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const javascriptDirectory = fileURLToPath(new URL("../.vendor/yoga/javascript/", import.meta.url));
const yogaDirectory = fileURLToPath(new URL("../.vendor/yoga/", import.meta.url));
// Applied in order, reversed in reverse order.
const patches = ["yoga-f64.patch", "yoga-flex-item-percent-min-max.patch"].map((name) =>
  fileURLToPath(new URL(`../patches/${name}`, import.meta.url)),
);
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

function canApply(args: readonly string[], patch: string): boolean {
  const result = spawnSync("git", ["apply", "--check", ...args, patch], {
    cwd: yogaDirectory,
    stdio: "ignore",
  });
  if (result.error) throw result.error;
  return result.status === 0;
}

// `git apply --check` validates one patch against the current tree, so a
// later patch can only be checked once the earlier ones are applied.
function applyPatches(): void {
  for (const patch of patches) {
    if (canApply([], patch)) {
      run("git", ["apply", patch], yogaDirectory);
    } else if (!canApply(["--reverse"], patch)) {
      throw new Error(
        `${patch} cannot be applied or reversed; the submodule has conflicting changes`,
      );
    } else {
      console.log(`${patch} was already applied; recovering this build`);
    }
  }
}

function reversePatches(): void {
  for (const patch of [...patches].reverse()) {
    if (canApply(["--reverse"], patch)) run("git", ["apply", "--reverse", patch], yogaDirectory);
  }
}

if (!existsSync(just)) {
  // Yoga's repository uses a Yarn v1 workspace. Installing just this package
  // avoids modern package managers migrating its pinned repository lockfile.
  run("npm", ["install", "--workspaces=false", "--ignore-scripts", "--no-package-lock"]);
}

console.log("Applying patches/ to the Yoga submodule");
applyPatches();

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
  reversePatches();
}
