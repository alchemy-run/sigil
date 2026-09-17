import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "vite-plus/test";

const rootDir = path.join(import.meta.dirname, "..");
const distDir = path.join(rootDir, "dist");

const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8")) as {
  exports: Record<string, Record<string, string>>;
};

test.beforeAll(() => {
  fs.rmSync(distDir, { recursive: true, force: true });
  execSync("pnpm run build", { cwd: rootDir, stdio: "pipe" });
});

test("build output files are not nested under dist/src/", () => {
  expect(
    fs.existsSync(path.join(distDir, "src")),
    "dist/src/ should not exist — files should be directly in dist/",
  ).toBe(false);
});

test("package.json export paths resolve to existing files", () => {
  for (const [subpath, conditions] of Object.entries(packageJson.exports)) {
    for (const [condition, target] of Object.entries(conditions)) {
      expect(
        fs.existsSync(path.join(rootDir, target)),
        `exports["${subpath}"].${condition} does not exist: ${target}`,
      ).toBe(true);
    }
  }
});

test("dist entry point and type declarations exist", () => {
  expect(fs.existsSync(path.join(distDir, "index.js")), "dist/index.mjs should exist").toBe(true);
  expect(fs.existsSync(path.join(distDir, "index.d.ts")), "dist/index.d.mts should exist").toBe(
    true,
  );
});

// React exports `jsxDEV` from `react/jsx-dev-runtime` in its development build
// only, and this package bundles React, so under `NODE_ENV=production` the
// re-export used to resolve to `undefined`. A transpiler picks the development
// JSX transform independently of `NODE_ENV` — bun's runtime transpiler emits
// `jsxDEV` calls while the host process may already have set production — so
// that combination failed at the first render. Asserted against the built
// output rather than the source, because it is the bundler that inlines the
// branch.
test("jsxDEV is callable under NODE_ENV=production", () => {
  const entry = pathToFileURL(path.join(distDir, "jsx-dev-runtime.js")).href;
  const probe = [
    `const { jsxDEV, Fragment } = await import(${JSON.stringify(entry)});`,
    'if (typeof jsxDEV !== "function") throw new Error("jsxDEV is " + typeof jsxDEV);',
    'if (Fragment === undefined) throw new Error("Fragment is undefined");',
    'const el = jsxDEV(Fragment, { children: "x" }, undefined, false);',
    'if (el?.type !== Fragment) throw new Error("jsxDEV returned " + String(el?.type));',
  ].join("\n");
  execFileSync(process.execPath, ["--input-type=module", "-e", probe], {
    cwd: rootDir,
    stdio: "pipe",
    env: { ...process.env, NODE_ENV: "production" },
  });
});
