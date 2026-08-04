import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  appendEnvironmentCandidates,
  verifyDriverCandidates,
} from "./candidate-verification.js";
import { type CoverageCell, type Role, SEED_PROFILES } from "./contracts.js";
import {
  type DriveEnvironment,
  DriverAssignmentError,
  readAssignedCells,
} from "./driver-assignment.js";
import { renderDriverPrompt } from "./driver-prompt.js";
import { persistDriverAttempt } from "./driver-recovery.js";
import {
  type DriverValidationInput,
  mergeDriverReport,
  writeMergedDriverCells,
} from "./driver-results.js";
import {
  assertDriverShardResult,
  type DriverShardAssignment,
} from "./driver-shards.js";
import {
  type DriverStatePreparer,
  prepareDriverShardState,
} from "./driver-state-preparation.js";
import { assertEnvironmentFeedbackLive } from "./environment-feedback.js";
import {
  observeEnvironmentFeedback,
  readEnvironmentObserverConfig,
} from "./environment-observer.js";
import {
  OpenCodeDriveInterruptedError,
  parseOpenCodeDriverReport,
  runOpenCodeDrive,
} from "./opencode-runner.js";

const MAX_SESSION_TURNS = 4;
const SHARD_INDEX_WIDTH = 4;

const prepareRuntimeShardState: DriverStatePreparer = async (request) => {
  const { prisma } = await import("../integration/helpers/db.js");
  const { createPrismaRuntimeStateDatabase } =
    await import("./prisma-state-database.js");
  const { prepareRuntimeState } = await import("./state-preparation.js");
  return prepareRuntimeState(request, createPrismaRuntimeStateDatabase(prisma));
};

interface ShardDriveInput {
  readonly environment: DriveEnvironment;
  readonly template: string;
  readonly profile: (typeof SEED_PROFILES)[number];
  readonly role: Role;
  readonly shard: DriverShardAssignment;
  readonly validation: DriverValidationInput;
  readonly outputDir: string;
}

const routeDirectory = (route: string): string =>
  route
    .replaceAll(/[^a-zA-Z0-9._-]/g, "_")
    .split("_")
    .filter((part) => part.length > 0)
    .join("_") || "root";

const shardDirectory = (
  environment: DriveEnvironment,
  shard: DriverShardAssignment,
): string =>
  path.join(
    environment.archive,
    "driver",
    environment.sourceSha,
    shard.profile,
    shard.role,
    routeDirectory(shard.catalogRoute),
    `state-${routeDirectory(shard.stateId)}`,
    `shard-${String(shard.shardIndex).padStart(SHARD_INDEX_WIDTH, "0")}`,
  );

const assertCompleteCells = (
  cells: readonly CoverageCell[],
  profile: (typeof SEED_PROFILES)[number],
  role: Role,
): void => {
  const incomplete = cells.filter(({ verdict }) => verdict !== "pass");
  if (incomplete.length > 0)
    throw new DriverAssignmentError(
      `Deterministic runtime cells are incomplete for ${profile}/${role}: ${incomplete
        .map(({ cellId, verdict }) => `${cellId}=${verdict}`)
        .join(", ")}`,
    );
};

const runShard = async (input: ShardDriveInput) => {
  try {
    return await runOpenCodeDrive({
      maxTurns: MAX_SESSION_TURNS,
      prompt: renderDriverPrompt({
        template: input.template,
        role: input.role,
        profile: input.profile,
        sourceSha: input.environment.sourceSha,
        repoRoot: input.environment.repoRoot,
        baseURL: input.environment.baseURL,
        shard: input.shard,
        validation: input.validation,
      }),
      repoRoot: input.environment.repoRoot,
    });
  } catch (error) {
    if (error instanceof OpenCodeDriveInterruptedError)
      await persistDriverAttempt({
        directory: input.outputDir,
        reportText: "",
        sessionId: error.sessionId ?? "unknown",
        transcripts: error.transcripts,
        status: "interrupted",
        reportName: "interrupted-report.json",
        sessionName: "interrupted-session.json",
      });
    throw error;
  }
};

interface ProcessShardInput {
  readonly environment: DriveEnvironment;
  readonly profile: (typeof SEED_PROFILES)[number];
  readonly role: Role;
  readonly shard: DriverShardAssignment;
  readonly cells: readonly CoverageCell[];
  readonly validation: DriverValidationInput;
  readonly outputDir: string;
  readonly result: Awaited<ReturnType<typeof runOpenCodeDrive>>;
}

const processShard = async (input: ProcessShardInput): Promise<void> => {
  const reportPath = path.join(input.outputDir, "report.json");
  const reportText = `${input.result.finalText.trimEnd()}\n`;
  await persistDriverAttempt({
    directory: input.outputDir,
    reportText,
    sessionId: input.result.sessionId,
    transcripts: input.result.transcripts,
    status: "completed",
    reportName: "report.json",
    sessionName: "session.json",
  });
  const report = parseOpenCodeDriverReport(reportText, input.validation);
  assertDriverShardResult(input.shard, report);
  const feedback = await observeEnvironmentFeedback({
    report,
    transcripts: input.result.transcripts,
    ...readEnvironmentObserverConfig(input.environment.repoRoot),
  });
  await writeFile(
    path.join(input.outputDir, "environment-result.json"),
    `${JSON.stringify(feedback, null, 2)}\n`,
  );
  assertEnvironmentFeedbackLive(feedback);
  const reportWithEnvironment = appendEnvironmentCandidates(
    report,
    feedback,
    input.cells,
  );
  const verification = await verifyDriverCandidates(
    reportWithEnvironment.candidates,
    {
      sourceSha: input.environment.sourceSha,
      profile: input.profile,
      role: input.role,
      repoRoot: input.environment.repoRoot,
    },
  );
  await writeFile(
    path.join(input.outputDir, "verification.json"),
    `${JSON.stringify(verification, null, 2)}\n`,
  );
  const verifiedReport = {
    ...reportWithEnvironment,
    candidates: verification.confirmed.map(({ candidate }) => candidate),
  };
  const merged = mergeDriverReport(input.cells, verifiedReport, {
    ...input.validation,
    reportText,
    reportArchivePath: reportPath,
  });
  await writeMergedDriverCells(path.join(input.outputDir, "cells"), merged);
};

export async function driveShard(
  environment: DriveEnvironment,
  template: string,
  profile: (typeof SEED_PROFILES)[number],
  role: Role,
  shard: DriverShardAssignment,
): Promise<void> {
  const cells = await readAssignedCells(environment.archive, shard);
  assertCompleteCells(cells, profile, role);
  await prepareDriverShardState(
    environment,
    profile,
    role,
    shard,
    prepareRuntimeShardState,
  );
  const validation: DriverValidationInput = {
    sourceSha: environment.sourceSha,
    profile,
    role,
    cells,
  };
  const outputDir = shardDirectory(environment, shard);
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, "assignment.json"),
    `${JSON.stringify(shard, null, 2)}\n`,
  );
  const result = await runShard({
    environment,
    template,
    profile,
    role,
    shard,
    validation,
    outputDir,
  });
  await processShard({
    environment,
    profile,
    role,
    shard,
    cells,
    validation,
    outputDir,
    result,
  });
}
