import * as path from "node:path";

import {
  readSourceArtifact,
  type SourceArtifact,
} from "../../source/source-artifact.ts";
import {
  assertPreflightArchivePath,
  assertPreflightRegularFile,
} from "../preflight-archive-path.ts";
import { preflightShardCompletionPathFor } from "../shards/completion/preflight-shard-completion-io.ts";
import type { PreflightShardJournalContext } from "../shards/journal/preflight-shard-journal-context.ts";
import { preflightShardJournalPathFor } from "../shards/journal/preflight-shard-journal-io.ts";
import { preflightShardResourceProofPathFor } from "../shards/merge/preflight-shard-merge-assembly.ts";
import {
  assertPreflightShardAssignmentMatchesSource,
  type PreflightShard,
  type PreflightShardAssignment,
  readPreflightShardAssignment,
} from "../shards/preflight-shard-assignment.ts";
import type { PreflightShardResourceProof } from "../shards/resources/preflight-shard-resource-proof-contract.ts";
import { readPreflightShardResourceProof } from "../shards/resources/preflight-shard-resource-proof-io.ts";
import { assertPreflightShardResourceProofMatchesSource } from "../shards/resources/preflight-shard-resource-proof-validation.ts";

const SOURCE_FILE_NAME = "SOURCE.json";
const ASSIGNMENT_FILE_NAME = "PREFLIGHT_SHARD_ASSIGNMENT.json";

const requiredEnv = (environment: NodeJS.ProcessEnv, name: string): string => {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Runtime preflight shard requires ${name}`);
  return value;
};

const normalizedPath = (environment: NodeJS.ProcessEnv, name: string): string =>
  path.resolve(requiredEnv(environment, name));

const assertExactPath = (
  name: string,
  actual: string,
  expected: string,
): void => {
  if (actual !== expected)
    throw new Error(`${name} must equal its canonical shard path`);
};

const configured = (environment: NodeJS.ProcessEnv, key: string): boolean => {
  const value = environment[key];
  return value !== undefined && value.trim() !== "";
};

const assertOptionalExact = (
  environment: NodeJS.ProcessEnv,
  name: string,
  expected: string,
): void => {
  if (!configured(environment, name)) return;
  assertExactPath(name, path.resolve(requiredEnv(environment, name)), expected);
};

export type ShardSourceInputs = Readonly<{
  readonly sourcePath: string;
  readonly assignmentPath: string;
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
}>;

export type ShardProofContext = Readonly<{
  readonly resourceProofPath: string;
  readonly shard: PreflightShard;
  readonly resourceProof: PreflightShardResourceProof;
  readonly context: PreflightShardJournalContext;
  readonly journalPath: string;
  readonly completionPath: string;
}>;

const assertProofSelectors = (
  environment: NodeJS.ProcessEnv,
  proof: PreflightShardResourceProof,
): void => {
  const donorId = environment.RUNTIME_SWEEP_PREFLIGHT_SHARD_DONOR_ID?.trim();
  if (donorId !== undefined && donorId !== proof.donorId)
    throw new Error(
      "Shard donor selector does not match the persisted resource proof",
    );
  const attemptId =
    environment.RUNTIME_SWEEP_PREFLIGHT_SHARD_ATTEMPT_ID?.trim();
  if (attemptId !== undefined && attemptId !== proof.shardAttemptId)
    throw new Error(
      "Shard attempt selector does not match the persisted resource proof",
    );
  const donorRoot =
    environment.RUNTIME_SWEEP_PREFLIGHT_SHARD_DONOR_ROOT?.trim();
  if (donorRoot !== undefined && path.resolve(donorRoot) !== proof.donorRoot)
    throw new Error(
      "Shard donor-root selector does not match the persisted resource proof",
    );
};

export const readShardSourceInputs = async (input: {
  readonly environment: NodeJS.ProcessEnv;
  readonly archiveRoot: string;
}): Promise<ShardSourceInputs> => {
  const sourcePath = normalizedPath(input.environment, "RUNTIME_SWEEP_SOURCE");
  const assignmentPath = normalizedPath(
    input.environment,
    "RUNTIME_SWEEP_PREFLIGHT_SHARD_ASSIGNMENT",
  );
  assertExactPath(
    "RUNTIME_SWEEP_SOURCE",
    sourcePath,
    path.join(input.archiveRoot, SOURCE_FILE_NAME),
  );
  assertExactPath(
    "RUNTIME_SWEEP_PREFLIGHT_SHARD_ASSIGNMENT",
    assignmentPath,
    path.join(input.archiveRoot, ASSIGNMENT_FILE_NAME),
  );
  await assertPreflightArchivePath(input.archiveRoot, sourcePath);
  await assertPreflightRegularFile(sourcePath);
  await assertPreflightArchivePath(input.archiveRoot, assignmentPath);
  await assertPreflightRegularFile(assignmentPath);
  const source = await readSourceArtifact(sourcePath);
  const assignment = await readPreflightShardAssignment(assignmentPath);
  assertPreflightShardAssignmentMatchesSource(source, assignment);
  return { sourcePath, assignmentPath, source, assignment };
};

export const readShardProofContext = async (input: {
  readonly environment: NodeJS.ProcessEnv;
  readonly archiveRoot: string;
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
}): Promise<ShardProofContext> => {
  const logicalShardId = requiredEnv(
    input.environment,
    "RUNTIME_SWEEP_PREFLIGHT_SHARD_ID",
  );
  const shard = input.assignment.shards.find(
    ({ logicalShardId: candidate }) => candidate === logicalShardId,
  );
  if (shard === undefined)
    throw new Error(`Unknown logical shard id: ${logicalShardId}`);
  const resourceProofPath = normalizedPath(
    input.environment,
    "RUNTIME_SWEEP_PREFLIGHT_SHARD_RESOURCE_PROOF",
  );
  await assertPreflightArchivePath(input.archiveRoot, resourceProofPath);
  await assertPreflightRegularFile(resourceProofPath);
  const resourceProof = await readPreflightShardResourceProof(
    resourceProofPath,
    input.archiveRoot,
  );
  assertPreflightShardResourceProofMatchesSource({
    source: input.source,
    assignment: input.assignment,
    proof: resourceProof,
    selectedShard: shard,
  });
  const context: PreflightShardJournalContext = {
    source: input.source,
    assignment: input.assignment,
    shard,
    resourceProof,
  };
  assertExactPath(
    "RUNTIME_SWEEP_PREFLIGHT_SHARD_RESOURCE_PROOF",
    resourceProofPath,
    preflightShardResourceProofPathFor(context),
  );
  assertProofSelectors(input.environment, resourceProof);
  const journalPath = preflightShardJournalPathFor(context);
  const completionPath = preflightShardCompletionPathFor(context);
  assertOptionalExact(
    input.environment,
    "RUNTIME_SWEEP_PREFLIGHT_SHARD_JOURNAL",
    journalPath,
  );
  assertOptionalExact(
    input.environment,
    "RUNTIME_SWEEP_PREFLIGHT_SHARD_COMPLETION",
    completionPath,
  );
  return {
    resourceProofPath,
    shard,
    resourceProof,
    context,
    journalPath,
    completionPath,
  };
};

export { normalizedPath, requiredEnv };
