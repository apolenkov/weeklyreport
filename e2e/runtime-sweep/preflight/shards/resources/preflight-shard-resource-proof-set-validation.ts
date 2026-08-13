import * as path from "node:path";

import type { SourceArtifact } from "../../../source/source-artifact.ts";
import {
  assertPreflightShardAssignmentMatchesSource,
  type PreflightShardAssignment,
} from "../preflight-shard-assignment.ts";
import {
  type PreflightShardResourceProof,
  resourceProofDonorIdSchema,
  resourceProofPathIdentity,
  resourceProofPathSchema,
} from "./preflight-shard-resource-proof-contract.ts";
import {
  assertPreflightShardResourceProofMatchesSource,
  parsePreflightShardResourceProof,
} from "./preflight-shard-resource-proof-validation.ts";

export type PreflightShardResourceProofDonorRoot = Readonly<{
  readonly donorId: string;
  readonly root: string;
}>;

export type PreflightShardResourceProofSetOptions = Readonly<{
  readonly donorRoots: readonly PreflightShardResourceProofDonorRoot[];
  readonly source?: SourceArtifact;
  readonly assignment?: PreflightShardAssignment;
}>;

export class PreflightShardResourcePlanError extends Error {
  override readonly name = "PreflightShardResourcePlanError";
}

const pathFields = (proof: PreflightShardResourceProof): readonly string[] => [
  proof.resources.nextDistDir,
  proof.resources.logDir,
  proof.resources.pdfDir,
  proof.resources.outputDir,
  proof.resources.archiveRoot,
];

export const resourceProofPathsOverlap = (
  left: string,
  right: string,
): boolean => {
  const leftIdentity = resourceProofPathIdentity(left);
  const rightIdentity = resourceProofPathIdentity(right);
  const leftRelative = path.relative(leftIdentity, rightIdentity);
  const rightRelative = path.relative(rightIdentity, leftIdentity);
  return (
    leftIdentity === rightIdentity ||
    (leftRelative !== "" &&
      !leftRelative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(leftRelative)) ||
    (rightRelative !== "" &&
      !rightRelative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(rightRelative))
  );
};

const uniqueBy = <T>(
  values: readonly T[],
  keyFor: (value: T) => string,
): boolean => new Set(values.map(keyFor)).size === values.length;

const donorRootMap = (
  roots: readonly PreflightShardResourceProofDonorRoot[],
): ReadonlyMap<string, string> => {
  if (roots.length === 0)
    throw new PreflightShardResourcePlanError(
      "At least one explicitly supplied donor root is required",
    );
  roots.forEach(({ donorId, root }) => {
    if (!resourceProofDonorIdSchema.safeParse(donorId).success)
      throw new PreflightShardResourcePlanError(
        `Invalid donor root identifier: ${donorId}`,
      );
    if (!resourceProofPathSchema.safeParse(root).success)
      throw new PreflightShardResourcePlanError(
        `Donor root must be a normalized absolute path: ${root}`,
      );
  });
  if (!uniqueBy(roots, ({ donorId }) => donorId))
    throw new PreflightShardResourcePlanError("Donor roots must be unique");
  for (const [index, donor] of roots.entries()) {
    if (
      roots
        .slice(index + 1)
        .some((other) => resourceProofPathsOverlap(donor.root, other.root))
    )
      throw new PreflightShardResourcePlanError(
        "Donor-owned roots must not be equal or nested",
      );
  }
  return new Map(roots.map(({ donorId, root }) => [donorId, root]));
};

const assertSourceAssignmentPair = (
  input: PreflightShardResourceProofSetOptions,
): void => {
  if ((input.source === undefined) !== (input.assignment === undefined))
    throw new PreflightShardResourcePlanError(
      "Source and shard assignment must be supplied together",
    );
  if (input.source !== undefined && input.assignment !== undefined)
    assertPreflightShardAssignmentMatchesSource(input.source, input.assignment);
};

const assertIdentityUniqueness = (
  proofs: readonly PreflightShardResourceProof[],
): void => {
  if (
    !uniqueBy(
      proofs,
      ({ donorId, logicalShardId, shardAttemptId }) =>
        `${donorId}\u0000${logicalShardId}\u0000${shardAttemptId}`,
    )
  )
    throw new PreflightShardResourcePlanError(
      "donorId, logicalShardId, and shardAttemptId must be unique",
    );
  if (!uniqueBy(proofs, ({ resources }) => resources.redis.runId))
    throw new PreflightShardResourcePlanError(
      "Redis runId must be globally unique",
    );
};

const assertDonorLocalResources = (
  proofs: readonly PreflightShardResourceProof[],
): void => {
  const byDonor = new Map<string, PreflightShardResourceProof[]>();
  proofs.forEach((proof) => {
    const donorProofs = byDonor.get(proof.donorId) ?? [];
    donorProofs.push(proof);
    byDonor.set(proof.donorId, donorProofs);
  });
  byDonor.forEach((donorProofs, donorId) => {
    const localKeys = [
      donorProofs.map(({ resources }) => resources.database.name),
      donorProofs.map(
        ({ resources }) => `${resources.redis.host}:${resources.redis.port}`,
      ),
      donorProofs
        .flatMap(({ resources }) => [
          resources.api.port,
          resources.web.port,
          resources.redis.port,
        ])
        .map(String),
      donorProofs.map(({ resources }) => resources.queuePrefix),
    ];
    if (localKeys.some((keys) => new Set(keys).size !== keys.length))
      throw new PreflightShardResourcePlanError(
        `Donor-local database, endpoint, port, or queue resources collide for ${donorId}`,
      );
  });
};

const assertGlobalPathResources = (
  proofs: readonly PreflightShardResourceProof[],
): void => {
  const paths = proofs.flatMap(pathFields);
  for (const [index, candidate] of paths.entries()) {
    if (
      paths
        .slice(index + 1)
        .some((other) => resourceProofPathsOverlap(candidate, other))
    )
      throw new PreflightShardResourcePlanError(
        "Filesystem resource paths must be globally unique and non-overlapping",
      );
  }
};

export const validatePreflightShardResourceProofSet = (
  proofs: readonly PreflightShardResourceProof[],
  options: PreflightShardResourceProofSetOptions,
): void => {
  if (proofs.length === 0)
    throw new PreflightShardResourcePlanError(
      "A resource-proof set must contain at least one proof",
    );
  const parsed = proofs.map((proof) => parsePreflightShardResourceProof(proof));
  const roots = donorRootMap(options.donorRoots);
  assertSourceAssignmentPair(options);
  parsed.forEach((proof) => {
    if (roots.get(proof.donorId) !== proof.donorRoot)
      throw new PreflightShardResourcePlanError(
        `Proof donor root is not the explicitly supplied root for ${proof.donorId}`,
      );
    if (options.source !== undefined && options.assignment !== undefined)
      assertPreflightShardResourceProofMatchesSource({
        source: options.source,
        assignment: options.assignment,
        proof,
      });
  });
  assertIdentityUniqueness(parsed);
  assertDonorLocalResources(parsed);
  assertGlobalPathResources(parsed);
};
