import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { routeForState } from "../../execution/playwright-preflight-support.ts";
import {
  createPreflightSegmentArtifact,
  writePreflightSegmentArtifact,
} from "../../journal/preflight-journal-artifact.ts";
import { ensurePreflightArchiveRoot } from "../../preflight-archive-path.ts";
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
import type { PreflightShardJournalContext } from "./preflight-shard-journal-context.ts";
import { createPreflightShardJournalStarted } from "./preflight-shard-journal-record.ts";
import {
  preflightShardSegmentPathFor,
  preflightShardStateReceiptPathFor,
} from "./preflight-shard-receipt-paths.ts";
import {
  createPreflightShardStateReceipt,
  writePreflightShardStateReceipt,
} from "./preflight-shard-state-receipt.ts";

const TEST_SHARD_COUNT = 4;

export type ReceiptFixture = Readonly<{
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly state: PreflightShardState;
  readonly nextState: PreflightShardState;
  readonly started: ReturnType<typeof createPreflightShardJournalStarted>;
  readonly receiptPath: string;
}>;

const contextFor = (
  source: SourceArtifact,
  donorRoot: string,
): Readonly<{
  readonly context: PreflightShardJournalContext;
  readonly state: PreflightShardState;
  readonly nextState: PreflightShardState;
}> => {
  const assignment = createPreflightShardAssignment(source, TEST_SHARD_COUNT);
  const shard = assignment.shards.find(({ states }) => states.length >= 2);
  const state = shard?.states[0];
  const nextState = shard?.states[1];
  if (shard === undefined || state === undefined || nextState === undefined)
    throw new Error("receipt fixture requires two assigned states");
  const resourceProof = createPreflightShardResourceProof({
    source,
    assignment,
    shard,
    donorId: "Pro",
    donorRoot,
    shardAttemptId: "attempt-1",
    browser: defaultBrowser,
    runtime: defaultRuntime,
    resources: resourcesFor(donorRoot, 0),
  });
  return {
    context: { source, assignment, shard, resourceProof },
    state,
    nextState,
  };
};

const persistReceiptFixture = async (input: {
  readonly context: PreflightShardJournalContext;
  readonly state: PreflightShardState;
  readonly nextState: PreflightShardState;
}): Promise<ReceiptFixture> => {
  const { context, state, nextState } = input;
  const archiveRoot = context.resourceProof.resources.archiveRoot;
  await ensurePreflightArchiveRoot(archiveRoot);
  const started = createPreflightShardJournalStarted({
    context,
    state,
    attempt: 1,
  });
  const sourceState = context.source.plan.states[state.planIndex];
  if (sourceState === undefined) throw new Error("missing source state");
  const segmentArtifact = createPreflightSegmentArtifact({
    source: context.source,
    assignmentDigest: context.assignment.assignmentDigest,
    state: sourceState,
    route: routeForState(context.source, sourceState),
    segment: { state: sourceState, controls: [], specialized: [] },
  });
  const segmentArtifactPath = preflightShardSegmentPathFor({
    context,
    state,
    attempt: started.attempt,
  });
  await writePreflightSegmentArtifact({
    filePath: segmentArtifactPath,
    artifact: segmentArtifact,
    archiveRoot,
  });
  const receipt = createPreflightShardStateReceipt({
    context,
    state,
    started,
    segmentArtifactPath,
    segmentArtifact,
  });
  const receiptPath = preflightShardStateReceiptPathFor({
    context,
    state,
    attempt: started.attempt,
  });
  await writePreflightShardStateReceipt({
    context,
    archiveRoot,
    filePath: receiptPath,
    receipt,
  });
  return { context, archiveRoot, state, nextState, started, receiptPath };
};

export const withReceiptFixture = async <T>(
  callback: (fixture: ReceiptFixture) => Promise<T> | T,
): Promise<T> =>
  withSource(async (source) => {
    const donorRoot = await realpath(
      await mkdtemp(path.join(tmpdir(), "preflight-shard-receipt-")),
    );
    try {
      return await callback(
        await persistReceiptFixture(contextFor(source, donorRoot)),
      );
    } finally {
      await rm(donorRoot, { recursive: true, force: true });
    }
  });
