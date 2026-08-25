import * as path from "node:path";

import { stableSerialize } from "../../../support/ids.ts";
import type { PreflightShardJournalContext } from "../journal/preflight-shard-journal-context.ts";
import {
  preflightShardJournalPathFor,
  readPreflightShardJournal,
} from "../journal/preflight-shard-journal-io.ts";
import {
  assertExactPreflightShardArtifactPath,
  readCanonicalPreflightShardArtifact,
  writeCanonicalPreflightShardArtifact,
} from "../journal/preflight-shard-receipt-io.ts";
import {
  type PreflightShardResumePlan,
  resolvePreflightShardResume,
} from "../journal/preflight-shard-resume.ts";
import { createPreflightShardCompletion } from "./preflight-shard-completion.ts";
import {
  assertPreflightShardCompletionEqual,
  parsePreflightShardCompletion,
  type PreflightShardCompletion,
  PreflightShardCompletionError,
} from "./preflight-shard-completion-contract.ts";

export type RevalidatedPreflightShardCompletion = Readonly<{
  readonly completion: PreflightShardCompletion;
  readonly resume: PreflightShardResumePlan;
}>;

export const preflightShardCompletionPathFor = (
  context: PreflightShardJournalContext,
): string =>
  path.join(
    context.resourceProof.resources.archiveRoot,
    "shards",
    context.shard.logicalShardId,
    "attempts",
    context.resourceProof.shardAttemptId,
    "SHARD_COMPLETE.json",
  );

const assertExactPaths = (input: {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly journalPath: string;
}): void => {
  if (input.archiveRoot !== input.context.resourceProof.resources.archiveRoot)
    throw new PreflightShardCompletionError(
      "SHARD_COMPLETE archive root does not match the resource proof",
    );
  assertExactPreflightShardArtifactPath(
    input.filePath,
    preflightShardCompletionPathFor(input.context),
    "SHARD_COMPLETE path does not match the shard attempt",
  );
  assertExactPreflightShardArtifactPath(
    input.journalPath,
    preflightShardJournalPathFor(input.context),
    "SHARD_COMPLETE journal path does not match the shard attempt",
  );
};

const revalidateCompletion = async (input: {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly journalPath: string;
}): Promise<RevalidatedPreflightShardCompletion> => {
  const recordsBefore = await readPreflightShardJournal({
    context: input.context,
    archiveRoot: input.archiveRoot,
    filePath: input.journalPath,
  });
  const resume = await resolvePreflightShardResume({
    context: input.context,
    archiveRoot: input.archiveRoot,
    journalPath: input.journalPath,
  });
  const recordsAfter = await readPreflightShardJournal({
    context: input.context,
    archiveRoot: input.archiveRoot,
    filePath: input.journalPath,
  });
  if (stableSerialize(recordsBefore) !== stableSerialize(recordsAfter))
    throw new PreflightShardCompletionError(
      "SHARD_COMPLETE journal changed during revalidation",
    );
  return {
    completion: createPreflightShardCompletion({
      context: input.context,
      archiveRoot: input.archiveRoot,
      journalPath: input.journalPath,
      records: recordsAfter,
      resume,
    }),
    resume,
  };
};

export const writePreflightShardCompletion = async (input: {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly journalPath: string;
}): Promise<PreflightShardCompletion> => {
  assertExactPaths(input);
  const revalidated = await revalidateCompletion(input);
  await writeCanonicalPreflightShardArtifact({
    archiveRoot: input.archiveRoot,
    filePath: input.filePath,
    value: revalidated.completion,
  });
  const persisted = parsePreflightShardCompletion(
    await readCanonicalPreflightShardArtifact({
      archiveRoot: input.archiveRoot,
      filePath: input.filePath,
    }),
  );
  assertPreflightShardCompletionEqual({
    actual: persisted,
    expected: revalidated.completion,
  });
  return persisted;
};

export const readPreflightShardCompletion = async (input: {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly journalPath: string;
}): Promise<RevalidatedPreflightShardCompletion> => {
  assertExactPaths(input);
  const persisted = parsePreflightShardCompletion(
    await readCanonicalPreflightShardArtifact({
      archiveRoot: input.archiveRoot,
      filePath: input.filePath,
    }),
  );
  const revalidated = await revalidateCompletion(input);
  assertPreflightShardCompletionEqual({
    actual: persisted,
    expected: revalidated.completion,
  });
  return { completion: persisted, resume: revalidated.resume };
};
