import { defineConfig } from "vitest/config";

// Shared coverage shell for every suite: the engine, the report formats and
// where the report lands are a repo-wide decision, so they live in one place.
// What each suite measures (`include`/`exclude`) and how strict it is
// (`thresholds`) stays in that suite's own config — they differ on purpose.
// `reportsDirectory` is resolved against the merging project's root, so each
// suite still writes its own `<project>/coverage`.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov", "html"],
      reportsDirectory: "./coverage",
    },
  },
});
