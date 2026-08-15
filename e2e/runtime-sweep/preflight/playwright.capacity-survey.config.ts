import * as path from "node:path";

import { defineConfig } from "@playwright/test";

import preflightConfig from "./playwright.preflight.config.ts";

if (process.env.RUNTIME_SWEEP_PREFLIGHT_MODE !== "capacity-survey")
  throw new Error(
    "Capacity survey Playwright config requires capacity-survey mode",
  );

const tempRootValue =
  process.env.RUNTIME_SWEEP_CAPACITY_SURVEY_TEMP_ROOT?.trim();
if (!tempRootValue)
  throw new Error("Capacity survey Playwright config requires a temp root");
const tempRoot = path.resolve(tempRootValue);
if (!path.isAbsolute(tempRootValue) || tempRoot !== tempRootValue)
  throw new Error(
    "Capacity survey Playwright temp root must be a normalized absolute path",
  );
const maxDurationMs = Number(
  process.env.RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_DURATION_MS,
);
if (!Number.isSafeInteger(maxDurationMs) || maxDurationMs < 1)
  throw new Error(
    "Capacity survey Playwright config requires a positive max duration",
  );

const baseUse = preflightConfig.use ?? {};
const { recordHar: _recordHar, ...contextOptionsWithoutHar } =
  baseUse.contextOptions ?? {};
const [baseProject] = preflightConfig.projects ?? [];
if (baseProject === undefined || (preflightConfig.projects?.length ?? 0) !== 1)
  throw new Error("Capacity survey requires one preflight browser project");

const surveySpec = /preflight-capacity-survey\.spec\.ts/;

export default defineConfig({
  ...preflightConfig,
  testMatch: surveySpec,
  outputDir: path.join(tempRoot, "playwright"),
  reporter: [["list"]],
  retries: 0,
  timeout: maxDurationMs,
  use: {
    ...baseUse,
    contextOptions: contextOptionsWithoutHar,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      ...baseProject,
      name: "runtime-capacity-survey",
      testMatch: surveySpec,
    },
  ],
});
