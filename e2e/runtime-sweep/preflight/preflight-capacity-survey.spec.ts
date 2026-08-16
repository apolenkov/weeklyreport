import { access, lstat } from "node:fs/promises";
import * as path from "node:path";

import { expect, test } from "@playwright/test";

import { readSourceArtifact } from "../source/source-artifact.ts";
import { assertLivePreflightSourceIdentity } from "./canary/preflight-canary.ts";
import {
  readCapacitySurveyPlan,
  writeCapacitySurveyResult,
} from "./capacity/preflight-capacity-survey-io.ts";
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

test("exact-source capacity survey reports only an exhausted reveal queue", async ({
  page,
}) => {
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
  const prepare = createPreflightRuntimePreparation({
    source,
    page,
    databaseUrl,
    repoRoot,
    apiUrl,
    maxRevealDepth: plan.limits.maxDepth,
  });
  const result = await runPlaywrightPreflightCapacitySurvey({
    source,
    plan,
    page,
    expectedOrigin: webOrigin,
    prepare,
    beforeComplete: () =>
      assertLivePreflightSourceIdentity({
        source,
        repoRoot,
        expectedSourceSha: plan.sourceSha,
      }).then(() => undefined),
  });
  await writeCapacitySurveyResult({
    archiveRoot: exactResultRoot,
    filePath: resultPath,
    result,
  });
  await expect(access(resultPath)).resolves.toBeUndefined();
});
