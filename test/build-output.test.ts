import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { expect, test } from "vite-plus/test";

const rootDir = path.join(import.meta.dirname, "..");
const distDir = path.join(rootDir, "dist");
let consumerDir: string;

const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8")) as {
  exports: Record<string, Record<string, string>>;
};

test.beforeAll(() => {
  fs.rmSync(distDir, { recursive: true, force: true });
  execSync("pnpm run build", { cwd: rootDir, stdio: "pipe" });
  consumerDir = fs.mkdtempSync(path.join(os.tmpdir(), "sigil-jsx-consumer-"));
  const packageDir = path.join(consumerDir, "node_modules/@alchemy.run/sigil");
  fs.mkdirSync(packageDir, { recursive: true });
  fs.copyFileSync(path.join(rootDir, "package.json"), path.join(packageDir, "package.json"));
  fs.cpSync(distDir, path.join(packageDir, "dist"), { recursive: true });
  fs.cpSync(path.join(import.meta.dirname, "fixtures/jsx-runtime"), consumerDir, {
    recursive: true,
  });
});

test.afterAll(() => {
  if (consumerDir) fs.rmSync(consumerDir, { recursive: true, force: true });
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

// https://github.com/alchemy-run/alchemy/issues/1689
// Fresh processes preserve the distinction between startup NODE_ENV and a CLI
// changing it before loading its renderer. The consumer has no external React.
test.each([undefined, "development", "production"])(
  "published JSX runtimes render in Node with startup NODE_ENV=%s",
  (nodeEnv) => {
    const env: NodeJS.ProcessEnv = { ...process.env, CI: "true", FORCE_COLOR: "0" };
    delete env.NODE_ENV;
    if (nodeEnv !== undefined) env.NODE_ENV = nodeEnv;
    const result = spawnSync(process.execPath, ["entry.mjs"], {
      cwd: consumerDir,
      env,
      encoding: "utf8",
      timeout: 30_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("Planning stack");
  },
);

test.each([
  ["preserve", undefined],
  ["preserve", "development"],
  ["preserve", "production"],
  ["react-jsxdev", undefined],
  ["react-jsxdev", "production"],
])("Bun renders TSX with jsx=%s and startup NODE_ENV=%s", (jsx, nodeEnv) => {
  fs.writeFileSync(
    path.join(consumerDir, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { jsx, jsxImportSource: "@alchemy.run/sigil" } }),
  );
  const env: NodeJS.ProcessEnv = { ...process.env, CI: "true", FORCE_COLOR: "0" };
  delete env.NODE_ENV;
  if (nodeEnv !== undefined) env.NODE_ENV = nodeEnv;
  const result = spawnSync("bun", ["entry.mjs", "--tsx"], {
    cwd: consumerDir,
    env,
    encoding: "utf8",
    timeout: 30_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout.trim()).toBe("Planning stack");
});
