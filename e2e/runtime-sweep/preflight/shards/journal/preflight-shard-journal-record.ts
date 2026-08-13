import { sha256Hex } from "../../../support/ids.ts";
import type { PreflightShardState } from "../preflight-shard-assignment.ts";
import {
  assertPreflightShardJournalContext,
  type PreflightShardJournalContext,
} from "./preflight-shard-journal-context.ts";
import {
  parsePreflightShardJournalRecord,
  PREFLIGHT_SHARD_JOURNAL,
  PREFLIGHT_SHARD_JOURNAL_VERSION,
  PreflightShardJournalError,
  type PreflightShardJournalRecord,
  type PreflightShardJournalStatus,
} from "./preflight-shard-journal-contract.ts";

const stateFieldsFor = (state: PreflightShardState) => ({
  planIndex: state.planIndex,
  state: state.state,
  stateDigest: state.stateDigest,
  role: state.role,
  catalogRoute: state.catalogRoute,
  resolvedRoute: state.resolvedRoute,
  groupKey: state.groupKey,
});

const withDigest = (
  body: Omit<PreflightShardJournalRecord, "recordDigest">,
): PreflightShardJournalRecord =>
  parsePreflightShardJournalRecord({ ...body, recordDigest: sha256Hex(body) });

export const createPreflightShardJournalStarted = (input: {
  readonly context: PreflightShardJournalContext;
  readonly state: PreflightShardState;
  readonly attempt: number;
  readonly previousRecord?: PreflightShardJournalRecord;
}): PreflightShardJournalRecord => {
  const identity = assertPreflightShardJournalContext(input.context);
  const previous = input.previousRecord;
  return withDigest({
    artifact: PREFLIGHT_SHARD_JOURNAL,
    version: PREFLIGHT_SHARD_JOURNAL_VERSION,
    sequence: (previous?.sequence ?? 0) + 1,
    attempt: input.attempt,
    event: "started",
    status: "STARTED",
    ...identity,
    ...stateFieldsFor(input.state),
    receiptPath: null,
    receiptDigest: null,
    segmentDigest: null,
    failureSummary: null,
    previousRecordDigest: previous?.recordDigest ?? null,
  });
};

type TerminalStatus = Exclude<PreflightShardJournalStatus, "STARTED">;

export const createPreflightShardJournalTerminal = (input: {
  readonly context: PreflightShardJournalContext;
  readonly started: PreflightShardJournalRecord;
  readonly status: TerminalStatus;
  readonly receipt?: Readonly<{
    readonly path: string;
    readonly receiptDigest: string;
    readonly segmentDigest: string;
  }>;
  readonly failureSummary?: string;
}): PreflightShardJournalRecord => {
  if (input.started.event !== "started" || input.started.status !== "STARTED")
    throw new PreflightShardJournalError(
      "Terminal record requires the exact preceding STARTED record",
    );
  const identity = assertPreflightShardJournalContext(input.context);
  return withDigest({
    artifact: PREFLIGHT_SHARD_JOURNAL,
    version: PREFLIGHT_SHARD_JOURNAL_VERSION,
    sequence: input.started.sequence + 1,
    attempt: input.started.attempt,
    event: "terminal",
    status: input.status,
    ...identity,
    ...stateFieldsFor(input.started),
    receiptPath: input.receipt?.path ?? null,
    receiptDigest: input.receipt?.receiptDigest ?? null,
    segmentDigest: input.receipt?.segmentDigest ?? null,
    failureSummary: input.failureSummary ?? null,
    previousRecordDigest: input.started.recordDigest,
  });
};
