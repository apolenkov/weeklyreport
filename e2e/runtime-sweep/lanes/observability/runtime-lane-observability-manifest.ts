import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { sha256DigestSchema, sourceShaSchema } from "../../source/contracts.ts";
import { sha256Hex } from "../../support/ids.ts";
import type {
  RuntimeLane,
  RuntimeLaneAssignment,
} from "../contracts/runtime-lane-contract.ts";
import type { RuntimeLaneRunIdentity } from "../profiles/runtime-lane-run-identity.ts";

const fileSchema = z
  .object({
    relativePath: z.string().min(1),
    digest: sha256DigestSchema,
  })
  .strict();
const bodySchema = z
  .object({
    artifact: z.literal("RUNTIME_LANE_OBSERVABILITY_COMPLETE"),
    version: z.literal(1),
    sourceSha: sourceShaSchema,
    matrixDigest: sha256DigestSchema,
    assignmentDigest: sha256DigestSchema,
    runId: z.uuid(),
    laneId: z.string().min(1),
    files: z.array(fileSchema).min(2).readonly(),
  })
  .strict();
const runtimeLaneObservabilityManifestSchema = bodySchema
  .extend({ manifestDigest: sha256DigestSchema })
  .strict();

export type RuntimeLaneObservabilityManifest = z.infer<
  typeof runtimeLaneObservabilityManifestSchema
>;

export const observabilityManifestPath = (lane: RuntimeLane): string =>
  path.join(lane.archiveRoot, "OBSERVABILITY-COMPLETE.json");

const fileDigest = async (filePath: string): Promise<string> =>
  createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");

export const observabilityRelativePaths = (
  lane: RuntimeLane,
): readonly string[] => [
  "OBSERVABILITY-READINESS.json",
  ...[...new Set(lane.groups.map(({ profile }) => profile))]
    .toSorted((left, right) => left.localeCompare(right))
    .flatMap((profile) => [
      path.join("observability", `${profile}.json`),
      path.join("observability", `${profile}-shutdown.json`),
    ]),
];

const bodyFor = (
  manifest: RuntimeLaneObservabilityManifest,
): z.infer<typeof bodySchema> => {
  const { manifestDigest: _manifestDigest, ...body } = manifest;
  return body;
};

export const parseRuntimeLaneObservabilityManifest = (
  value: unknown,
): RuntimeLaneObservabilityManifest => {
  const manifest = runtimeLaneObservabilityManifestSchema.parse(value);
  if (sha256Hex(bodyFor(manifest)) !== manifest.manifestDigest)
    throw new Error("Runtime lane observability manifest digest mismatch");
  return manifest;
};

export const writeRuntimeLaneObservabilityManifest = async (
  assignment: RuntimeLaneAssignment,
  run: RuntimeLaneRunIdentity,
  lane: RuntimeLane,
): Promise<void> => {
  const files = await Promise.all(
    observabilityRelativePaths(lane).map(async (relativePath) => ({
      relativePath,
      digest: await fileDigest(path.join(lane.archiveRoot, relativePath)),
    })),
  );
  const body = bodySchema.parse({
    artifact: "RUNTIME_LANE_OBSERVABILITY_COMPLETE",
    version: 1,
    sourceSha: assignment.sourceSha,
    matrixDigest: assignment.matrixDigest,
    assignmentDigest: assignment.assignmentDigest,
    runId: run.runId,
    laneId: lane.laneId,
    files,
  });
  const manifest = parseRuntimeLaneObservabilityManifest({
    ...body,
    manifestDigest: sha256Hex(body),
  });
  await writeFile(
    observabilityManifestPath(lane),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
};
