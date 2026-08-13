import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import {
  assertPreflightShardJournalContext,
  type PreflightShardJournalContext,
} from "../journal/preflight-shard-journal-context.ts";
import type {
  PreflightShardJournalIdentity,
  PreflightShardJournalRecord,
} from "../journal/preflight-shard-journal-contract.ts";
import { preflightShardJournalPathFor } from "../journal/preflight-shard-journal-io.ts";
import {
  type PreflightShardJournalValidation,
  validatePreflightShardJournal,
} from "../journal/preflight-shard-journal-validation.ts";
import type { PreflightShardResumePlan } from "../journal/preflight-shard-resume.ts";
import type { PreflightShardState } from "../preflight-shard-assignment.ts";
import {
  parsePreflightShardCompletion,
  PREFLIGHT_SHARD_COMPLETE_ARTIFACT,
  PREFLIGHT_SHARD_COMPLETE_VERSION,
  type PreflightShardCompletion,
  PreflightShardCompletionError,
} from "./preflight-shard-completion-contract.ts";

const assertCompleteResume = (input: {
  readonly context: PreflightShardJournalContext;
  readonly resume: PreflightShardResumePlan;
}): void => {
  const expected = input.context.shard.states.map(({ state }) => state.stateId);
  if (
    stableSerialize(input.resume.authorizedSkipStateIds) !==
      stableSerialize(expected) ||
    input.resume.rerunStateIds.length > 0 ||
    input.resume.interruptedStateId !== null ||
    input.resume.terminalPasses.size !== expected.length
  )
    throw new PreflightShardCompletionError(
      "SHARD_COMPLETE requires every assigned state to have a revalidated terminal PASS",
    );
};

const stateEvidenceFor = (input: {
  readonly state: PreflightShardState;
  readonly identity: PreflightShardJournalIdentity;
  readonly validation: PreflightShardJournalValidation;
  readonly resume: PreflightShardResumePlan;
}) => {
  const stateId = input.state.state.stateId;
  const pass = input.resume.terminalPasses.get(stateId);
  const validatedPass = input.validation.candidatePassRecords.get(stateId);
  if (
    pass === undefined ||
    validatedPass === undefined ||
    stableSerialize(pass.record) !== stableSerialize(validatedPass) ||
    pass.record.receiptDigest !== pass.receipt.receiptDigest ||
    pass.record.segmentDigest !== pass.receipt.segmentDigest
  )
    throw new PreflightShardCompletionError(
      `SHARD_COMPLETE journal does not contain exact terminal evidence for ${stateId}`,
    );
  return {
    stateId,
    planIndex: input.state.planIndex,
    stateDigest: input.state.stateDigest,
    groupKey: input.state.groupKey,
    logicalShardId: input.identity.logicalShardId,
    shardAttemptId: input.identity.shardAttemptId,
    resourceProofDigest: input.identity.resourceProofDigest,
    receiptPath: pass.record.receiptPath,
    receiptDigest: pass.receipt.receiptDigest,
    startedRecordDigest: pass.receipt.startedRecordDigest,
    segmentArtifactPath: pass.receipt.segmentArtifactPath,
    segmentArtifactDigest: pass.receipt.segmentArtifactDigest,
    segmentDigest: pass.receipt.segmentDigest,
    stateAttempt: pass.receipt.stateAttempt,
    terminalPassRecordDigest: pass.record.recordDigest,
  };
};

export const createPreflightShardCompletion = (input: {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly journalPath: string;
  readonly records: readonly PreflightShardJournalRecord[];
  readonly resume: PreflightShardResumePlan;
}): PreflightShardCompletion => {
  const identity = assertPreflightShardJournalContext(input.context);
  if (input.archiveRoot !== input.context.resourceProof.resources.archiveRoot)
    throw new PreflightShardCompletionError(
      "SHARD_COMPLETE archive root does not match its resource proof",
    );
  if (input.journalPath !== preflightShardJournalPathFor(input.context))
    throw new PreflightShardCompletionError(
      "SHARD_COMPLETE journal path is not canonical for the shard attempt",
    );
  const validation = validatePreflightShardJournal({
    context: input.context,
    records: input.records,
  });
  assertCompleteResume({ context: input.context, resume: input.resume });
  const tail = validation.records.at(-1);
  if (tail === undefined)
    throw new PreflightShardCompletionError(
      "SHARD_COMPLETE requires a non-empty persisted journal",
    );
  const stateEvidence = input.context.shard.states.map((state) =>
    stateEvidenceFor({
      state,
      identity,
      validation,
      resume: input.resume,
    }),
  );
  const body = {
    artifact: PREFLIGHT_SHARD_COMPLETE_ARTIFACT,
    version: PREFLIGHT_SHARD_COMPLETE_VERSION,
    ...identity,
    assignedStateIds: input.context.shard.states.map(
      ({ state }) => state.stateId,
    ),
    assignedStateDigests: input.context.shard.states.map(
      ({ stateDigest }) => stateDigest,
    ),
    archiveRoot: input.archiveRoot,
    journalPath: input.journalPath,
    journalRecordCount: validation.records.length,
    journalTailDigest: tail.recordDigest,
    stateEvidence,
  } as const;
  return parsePreflightShardCompletion({
    ...body,
    completionDigest: sha256Hex(body),
  });
};
