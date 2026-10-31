import { defaultClientConditions, defaultServerConditions, defineConfig } from "vite-plus";

// Run against sigil's source (the `source` export condition), so no build is needed.
export default defineConfig({
  resolve: { conditions: ["source", ...defaultClientConditions] },
  ssr: { resolve: { conditions: ["source", ...defaultServerConditions] } },
  test: {
    name: "integration",
    include: ["test/**/*.test.{ts,tsx}"],
    // PTY-based integration tests regularly exceed the default 5s.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: { FORCE_COLOR: "true" },
    // Ink patches and restores the real console; tests assert against
    // native console behavior, so keep Vitest's interception off.
    disableConsoleIntercept: true,
  },
});
