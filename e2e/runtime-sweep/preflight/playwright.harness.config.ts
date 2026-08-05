import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch:
    /(?:axe-context|control-action-semantics|control-actions(?:-form)?|dom-inventory|evidence-capture|keyboard-evidence|live-control-(?:lane|frozen-case)|runtime-surface)\.spec\.ts/,
  outputDir: ".results-harness",
  timeout: 30_000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    contextOptions: { reducedMotion: "reduce" },
  },
});
