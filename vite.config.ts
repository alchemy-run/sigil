import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: "src/index.ts",
      ansi: "src/ansi/index.ts",
      yoga: "src/yoga/index.ts",
    },
    format: "esm",
    outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
    dts: true,
    deps: {
      neverBundle: ["ws"],
    },
  },
  test: {
    projects: [
      {
        test: {
          alias: {
            "yoga-layout": "src/yoga/index.ts",
          },
          globalSetup: ["test/yoga/reference/setup.ts"],
          include: [".vendor/yoga/javascript/tests/**/*.test.ts"],
          exclude: [".vendor/yoga/javascript/tests/Benchmarks/**"],
          globals: true,
        },
      },
      {
        test: {
          include: ["test/**/*.test.{ts,tsx}"],
          // PTY-based integration tests regularly exceed the default 5s.
          testTimeout: 60_000,
          hookTimeout: 60_000,
          env: { FORCE_COLOR: "true" },
          // Ink patches and restores the real console; tests assert against
          // native console behavior, so keep Vitest's interception off.
          disableConsoleIntercept: true,
        },
      },
    ],
  },
  lint: {
    categories: { correctness: "error", suspicious: "warn" },
    options: { typeAware: true, typeCheck: true },
    rules: {
      "typescript/consistent-return": "off",
      "unicorn/consistent-function-scoping": "off",
      // Deliberate narrowing casts are structural here: the reconciler host
      // config receives `unknown` props, and test fakes are EventEmitters
      // dressed up as streams.
      "typescript/no-unsafe-type-assertion": "off",
      // Fights platform names (`__dirname`) and upstream Yoga's
      // trailing-underscore private fields (`margin_`).
      "no-underscore-dangle": "off",
      // `toReversed()` allocates a copy; render-path code reverses
      // locally-owned arrays in place on purpose.
      "unicorn/no-array-reverse": "off",
      // This is a terminal library: regexes matching ESC and friends are the
      // whole point (escape-sequence parsing), not an accident.
      "no-control-regex": "off",
    },
    ignorePatterns: [".reference", ".vendor", "dist", "test/yoga/**"],
  },
  fmt: {
    ignorePatterns: [".reference", ".vendor", "dist"],
    printWidth: 100,
    semi: true,
    sortImports: true,
    sortPackageJson: true,
    useTabs: false,
    trailingComma: "all",
    singleQuote: false,
  },
});
