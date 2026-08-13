import * as path from "node:path";

import { routeForState } from "../../execution/playwright-preflight-support.ts";
import { createPreflightSegmentArtifact } from "../../journal/preflight-journal-artifact.ts";
import type { PreflightShardJournalContext } from "../journal/preflight-shard-journal-context.ts";
import type { PreflightShardJournalRecord } from "../journal/preflight-shard-journal-contract.ts";
import type { PreflightShardJournalPassRecord } from "../journal/preflight-shard-journal-contract.ts";
import { preflightShardJournalPathFor } from "../journal/preflight-shard-journal-io.ts";
import {
  createPreflightShardJournalStarted,
  createPreflightShardJournalTerminal,
} from "../journal/preflight-shard-journal-record.ts";
import {
  preflightShardSegmentPathFor,
  preflightShardStateReceiptPathFor,
} from "../journal/preflight-shard-receipt-paths.ts";
import type {
  PreflightShardResumePlan,
  RevalidatedPreflightShardPass,
} from "../journal/preflight-shard-resume.ts";
import { createPreflightShardStateReceipt } from "../journal/preflight-shard-state-receipt.ts";
import {
  createPreflightShardAssignment,
  type PreflightShardState,
} from "../preflight-shard-assignment.ts";
import { withSource } from "../preflight-shard-assignment-test-support.ts";
import { createPreflightShardResourceProof } from "../resources/preflight-shard-resource-proof-planner.ts";
import {
  defaultBrowser,
  defaultRuntime,
  resourcesFor,
} from "../resources/preflight-shard-resource-proof-test-support.ts";

const DONOR_ROOT = path.join(process.cwd(), ".shard-completion-fixture");

export type CompletionFixture = Readonly<{
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly journalPath: string;
  readonly records: readonly PreflightShardJournalRecord[];
  readonly resume: PreflightShardResumePlan;
}>;

const fixtureStatePass = (input: {
  readonly context: PreflightShardJournalContext;
  readonly state: PreflightShardState;
  readonly previous?: PreflightShardJournalRecord;
}): Readonly<{
  readonly started: PreflightShardJournalRecord;
  readonly pass: RevalidatedPreflightShardPass;
}> => {
  const started = createPreflightShardJournalStarted({
    context: input.context,
    state: input.state,
    attempt: 1,
    ...(input.previous === undefined ? {} : { previousRecord: input.previous }),
  });
  const sourceState = input.context.source.plan.states[input.state.planIndex];
  if (sourceState === undefined)
    throw new Error("fixture source state missing");
  const segment = { state: sourceState, controls: [], specialized: [] };
  const segmentArtifactPath = preflightShardSegmentPathFor({
    context: input.context,
    state: input.state,
    attempt: started.attempt,
  });
  const segmentArtifact = createPreflightSegmentArtifact({
    source: input.context.source,
    assignmentDigest: input.context.assignment.assignmentDigest,
    state: sourceState,
    route: routeForState(input.context.source, sourceState),
    segment,
  });
  const receipt = createPreflightShardStateReceipt({
    context: input.context,
    state: input.state,
    started,
    segmentArtifactPath,
    segmentArtifact,
  });
  const receiptPath = preflightShardStateReceiptPathFor({
    context: input.context,
    state: input.state,
    attempt: started.attempt,
  });
  const record = createPreflightShardJournalTerminal({
    context: input.context,
    started,
    status: "PASS",
    receipt: {
      path: receiptPath,
      receiptDigest: receipt.receiptDigest,
      segmentDigest: receipt.segmentDigest,
    },
  });
  if (
    record.event !== "terminal" ||
    record.status !== "PASS" ||
    record.receiptPath === null ||
    record.receiptDigest === null ||
    record.segmentDigest === null ||
    record.failureSummary !== null
  )
    throw new Error("fixture terminal PASS was not created");
  return {
    started,
    pass: {
      record: record as PreflightShardJournalPassRecord,
      receipt,
      segment,
    },
  };
};

export const withCompletionFixture = async <T>(
  callback: (fixture: CompletionFixture) => Promise<T> | T,
): Promise<T> =>
  withSource(async (source) => {
    const oneShard = createPreflightShardAssignment(source, 1);
    const groupCount = new Set(oneShard.states.map(({ groupKey }) => groupKey))
      .size;
    const assignment = createPreflightShardAssignment(source, groupCount);
    const shard = assignment.shards.toSorted(
      (left, right) => left.states.length - right.states.length,
    )[0];
    if (shard === undefined)
      throw new Error("completion fixture shard missing");
    const resourceProof = createPreflightShardResourceProof({
      source,
      assignment,
      shard,
      donorId: "Pro",
      donorRoot: DONOR_ROOT,
      shardAttemptId: "attempt-1",
      browser: defaultBrowser,
      runtime: defaultRuntime,
      resources: resourcesFor(DONOR_ROOT, 0),
    });
    const context = { source, assignment, shard, resourceProof };
    const records: PreflightShardJournalRecord[] = [];
    const terminalPasses = new Map<string, RevalidatedPreflightShardPass>();
    for (const state of shard.states) {
      const previous = records.at(-1);
      const evidence = fixtureStatePass({
        context,
        state,
        ...(previous === undefined ? {} : { previous: previous }),
      });
      records.push(evidence.started, evidence.pass.record);
      terminalPasses.set(state.state.stateId, evidence.pass);
    }
    const resume: PreflightShardResumePlan = {
      authorizedSkipStateIds: shard.states.map(({ state }) => state.stateId),
      rerunStateIds: [],
      interruptedStateId: null,
      terminalPasses,
    };
    return callback({
      context,
      archiveRoot: resourceProof.resources.archiveRoot,
      journalPath: preflightShardJournalPathFor(context),
      records,
      resume,
    });
  });
