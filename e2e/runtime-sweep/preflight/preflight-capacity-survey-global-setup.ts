import { lstat } from "node:fs/promises";
import * as path from "node:path";

import {
  type BrowserContextOptions,
  chromium,
  devices,
} from "@playwright/test";

import {
  readSourceArtifact,
  type SourceArtifact,
} from "../source/source-artifact.ts";
import { assertLivePreflightSourceIdentity } from "./canary/preflight-canary.ts";
import type { CapacitySurveyPlan } from "./capacity/preflight-capacity-survey-contract.ts";
import {
  readCapacitySurveyPlan,
  writeCapacitySurveyResult,
} from "./capacity/preflight-capacity-survey-io.ts";
import { createCapacitySurveyProgressReporter } from "./capacity/preflight-capacity-survey-progress.ts";
import { runPlaywrightPreflightCapacitySurvey } from "./execution/playwright-preflight-capacity-survey.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveRoot,
} from "./preflight-archive-path.ts";
import { createPreflightRuntimePreparation } from "./runtime/preflight-runtime-setup.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime capacity survey requires ${name}`);
  return value;
};

const assertAbsent = async (filePath: string): Promise<void> => {
  try {
    await lstat(filePath);
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return;
    throw error;
  }
  throw new Error(`Capacity survey result already exists: ${filePath}`);
};

const { defaultBrowserType: _defaultBrowserType, ...desktopChrome } =
  devices["Desktop Chrome"];

export const capacitySurveyContextOptions = {
  ...desktopChrome,
  reducedMotion: "reduce",
  viewport: { width: 1440, height: 900 },
} satisfies BrowserContextOptions;

const runCapacitySurveyInBrowser = async (input: {
  readonly source: SourceArtifact;
  readonly plan: CapacitySurveyPlan;
  readonly databaseUrl: string;
  readonly repoRoot: string;
  readonly apiUrl: string;
  readonly webOrigin: string;
  readonly resultRoot: string;
  readonly resultPath: string;
}): Promise<void> => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      ...capacitySurveyContextOptions,
      baseURL: input.webOrigin,
    });
    try {
      const page = await context.newPage();
      const prepare = createPreflightRuntimePreparation({
        source: input.source,
        page,
        databaseUrl: input.databaseUrl,
        repoRoot: input.repoRoot,
        apiUrl: input.apiUrl,
        maxRevealDepth: input.plan.limits.maxDepth,
      });
      const result = await runPlaywrightPreflightCapacitySurvey({
        source: input.source,
        plan: input.plan,
        page,
        expectedOrigin: input.webOrigin,
        prepare,
        beforeComplete: () =>
          assertLivePreflightSourceIdentity({
            source: input.source,
            repoRoot: input.repoRoot,
            expectedSourceSha: input.plan.sourceSha,
          }).then(() => undefined),
        onProgress: createCapacitySurveyProgressReporter(),
      });
      await writeCapacitySurveyResult({
        archiveRoot: input.resultRoot,
        filePath: input.resultPath,
        result,
      });
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
};

export default async function runCapacitySurveyGlobalSetup(): Promise<void> {
  const archiveRoot = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
  const sourcePath = path.resolve(requiredEnv("RUNTIME_SWEEP_SOURCE"));
  const planPath = path.resolve(
    requiredEnv("RUNTIME_SWEEP_CAPACITY_SURVEY_PLAN"),
  );
  const resultPath = path.resolve(
    requiredEnv("RUNTIME_SWEEP_CAPACITY_SURVEY_RESULT"),
  );
  const resultRoot = path.resolve(
    requiredEnv("RUNTIME_SWEEP_CAPACITY_SURVEY_RESULT_ROOT"),
  );
  const databaseUrl = requiredEnv("E2E_DATABASE_URL");
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
  const apiUrl = `http://127.0.0.1:${requiredEnv("E2E_API_PORT")}`;
  const webOrigin = `http://127.0.0.1:${requiredEnv("E2E_WEB_PORT")}`;
  const exactArchiveRoot = await ensurePreflightArchiveRoot(archiveRoot);
  await assertPreflightArchivePath(exactArchiveRoot, sourcePath);
  await assertPreflightArchivePath(exactArchiveRoot, planPath);
  const exactResultRoot = await ensurePreflightArchiveRoot(resultRoot);
  await assertPreflightArchivePath(exactResultRoot, resultPath);
  await assertAbsent(resultPath);
  const source = await readSourceArtifact(sourcePath);
  const plan = await readCapacitySurveyPlan({
    archiveRoot: exactArchiveRoot,
    filePath: planPath,
  });
  await assertLivePreflightSourceIdentity({
    source,
    repoRoot,
    expectedSourceSha: plan.sourceSha,
  });
  await runCapacitySurveyInBrowser({
    source,
    plan,
    databaseUrl,
    repoRoot,
    apiUrl,
    webOrigin,
    resultRoot: exactResultRoot,
    resultPath,
  });
}
