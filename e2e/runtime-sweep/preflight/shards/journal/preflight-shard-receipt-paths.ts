import * as path from "node:path";

import type { PreflightShardState } from "../preflight-shard-assignment.ts";
import type { PreflightShardJournalContext } from "./preflight-shard-journal-context.ts";

const stateAttemptDirectory = (input: {
  readonly context: PreflightShardJournalContext;
  readonly state: PreflightShardState;
  readonly attempt: number;
}): string =>
  path.join(
    input.context.resourceProof.resources.archiveRoot,
    "shards",
    input.context.shard.logicalShardId,
    "attempts",
    input.context.resourceProof.shardAttemptId,
    "states",
    input.state.state.stateId,
    `attempt-${input.attempt}`,
  );

export const preflightShardSegmentPathFor = (input: {
  readonly context: PreflightShardJournalContext;
  readonly state: PreflightShardState;
  readonly attempt: number;
}): string => path.join(stateAttemptDirectory(input), "PREFLIGHT_SEGMENT.json");

export const preflightShardStateReceiptPathFor = (input: {
  readonly context: PreflightShardJournalContext;
  readonly state: PreflightShardState;
  readonly attempt: number;
}): string =>
  path.join(stateAttemptDirectory(input), "PREFLIGHT_SHARD_STATE_RECEIPT.json");
