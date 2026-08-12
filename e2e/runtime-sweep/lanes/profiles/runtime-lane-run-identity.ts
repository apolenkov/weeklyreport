import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  seedProfileSchema,
  sha256DigestSchema,
  sourceShaSchema,
} from "../../source/contracts.ts";
import type {
  RuntimeLane,
  RuntimeLaneAssignment,
} from "../contracts/runtime-lane-contract.ts";

export const runtimeLaneRunIdentitySchema = z
  .object({
    artifact: z.literal("RUNTIME_LANE_RUN"),
    version: z.literal(1),
    sourceSha: sourceShaSchema,
    matrixDigest: sha256DigestSchema,
    assignmentDigest: sha256DigestSchema,
    runId: z.uuid(),
    startedAt: z.iso.datetime(),
    laneIds: z.array(z.string().min(1)).min(1).readonly(),
    profiles: z.array(seedProfileSchema).min(1).readonly(),
  })
  .strict();

export type RuntimeLaneRunIdentity = z.infer<
  typeof runtimeLaneRunIdentitySchema
>;

export const runtimeLaneRunPath = (assignment: RuntimeLaneAssignment): string =>
  path.join(
    assignment.sourceArchiveRoot,
    `RUNTIME-RUN-${assignment.assignmentDigest}.json`,
  );

export const createRuntimeLaneRunIdentity = (
  assignment: RuntimeLaneAssignment,
): RuntimeLaneRunIdentity =>
  runtimeLaneRunIdentitySchema.parse({
    artifact: "RUNTIME_LANE_RUN",
    version: 1,
    sourceSha: assignment.sourceSha,
    matrixDigest: assignment.matrixDigest,
    assignmentDigest: assignment.assignmentDigest,
    runId: randomUUID(),
    startedAt: new Date().toISOString(),
    laneIds: assignment.lanes.map(({ laneId }) => laneId),
    profiles: assignment.profiles,
  });

export const writeRuntimeLaneRunIdentity = async (
  assignment: RuntimeLaneAssignment,
  run: RuntimeLaneRunIdentity,
): Promise<void> => {
  await writeFile(
    runtimeLaneRunPath(assignment),
    `${JSON.stringify(run, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
};

export const runtimeProfileServiceName = (
  run: RuntimeLaneRunIdentity,
  lane: RuntimeLane,
  profile: string,
): string => `customreport-api-runtime-${run.runId}-${lane.laneId}-${profile}`;
