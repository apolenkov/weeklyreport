import type { MatrixPreflightSegment } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import { freezeDeep } from "../../../source/manifest-source.ts";
import type { PreflightShardState } from "../preflight-shard-assignment.ts";
import type { PreflightShardJournalContext } from "./preflight-shard-journal-context.ts";
import {
  PreflightShardJournalError,
  type PreflightShardJournalPassRecord,
  type PreflightShardJournalRecord,
} from "./preflight-shard-journal-contract.ts";
import { readPreflightShardJournal } from "./preflight-shard-journal-io.ts";
import {
  type PreflightShardJournalValidation,
  resolvePreflightShardJournalCandidates,
  validatePreflightShardJournal,
} from "./preflight-shard-journal-validation.ts";
import type { PreflightShardStateReceipt } from "./preflight-shard-receipt-contract.ts";
import { readPreflightShardStateReceipt } from "./preflight-shard-state-receipt.ts";

export type RevalidatedPreflightShardPass = Readonly<{
  readonly record: PreflightShardJournalPassRecord;
  readonly receipt: PreflightShardStateReceipt;
  readonly segment: MatrixPreflightSegment;
}>;

export type PreflightShardResumePlan = Readonly<{
  readonly authorizedSkipStateIds: readonly string[];
  readonly rerunStateIds: readonly string[];
  readonly interruptedStateId: string | null;
  readonly terminalPasses: ReadonlyMap<string, RevalidatedPreflightShardPass>;
}>;

const passRecordFor = (input: {
  readonly state: PreflightShardState;
  readonly validation: PreflightShardJournalValidation;
}): PreflightShardJournalPassRecord => {
  const record = input.validation.candidatePassRecords.get(
    input.state.state.stateId,
  );
  if (record === undefined)
    throw new PreflightShardJournalError(
      `Missing candidate PASS for ${input.state.state.stateId}`,
    );
  return record;
};

const startedForPass = (
  records: readonly PreflightShardJournalRecord[],
  pass: PreflightShardJournalPassRecord,
): PreflightShardJournalRecord => {
  const passIndex = records.findIndex(
    ({ recordDigest }) => recordDigest === pass.recordDigest,
  );
  const started = records[passIndex - 1];
  if (
    started?.event !== "started" ||
    started.status !== "STARTED" ||
    started.recordDigest !== pass.previousRecordDigest
  )
    throw new PreflightShardJournalError(
      `Candidate PASS ${pass.recordDigest} has no exact preceding STARTED`,
    );
  return started;
};

export const resolvePreflightShardResume = async (input: {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly journalPath: string;
  readonly records?: readonly PreflightShardJournalRecord[];
}): Promise<PreflightShardResumePlan> => {
  const records =
    input.records ??
    (await readPreflightShardJournal({
      context: input.context,
      archiveRoot: input.archiveRoot,
      filePath: input.journalPath,
    }));
  const validation = validatePreflightShardJournal({
    context: input.context,
    records,
  });
  const candidates = resolvePreflightShardJournalCandidates({
    context: input.context,
    records,
  });
  const terminalPasses = new Map<string, RevalidatedPreflightShardPass>();
  for (const stateId of candidates.candidatePassStateIds) {
    const state = input.context.shard.states.find(
      ({ state: candidate }) => candidate.stateId === stateId,
    );
    if (state === undefined)
      throw new PreflightShardJournalError(
        `Candidate PASS references unassigned state ${stateId}`,
      );
    const pass = passRecordFor({ state, validation });
    const started = startedForPass(records, pass);
    const revalidated = await readPreflightShardStateReceipt({
      context: input.context,
      archiveRoot: input.archiveRoot,
      filePath: pass.receiptPath,
      state,
      started,
    });
    if (
      pass.receiptDigest !== revalidated.receipt.receiptDigest ||
      pass.segmentDigest !== revalidated.receipt.segmentDigest
    )
      throw new PreflightShardJournalError(
        `Candidate PASS does not match receipt ${stateId}`,
      );
    terminalPasses.set(stateId, {
      record: pass,
      receipt: revalidated.receipt,
      segment: revalidated.segment,
    });
  }
  return freezeDeep({
    authorizedSkipStateIds: candidates.candidatePassStateIds,
    rerunStateIds: candidates.rerunStateIds,
    interruptedStateId: candidates.interruptedStateId,
    terminalPasses,
  });
};
