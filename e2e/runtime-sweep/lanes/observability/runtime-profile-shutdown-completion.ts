import path from "node:path";

import { z } from "zod";

import {
  type SeedProfile,
  seedProfileSchema,
  sha256DigestSchema,
  sourceShaSchema,
} from "../../source/contracts.ts";
import type {
  RuntimeLane,
  RuntimeLaneAssignment,
} from "../contracts/runtime-lane-contract.ts";
import {
  type RuntimeLaneRunIdentity,
  runtimeProfileServiceName,
} from "../profiles/runtime-lane-run-identity.ts";

export const runtimeProfileShutdownCompletionSchema = z
  .object({
    artifact: z.literal("RUNTIME_PROFILE_SHUTDOWN_COMPLETE"),
    version: z.literal(1),
    sourceSha: sourceShaSchema,
    matrixDigest: sha256DigestSchema,
    assignmentDigest: sha256DigestSchema,
    runId: z.uuid(),
    laneId: z.string().min(1),
    profile: seedProfileSchema,
    serviceName: z.string().min(1),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime(),
    acknowledgement: z.literal("api-drains-complete"),
  })
  .strict();

export const runtimeProfileShutdownCompletionPath = (
  lane: RuntimeLane,
  profile: SeedProfile,
): string =>
  path.join(lane.archiveRoot, "observability", `${profile}-shutdown.json`);

export const runtimeProfileShutdownCompletionEnvironment = (
  input: Readonly<{
    assignment: RuntimeLaneAssignment;
    run: RuntimeLaneRunIdentity;
    lane: RuntimeLane;
    profile: SeedProfile;
    startedAt: string;
  }>,
): string => {
  const completion = {
    artifact: "RUNTIME_PROFILE_SHUTDOWN_COMPLETE",
    version: 1,
    sourceSha: input.assignment.sourceSha,
    matrixDigest: input.assignment.matrixDigest,
    assignmentDigest: input.assignment.assignmentDigest,
    runId: input.run.runId,
    laneId: input.lane.laneId,
    profile: input.profile,
    serviceName: runtimeProfileServiceName(
      input.run,
      input.lane,
      input.profile,
    ),
    startedAt: input.startedAt,
  } as const;
  const filePath = runtimeProfileShutdownCompletionPath(
    input.lane,
    input.profile,
  );
  return JSON.stringify({ filePath, completion });
};
