import path from "node:path";

import {
  readRuntimeBugsinkBaseline,
  writeRuntimeBugsinkRunEvidence,
} from "./observability/runtime-bugsink-run-evidence.ts";
import type { RuntimeLaneAssignment } from "./runtime-lane-contract.ts";
import { prepareRuntimeLaneArchives } from "./runtime-lane-files.ts";
import { acquireRuntimeLaneLease } from "./runtime-lane-lease.ts";
import { writeRuntimeLaneObservabilityManifest } from "./runtime-lane-observability-manifest.ts";
import { runRuntimeLaneProfileProcess } from "./runtime-lane-profile-process.ts";
import { runRuntimeLaneProfiles } from "./runtime-lane-profile-run.ts";
import { assertRuntimeLaneReadiness } from "./runtime-lane-readiness.ts";
import {
  createRuntimeLaneRunIdentity,
  type RuntimeLaneRunIdentity,
  writeRuntimeLaneRunIdentity,
} from "./runtime-lane-run-identity.ts";
import { assertRuntimeLaneSource } from "./runtime-lane-source-guard.ts";
import {
  assertRuntimeObservabilityReadiness,
  readRuntimeObservabilityConfig,
  type RuntimeObservabilityConfig,
  writeRuntimeObservabilityReadiness,
} from "./runtime-observability-readiness.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

const redisRunIdFor = (
  redisRunIds: ReadonlyMap<string, string>,
  laneId: string,
): string => {
  const runId = redisRunIds.get(laneId);
  if (runId === undefined)
    throw new Error(`Runtime lane ${laneId} Redis identity is missing`);
  return runId;
};

const executeAssignedLanes = (
  input: Readonly<{
    readonly assignmentPath: string;
    readonly assignment: RuntimeLaneAssignment;
    readonly baseDatabaseUrl: string;
    readonly redisRunIds: ReadonlyMap<string, string>;
    readonly observability: RuntimeObservabilityConfig;
    readonly run: RuntimeLaneRunIdentity;
  }>,
): Promise<readonly PromiseSettledResult<void>[]> => {
  const execution = new AbortController();
  return Promise.allSettled(
    input.assignment.lanes
      .filter(({ groups }) => groups.length > 0)
      .map((lane) =>
        runRuntimeLaneProfiles({
          lane,
          assignment: input.assignment,
          run: input.run,
          observability: input.observability,
          abort: execution.signal,
          execute: (profile, startedAt) =>
            runRuntimeLaneProfileProcess({
              assignmentPath: input.assignmentPath,
              assignment: input.assignment,
              run: input.run,
              lane,
              profile,
              startedAt,
              baseDatabaseUrl: input.baseDatabaseUrl,
              expectedRedisRunId: redisRunIdFor(input.redisRunIds, lane.laneId),
              observability: input.observability,
              abort: execution.signal,
            }),
        })
          .then(() =>
            writeRuntimeLaneObservabilityManifest(
              input.assignment,
              input.run,
              lane,
            ),
          )
          .catch((error: unknown) => {
            execution.abort(error);
            throw error;
          }),
      ),
  );
};

export async function runRuntimeLanes(
  input: Readonly<{
    readonly assignmentPath: string;
    readonly assignment: RuntimeLaneAssignment;
    readonly baseDatabaseUrl: string;
  }>,
): Promise<void> {
  await assertRuntimeLaneSource({
    repoRoot: REPO_ROOT,
    sourceSha: input.assignment.sourceSha,
  });
  const observability = readRuntimeObservabilityConfig();
  const lease = await acquireRuntimeLaneLease(input.assignmentPath);
  try {
    const run = createRuntimeLaneRunIdentity(input.assignment);
    await writeRuntimeLaneRunIdentity(input.assignment, run);
    const observerReadiness =
      await assertRuntimeObservabilityReadiness(observability);
    const bugsinkBaseline = await readRuntimeBugsinkBaseline(observability);
    const redisRunIds = await assertRuntimeLaneReadiness({
      assignment: input.assignment,
      baseDatabaseUrl: input.baseDatabaseUrl,
    });
    await prepareRuntimeLaneArchives(input.assignment);
    await writeRuntimeObservabilityReadiness(
      input.assignment,
      run,
      observerReadiness,
    );
    const runStartedAt = run.startedAt;
    const outcomes = await executeAssignedLanes({
      assignmentPath: input.assignmentPath,
      assignment: input.assignment,
      baseDatabaseUrl: input.baseDatabaseUrl,
      redisRunIds,
      observability,
      run,
    });
    const failure = outcomes.find(
      (outcome): outcome is PromiseRejectedResult =>
        outcome.status === "rejected",
    );
    const runEndedAt = new Date().toISOString();
    const [bugsinkEvidence] = await Promise.allSettled([
      writeRuntimeBugsinkRunEvidence({
        assignment: input.assignment,
        run,
        observability,
        baseline: bugsinkBaseline,
        startedAt: runStartedAt,
        endedAt: runEndedAt,
      }),
    ]);
    if (failure !== undefined) {
      const reason: unknown = failure.reason;
      throw reason instanceof Error ? reason : new Error(String(reason));
    }
    if (bugsinkEvidence.status === "rejected") throw bugsinkEvidence.reason;
  } finally {
    await lease.release();
  }
}
