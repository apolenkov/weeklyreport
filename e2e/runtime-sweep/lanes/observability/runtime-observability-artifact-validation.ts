import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { sha256DigestSchema, sourceShaSchema } from "../../source/contracts.ts";
import { stableSerialize } from "../../support/ids.ts";
import type { RuntimeLaneAssignment } from "../contracts/runtime-lane-contract.ts";
import type { RuntimeLaneRunIdentity } from "../profiles/runtime-lane-run-identity.ts";

const counterSchema = z
  .object({ digested: z.number().int(), stored: z.number().int() })
  .strict();
const bugsinkSchema = z
  .object({
    artifact: z.literal("RUNTIME_BUGSINK_RUN_EVIDENCE"),
    version: z.literal(1),
    sourceSha: sourceShaSchema,
    matrixDigest: sha256DigestSchema,
    assignmentDigest: sha256DigestSchema,
    runId: z.uuid(),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime(),
    observedAt: z.iso.datetime(),
    project: z.literal("runtime-sweep"),
    baseline: counterSchema,
    final: counterSchema,
    delta: counterSchema,
    issues: z.array(z.string()).readonly(),
    status: z.enum(["pass", "fail"]),
  })
  .strict();

export type ReadArtifact = Readonly<{
  value: unknown;
  digest: string;
}>;

const inside = (root: string, candidate: string): boolean => {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  return (
    resolvedCandidate !== resolvedRoot &&
    resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)
  );
};

export const readRegularJson = async (
  root: string,
  filePath: string,
): Promise<ReadArtifact> => {
  const [realRoot, realParent] = await Promise.all([
    realpath(root),
    realpath(path.dirname(filePath)),
  ]);
  if (!inside(realRoot, realParent) && realRoot !== realParent)
    throw new Error(
      `Runtime observability artifact escaped its root: ${filePath}`,
    );
  const handle = await open(
    filePath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const stat = await handle.stat();
    if (!stat.isFile())
      throw new Error(
        `Runtime observability artifact is not regular: ${filePath}`,
      );
    const content = await handle.readFile();
    return {
      value: JSON.parse(content.toString("utf8")),
      digest: createHash("sha256").update(content).digest("hex"),
    };
  } finally {
    await handle.close();
  }
};

export const assertObservabilityIdentity = (
  value: Readonly<{
    sourceSha: string;
    matrixDigest: string;
    assignmentDigest: string;
    runId: string;
  }>,
  assignment: RuntimeLaneAssignment,
  runId: string,
): void => {
  if (
    value.sourceSha !== assignment.sourceSha ||
    value.matrixDigest !== assignment.matrixDigest ||
    value.assignmentDigest !== assignment.assignmentDigest ||
    value.runId !== runId
  )
    throw new Error("Runtime observability identity does not match assignment");
};

export const assertRunShape = (
  run: RuntimeLaneRunIdentity,
  assignment: RuntimeLaneAssignment,
): void => {
  if (
    stableSerialize(run.laneIds) !==
      stableSerialize(assignment.lanes.map(({ laneId }) => laneId)) ||
    stableSerialize(run.profiles) !== stableSerialize(assignment.profiles)
  )
    throw new Error("Runtime run identity shape does not match assignment");
};

export const validateBugsinkEvidence = (
  value: unknown,
  assignment: RuntimeLaneAssignment,
  runId: string,
) => {
  const bugsink = bugsinkSchema.parse(value);
  assertObservabilityIdentity(bugsink, assignment, runId);
  if (
    bugsink.status !== "pass" ||
    bugsink.issues.length > 0 ||
    bugsink.delta.digested !== 0 ||
    bugsink.delta.stored !== 0 ||
    bugsink.final.digested - bugsink.baseline.digested !==
      bugsink.delta.digested ||
    bugsink.final.stored - bugsink.baseline.stored !== bugsink.delta.stored
  )
    throw new Error("Runtime Bugsink evidence is inconsistent");
  return bugsink;
};
