import { lstat, realpath } from "node:fs/promises";
import * as path from "node:path";

import { freezeDeep } from "../../../source/manifest-source.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import {
  assertPreflightShardAssignmentMatchesSource,
  type PreflightShard,
  type PreflightShardAssignment,
} from "../preflight-shard-assignment.ts";
import {
  type PreflightShardResourceProof,
  PreflightShardResourceProofError,
  type PreflightShardResourceProofResources,
  preflightShardResourceProofSchema,
  resourceProofPathIdentity,
} from "./preflight-shard-resource-proof-contract.ts";

const resourcePaths = (resources: PreflightShardResourceProofResources) =>
  [
    resources.nextDistDir,
    resources.logDir,
    resources.pdfDir,
    resources.outputDir,
    resources.archiveRoot,
  ] as const;

export const resourceProofBodyFor = (
  proof: PreflightShardResourceProof,
): Omit<PreflightShardResourceProof, "proofDigest"> => {
  const { proofDigest: _proofDigest, ...body } = proof;
  return body;
};

const isMissing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const relativeChild = (root: string, candidate: string): string => {
  const relative = path.relative(
    resourceProofPathIdentity(root),
    resourceProofPathIdentity(candidate),
  );
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new PreflightShardResourceProofError(
      `Resource path escaped donor root: ${candidate}`,
    );
  return relative;
};

const overlaps = (left: string, right: string): boolean => {
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

export const assertResourceProofPathsWithinDonorRoot = (
  proof: PreflightShardResourceProof,
): void => {
  resourcePaths(proof.resources).forEach((resourcePath) => {
    relativeChild(proof.donorRoot, resourcePath);
  });
  const paths = resourcePaths(proof.resources);
  for (const [index, resourcePath] of paths.entries()) {
    if (
      paths
        .slice(index + 1)
        .some((otherPath) => overlaps(resourcePath, otherPath))
    )
      throw new PreflightShardResourceProofError(
        "Resource directories must be distinct and must not be ancestors of one another",
      );
  }
};

const assertLocalPorts = (proof: PreflightShardResourceProof): void => {
  const ports = [
    proof.resources.redis.port,
    proof.resources.api.port,
    proof.resources.web.port,
  ];
  if (new Set(ports).size !== ports.length)
    throw new PreflightShardResourceProofError(
      "Redis, API, and web ports must be distinct within one donor proof",
    );
};

export function parsePreflightShardResourceProof(
  value: unknown,
): PreflightShardResourceProof {
  const proof = (() => {
    try {
      return preflightShardResourceProofSchema.parse(value);
    } catch (error: unknown) {
      throw new PreflightShardResourceProofError(
        `Invalid PREFLIGHT_SHARD_RESOURCE_PROOF: ${error instanceof Error ? error.message : "invalid value"}`,
      );
    }
  })();
  if (sha256Hex(resourceProofBodyFor(proof)) !== proof.proofDigest)
    throw new PreflightShardResourceProofError(
      "PREFLIGHT_SHARD_RESOURCE_PROOF digest does not match its contents",
    );
  assertResourceProofPathsWithinDonorRoot(proof);
  assertLocalPorts(proof);
  return freezeDeep(proof);
}

const sourceIdentityChecks = (
  source: SourceArtifact,
  assignment: PreflightShardAssignment,
  proof: PreflightShardResourceProof,
): readonly (readonly [string, boolean])[] => [
  ["source SHA", proof.sourceSha === source.sourceSha],
  ["source tree", proof.sourceTree === source.sourceTree],
  ["tree digest", proof.treeDigest === source.treeDigest],
  ["source digest", proof.sourceDigest === source.sourceDigest],
  ["plan digest", proof.planDigest === source.plan.digest],
  ["assignment digest", proof.assignmentDigest === assignment.assignmentDigest],
];

export type ResourceProofMatchInput = Readonly<{
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly proof: PreflightShardResourceProof;
  readonly selectedShard?: PreflightShard;
}>;

export const assertPreflightShardResourceProofMatchesSource = (
  input: ResourceProofMatchInput,
): void => {
  const proof = parsePreflightShardResourceProof(input.proof);
  const assignment = input.assignment;
  assertPreflightShardAssignmentMatchesSource(input.source, assignment);
  const mismatch = sourceIdentityChecks(input.source, assignment, proof).find(
    ([, matches]) => !matches,
  );
  if (mismatch !== undefined)
    throw new PreflightShardResourceProofError(
      `PREFLIGHT_SHARD_RESOURCE_PROOF ${mismatch[0]} does not match current source or assignment`,
    );
  const assignmentShard = assignment.shards.find(
    ({ logicalShardId }) => logicalShardId === proof.logicalShardId,
  );
  if (assignmentShard === undefined)
    throw new PreflightShardResourceProofError(
      `PREFLIGHT_SHARD_RESOURCE_PROOF references unknown shard ${proof.logicalShardId}`,
    );
  if (
    assignmentShard.shardIndex !== proof.shardIndex ||
    assignmentShard.shardDigest !== proof.shardDigest
  )
    throw new PreflightShardResourceProofError(
      "PREFLIGHT_SHARD_RESOURCE_PROOF shard identity does not match the assignment",
    );
  if (
    input.selectedShard !== undefined &&
    stableSerialize(input.selectedShard) !== stableSerialize(assignmentShard)
  )
    throw new PreflightShardResourceProofError(
      "PREFLIGHT_SHARD_RESOURCE_PROOF selected shard differs from the assignment",
    );
};

export const assertPreflightShardResourceProofMatches =
  assertPreflightShardResourceProofMatchesSource;

const assertDonorRoot = async (root: string): Promise<void> => {
  const rootStat = await lstat(root).catch((error: unknown) => {
    if (isMissing(error))
      throw new PreflightShardResourceProofError(
        `Donor root does not exist: ${root}`,
      );
    throw error;
  });
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink())
    throw new PreflightShardResourceProofError(
      `Donor root must be a regular directory: ${root}`,
    );
  if ((await realpath(root)) !== root)
    throw new PreflightShardResourceProofError(
      `Donor root must not traverse a symlink: ${root}`,
    );
};

const assertResourceDirectory = async (segment: string): Promise<boolean> => {
  try {
    const stat = await lstat(segment);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new PreflightShardResourceProofError(
        `Resource path is not a regular directory: ${segment}`,
      );
    if ((await realpath(segment)) !== segment)
      throw new PreflightShardResourceProofError(
        `Resource path traverses a symlink: ${segment}`,
      );
    return true;
  } catch (error: unknown) {
    if (isMissing(error)) return false;
    throw error;
  }
};

const assertExistingPathSegments = async (
  root: string,
  candidate: string,
): Promise<void> => {
  await assertDonorRoot(root);
  const relative = relativeChild(root, candidate);
  const segments = relative.split(path.sep).filter(Boolean);
  for (const [index] of segments.entries()) {
    const segment = path.join(root, ...segments.slice(0, index + 1));
    if (!(await assertResourceDirectory(segment))) return;
  }
};

export const assertPreflightShardResourceProofFilesystem = async (
  proof: PreflightShardResourceProof,
): Promise<void> => {
  const parsed = parsePreflightShardResourceProof(proof);
  await Promise.all(
    resourcePaths(parsed.resources).map((resourcePath) =>
      assertExistingPathSegments(parsed.donorRoot, resourcePath),
    ),
  );
};
