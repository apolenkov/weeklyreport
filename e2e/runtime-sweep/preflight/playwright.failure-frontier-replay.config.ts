import * as path from "node:path";

import { defineConfig } from "@playwright/test";

import preflightConfig from "./playwright.preflight.config.ts";

if (process.env.RUNTIME_SWEEP_PREFLIGHT_MODE !== "capacity-survey")
  throw new Error(
    "Failure-frontier replay config requires isolated capacity-survey mode",
  );

const tempRootValue =
  process.env.RUNTIME_SWEEP_CAPACITY_SURVEY_TEMP_ROOT?.trim();
if (!tempRootValue)
  throw new Error("Failure-frontier replay config requires a temp root");
const tempRoot = path.resolve(tempRootValue);
if (!path.isAbsolute(tempRootValue) || tempRoot !== tempRootValue)
  throw new Error(
    "Failure-frontier replay temp root must be a normalized absolute path",
  );
const maxDurationMs = Number(
  process.env.RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_DURATION_MS,
);
if (!Number.isSafeInteger(maxDurationMs) || maxDurationMs < 1)
  throw new Error("Failure-frontier replay requires a positive max duration");

const [baseProject] = preflightConfig.projects ?? [];
if (baseProject === undefined || (preflightConfig.projects?.length ?? 0) !== 1)
  throw new Error("Failure-frontier replay requires one browser project");

const replaySpec = /preflight-failure-frontier-replay\.spec\.ts/;

export default defineConfig({
  ...preflightConfig,
  globalSetup: path.join(
    import.meta.dirname,
    "preflight-failure-frontier-replay-global-setup.ts",
  ),
  testMatch: replaySpec,
  outputDir: path.join(tempRoot, "playwright"),
  reporter: [["list"]],
  retries: 0,
  timeout: maxDurationMs,
  use: {
    ...preflightConfig.use,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      ...baseProject,
      name: "runtime-failure-frontier-replay",
      testMatch: replaySpec,
    },
  ],
});
