import path from "node:path";

import { sha256Hex, stableSerialize } from "../../support/ids.ts";
import type { RuntimeLaneAssignment } from "../contracts/runtime-lane-contract.ts";
import {
  runtimeLaneRunIdentitySchema,
  runtimeLaneRunPath,
} from "../profiles/runtime-lane-run-identity.ts";
import {
  observabilityManifestPath,
  observabilityRelativePaths,
  parseRuntimeLaneObservabilityManifest,
} from "./runtime-lane-observability-manifest.ts";
import {
  assertObservabilityIdentity,
  assertRunShape,
  type ReadArtifact,
  readRegularJson,
  validateBugsinkEvidence,
} from "./runtime-observability-artifact-validation.ts";
import { runtimeObservabilityReadinessReportSchema } from "./runtime-observability-readiness.ts";
import {
  readRuntimeObservabilityConfig,
  type RuntimeObservabilityConfig,
} from "./runtime-observability-readiness.ts";
import {
  runtimeObservabilityTimestamp,
  validateRuntimeProfileObservabilityReport,
} from "./runtime-profile-observability-validation.ts";
import {
  runtimeProfileShutdownCompletionPath,
  runtimeProfileShutdownCompletionSchema,
} from "./runtime-profile-shutdown-completion.ts";

type VerifiedArtifact = Readonly<{
  relativePath: string;
  artifact: ReadArtifact;
}>;

const verifyProfile = async (
  assignment: RuntimeLaneAssignment,
  runId: string,
  lane: RuntimeLaneAssignment["lanes"][number],
  profile: RuntimeLaneAssignment["profiles"][number],
  runWindow: Readonly<{ startedAt: string; endedAt: string }>,
  observability: RuntimeObservabilityConfig,
  fetcher: typeof fetch,
): Promise<readonly VerifiedArtifact[]> => {
  const relativePath = path.join("observability", `${profile}.json`);
  const artifact = await readRegularJson(
    lane.archiveRoot,
    path.join(lane.archiveRoot, relativePath),
  );
  const validated = await validateRuntimeProfileObservabilityReport(
    artifact.value,
    { assignment, runId, lane, profile, runWindow, observability, fetcher },
  );
  const { report } = validated;
  const expectedService = `customreport-api-runtime-${runId}-${lane.laneId}-${profile}`;
  const shutdownRelativePath = path.join(
    "observability",
    `${profile}-shutdown.json`,
  );
  const shutdownArtifact = await readRegularJson(
    lane.archiveRoot,
    runtimeProfileShutdownCompletionPath(lane, profile),
  );
  const shutdown = runtimeProfileShutdownCompletionSchema.parse(
    shutdownArtifact.value,
  );
  assertObservabilityIdentity(shutdown, assignment, runId);
  const completed = runtimeObservabilityTimestamp(shutdown.completedAt);
  if (
    shutdown.laneId !== lane.laneId ||
    shutdown.profile !== profile ||
    shutdown.serviceName !== expectedService ||
    shutdown.startedAt !== report.startedAt ||
    completed < runtimeObservabilityTimestamp(validated.shutdownMarkerAt) ||
    completed < runtimeObservabilityTimestamp(report.startedAt) ||
    completed > runtimeObservabilityTimestamp(report.endedAt)
  )
    throw new Error(
      `Runtime shutdown completion is inconsistent for ${lane.laneId}/${profile}`,
    );
  return [
    { relativePath, artifact },
    { relativePath: shutdownRelativePath, artifact: shutdownArtifact },
  ];
};

const verifyLane = async (
  assignment: RuntimeLaneAssignment,
  runId: string,
  lane: RuntimeLaneAssignment["lanes"][number],
  runWindow: Readonly<{ startedAt: string; endedAt: string }>,
  observability: RuntimeObservabilityConfig,
  fetcher: typeof fetch,
): Promise<readonly ReadArtifact[]> => {
  const readinessArtifact = await readRegularJson(
    lane.archiveRoot,
    path.join(lane.archiveRoot, "OBSERVABILITY-READINESS.json"),
  );
  const readiness = runtimeObservabilityReadinessReportSchema.parse(
    readinessArtifact.value,
  );
  assertObservabilityIdentity(readiness, assignment, runId);
  if (readiness.laneId !== lane.laneId)
    throw new Error(`Runtime readiness lane mismatch for ${lane.laneId}`);
  const profiles = [...new Set(lane.groups.map(({ profile }) => profile))];
  const profileArtifacts = await Promise.all(
    profiles.map((profile) =>
      verifyProfile(
        assignment,
        runId,
        lane,
        profile,
        runWindow,
        observability,
        fetcher,
      ),
    ),
  );
  const manifestArtifact = await readRegularJson(
    lane.archiveRoot,
    observabilityManifestPath(lane),
  );
  const manifest = parseRuntimeLaneObservabilityManifest(
    manifestArtifact.value,
  );
  assertObservabilityIdentity(manifest, assignment, runId);
  const expectedPaths = observabilityRelativePaths(lane);
  if (
    manifest.laneId !== lane.laneId ||
    stableSerialize(manifest.files.map(({ relativePath }) => relativePath)) !==
      stableSerialize(expectedPaths)
  )
    throw new Error(
      `Runtime observability manifest mismatch for ${lane.laneId}`,
    );
  const artifacts = [
    {
      relativePath: "OBSERVABILITY-READINESS.json",
      artifact: readinessArtifact,
    },
    ...profileArtifacts.flat(),
  ];
  const artifactsByPath = new Map(
    artifacts.map(({ relativePath, artifact }) => [relativePath, artifact]),
  );
  if (
    manifest.files.some(
      ({ relativePath, digest }) =>
        digest !== artifactsByPath.get(relativePath)?.digest,
    )
  )
    throw new Error(
      `Runtime observability file digest mismatch for ${lane.laneId}`,
    );
  return [...artifacts.map(({ artifact }) => artifact), manifestArtifact];
};

export async function verifyRuntimeLaneObservability(
  assignment: RuntimeLaneAssignment,
  dependencies: Readonly<{
    observability?: RuntimeObservabilityConfig;
    fetcher?: typeof fetch;
  }> = {},
): Promise<Readonly<{ runId: string; digest: string }>> {
  const observability =
    dependencies.observability ?? readRuntimeObservabilityConfig();
  const fetcher = dependencies.fetcher ?? fetch;
  const runArtifact = await readRegularJson(
    assignment.sourceArchiveRoot,
    runtimeLaneRunPath(assignment),
  );
  const run = runtimeLaneRunIdentitySchema.parse(runArtifact.value);
  assertObservabilityIdentity(run, assignment, run.runId);
  assertRunShape(run, assignment);
  const bugsinkArtifact = await readRegularJson(
    assignment.sourceArchiveRoot,
    path.join(
      assignment.sourceArchiveRoot,
      `OBSERVABILITY-BUGSINK-${assignment.assignmentDigest}.json`,
    ),
  );
  const bugsink = validateBugsinkEvidence(
    bugsinkArtifact.value,
    assignment,
    run.runId,
  );
  const laneArtifacts = await Promise.all(
    assignment.lanes.map((lane) =>
      verifyLane(
        assignment,
        run.runId,
        lane,
        {
          startedAt: run.startedAt,
          endedAt: bugsink.endedAt,
        },
        observability,
        fetcher,
      ),
    ),
  );
  const digests = [
    runArtifact.digest,
    bugsinkArtifact.digest,
    ...laneArtifacts.flat().map(({ digest }) => digest),
  ];
  return { runId: run.runId, digest: sha256Hex(digests) };
}
