import { sha256Hex } from "../../../support/ids.ts";
import type { PreflightShardState } from "../preflight-shard-assignment.ts";
import { withResourceProofFixture } from "../resources/preflight-shard-resource-proof-test-support.ts";
import type { PreflightShardJournalContext } from "./preflight-shard-journal-context.ts";
import type { PreflightShardJournalRecord } from "./preflight-shard-journal-contract.ts";
import {
  createPreflightShardJournalStarted,
  createPreflightShardJournalTerminal,
} from "./preflight-shard-journal-record.ts";

export const RECEIPT = Object.freeze({
  path: "/runtime-archive/receipts/state.json",
  receiptDigest: sha256Hex("receipt fixture"),
  segmentDigest: sha256Hex("segment fixture"),
});

export const withJournalContext = async <T>(
  callback: (
    context: PreflightShardJournalContext,
    states: readonly [PreflightShardState, PreflightShardState],
  ) => Promise<T> | T,
): Promise<T> =>
  withResourceProofFixture(({ source, assignment, proof, shard }) => {
    const first = shard.states[0];
    const second = shard.states[1];
    if (first === undefined || second === undefined)
      throw new Error("journal fixture requires two assigned states");
    return callback({ source, assignment, resourceProof: proof, shard }, [
      first,
      second,
    ]);
  });

export const passAttempt = (input: {
  readonly context: PreflightShardJournalContext;
  readonly state: PreflightShardState;
  readonly attempt?: number;
  readonly previousRecord?: PreflightShardJournalRecord;
}): readonly [PreflightShardJournalRecord, PreflightShardJournalRecord] => {
  const started = createPreflightShardJournalStarted({
    ...input,
    attempt: input.attempt ?? 1,
  });
  return [
    started,
    createPreflightShardJournalTerminal({
      context: input.context,
      started,
      status: "PASS",
      receipt: RECEIPT,
    }),
  ];
};

export const withRecordDigest = (
  record: PreflightShardJournalRecord,
  mutate: (
    body: Omit<PreflightShardJournalRecord, "recordDigest">,
  ) => Record<string, unknown>,
): unknown => {
  const { recordDigest: _recordDigest, ...body } = record;
  const mutated = mutate(body);
  return { ...mutated, recordDigest: sha256Hex(mutated) };
};
