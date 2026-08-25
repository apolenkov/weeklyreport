import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { routeForState } from "../../execution/playwright-preflight-support.ts";
import {
  createPreflightSegmentArtifact,
  writePreflightSegmentArtifact,
} from "../../journal/preflight-journal-artifact.ts";
import { ensurePreflightArchiveRoot } from "../../preflight-archive-path.ts";
import type { PreflightShardJournalContext } from "../journal/preflight-shard-journal-context.ts";
import {
  appendPreflightShardJournalStarted,
  appendPreflightShardJournalTerminal,
  preflightShardJournalPathFor,
} from "../journal/preflight-shard-journal-io.ts";
import {
  preflightShardSegmentPathFor,
  preflightShardStateReceiptPathFor,
} from "../journal/preflight-shard-receipt-paths.ts";
import {
  createPreflightShardStateReceipt,
  writePreflightShardStateReceipt,
} from "../journal/preflight-shard-state-receipt.ts";
import { createPreflightShardAssignment } from "../preflight-shard-assignment.ts";
import { withSource } from "../preflight-shard-assignment-test-support.ts";
import { createPreflightShardResourceProof } from "../resources/preflight-shard-resource-proof-planner.ts";
import {
  defaultBrowser,
  defaultRuntime,
  resourcesFor,
} from "../resources/preflight-shard-resource-proof-test-support.ts";
import { preflightShardCompletionPathFor } from "./preflight-shard-completion-io.ts";

export type PersistedCompletionFixture = Readonly<{
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly journalPath: string;
  readonly completionPath: string;
}>;

const persistState = async (input: {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly journalPath: string;
  readonly state: PreflightShardJournalContext["shard"]["states"][number];
}): Promise<void> => {
  const started = await appendPreflightShardJournalStarted({
    context: input.context,
    archiveRoot: input.archiveRoot,
    filePath: input.journalPath,
    state: input.state,
  });
  const segmentArtifact = createPreflightSegmentArtifact({
    source: input.context.source,
    assignmentDigest: input.context.assignment.assignmentDigest,
    state: input.state.state,
    route: routeForState(input.context.source, input.state.state),
    segment: { state: input.state.state, controls: [], specialized: [] },
  });
  const segmentArtifactPath = preflightShardSegmentPathFor({
    context: input.context,
    state: input.state,
    attempt: started.attempt,
  });
  await writePreflightSegmentArtifact({
    filePath: segmentArtifactPath,
    artifact: segmentArtifact,
    archiveRoot: input.archiveRoot,
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
  await writePreflightShardStateReceipt({
    context: input.context,
    archiveRoot: input.archiveRoot,
    filePath: receiptPath,
    receipt,
  });
  await appendPreflightShardJournalTerminal({
    context: input.context,
    archiveRoot: input.archiveRoot,
    filePath: input.journalPath,
    status: "PASS",
    receiptPath,
  });
};

export const withPersistedCompletionFixture = async <T>(
  callback: (fixture: PersistedCompletionFixture) => Promise<T> | T,
): Promise<T> =>
  withSource(async (source) => {
    const donorRoot = await realpath(
      await mkdtemp(path.join(tmpdir(), "preflight-shard-completion-")),
    );
    try {
      const oneShard = createPreflightShardAssignment(source, 1);
      const groupCount = new Set(
        oneShard.states.map(({ groupKey }) => groupKey),
      ).size;
      const assignment = createPreflightShardAssignment(source, groupCount);
      const shard = assignment.shards.find(({ states }) => states.length >= 2);
      if (shard === undefined)
        throw new Error("persisted completion fixture requires two states");
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
      const context = { source, assignment, shard, resourceProof };
      const archiveRoot = resourceProof.resources.archiveRoot;
      await ensurePreflightArchiveRoot(archiveRoot);
      const journalPath = preflightShardJournalPathFor(context);
      for (const state of shard.states)
        await persistState({ context, archiveRoot, journalPath, state });
      return await callback({
        context,
        archiveRoot,
        journalPath,
        completionPath: preflightShardCompletionPathFor(context),
      });
    } finally {
      await rm(donorRoot, { recursive: true, force: true });
    }
  });
