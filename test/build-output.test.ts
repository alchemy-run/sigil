import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { expect, test } from "vite-plus/test";

const rootDir = path.join(import.meta.dirname, "..");
const distDir = path.join(rootDir, "dist");

const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8")) as {
  exports: { types: string; default: string };
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
  const { exports } = packageJson;
  const typesPath = path.join(rootDir, exports.types);
  const defaultPath = path.join(rootDir, exports.default);

  expect(fs.existsSync(typesPath), `Types export path does not exist: ${exports.types}`).toBe(true);
  expect(fs.existsSync(defaultPath), `Default export path does not exist: ${exports.default}`).toBe(
    true,
  );
});

test("dist entry point and type declarations exist", () => {
  expect(fs.existsSync(path.join(distDir, "index.js")), "dist/index.mjs should exist").toBe(true);
  expect(fs.existsSync(path.join(distDir, "index.d.ts")), "dist/index.d.mts should exist").toBe(
    true,
  );
});
