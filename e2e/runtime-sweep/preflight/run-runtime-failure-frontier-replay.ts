import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { assertE2eRuntimeDestructiveTarget } from "../../../prisma/guards/_destructive-guard.ts";
import { assertRuntimeSourceAuthorityFromEnvironment } from "../source/runtime-source-authority.ts";
import { readCapacitySurveyPlan } from "./capacity/preflight-capacity-survey-io.ts";
import { runPreflightFailureFrontierReplayChild } from "./launch/bounded/preflight-failure-frontier-replay-child.ts";
import {
  emitFailureFrontierReplayClassification,
  isFailureFrontierInvalidPacketError,
} from "./reveal/failure-frontier/preflight-reveal-failure-frontier-classification.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Failure-frontier replay requires ${name}`);
  return value;
};

const maxDurationFromEnvironment = (): number => {
  const maxDurationMs = Number(
    requiredEnv("RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_DURATION_MS"),
  );
  if (!Number.isSafeInteger(maxDurationMs) || maxDurationMs < 1)
    throw new Error(
      "RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_DURATION_MS must be a positive safe integer",
    );
  return maxDurationMs;
};

const exactPlanMaxDuration = (
  operatorMaxDurationMs: number,
  planMaxDurationMs: number,
): number => {
  if (operatorMaxDurationMs !== planMaxDurationMs)
    throw new Error(
      `RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_DURATION_MS must equal immutable plan maxDurationMs=${String(planMaxDurationMs)}`,
    );
  return planMaxDurationMs;
};

export const runRuntimeFailureFrontierReplay = async (): Promise<void> => {
  await assertRuntimeSourceAuthorityFromEnvironment();
  const databaseUrl = requiredEnv("E2E_DATABASE_URL");
  assertE2eRuntimeDestructiveTarget(
    "runtime-failure-frontier-replay-launch",
    databaseUrl,
    process.env,
  );
  const archiveRoot = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
  const planPath = path.resolve(
    requiredEnv("RUNTIME_SWEEP_CAPACITY_SURVEY_PLAN"),
  );
  const plan = await readCapacitySurveyPlan({
    archiveRoot,
    filePath: planPath,
  }).catch((error: unknown) => {
    if (!isFailureFrontierInvalidPacketError(error)) throw error;
    emitFailureFrontierReplayClassification("INVALID_PACKET");
    return undefined;
  });
  if (plan === undefined) return;
  const maxDurationMs = exactPlanMaxDuration(
    maxDurationFromEnvironment(),
    plan.limits.maxDurationMs,
  );
  await runPreflightFailureFrontierReplayChild({
    repoRoot: path.resolve(import.meta.dirname, "..", "..", ".."),
    environment: {
      ...process.env,
      RUNTIME_SWEEP_PREFLIGHT_MODE: "capacity-survey",
      RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_DURATION_MS: String(maxDurationMs),
    },
    maxDurationMs,
  });
};

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await runRuntimeFailureFrontierReplay();
