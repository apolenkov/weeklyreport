import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { buildCampaignSource } from "../../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../../manifest/manifest-fixture.ts";
import { routeForState } from "../../execution/playwright-preflight-support.ts";
import {
  createPreflightSegmentArtifact,
  writePreflightSegmentArtifact,
} from "../../journal/preflight-journal-artifact.ts";
import { ensurePreflightArchiveRoot } from "../../preflight-archive-path.ts";
import {
  preflightShardCompletionPathFor,
  writePreflightShardCompletion,
} from "../completion/preflight-shard-completion-io.ts";
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
import { createPreflightShardResourceProof } from "../resources/preflight-shard-resource-proof-planner.ts";
import {
  defaultBrowser,
  defaultRuntime,
  resourcesFor,
} from "../resources/preflight-shard-resource-proof-test-support.ts";
import type { PreflightShardCompletionReadRequest } from "./preflight-shard-merge.ts";

type CampaignSource = Awaited<ReturnType<typeof buildCampaignSource>>;

export type PersistedMergeFixture = Readonly<{
  readonly source: CampaignSource;
  readonly assignment: ReturnType<typeof createPreflightShardAssignment>;
  readonly requests: readonly PreflightShardCompletionReadRequest[];
  readonly dispose: () => Promise<void>;
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

export const createPersistedMergeFixture =
  async (): Promise<PersistedMergeFixture> => {
    const manifestFixture = await createManifestFixture();
    const donorRoot = await realpath(
      await mkdtemp(path.join(tmpdir(), "preflight-shard-merge-")),
    );
    try {
      const source = await buildCampaignSource(
        manifestFixture.input,
        fakeManifestGit(),
      );
      const oneShard = createPreflightShardAssignment(source, 1);
      const groupCount = new Set(
        oneShard.states.map(({ groupKey }) => groupKey),
      ).size;
      if (groupCount < 2)
        throw new Error("merge fixture requires at least two session groups");
      const assignment = createPreflightShardAssignment(source, 2);
      const requests: PreflightShardCompletionReadRequest[] = [];
      for (const [shardIndex, shard] of assignment.shards.entries()) {
        const resourceProof = createPreflightShardResourceProof({
          source,
          assignment,
          shard,
          donorId: "Pro",
          donorRoot,
          shardAttemptId: `attempt-${shardIndex + 1}`,
          browser: defaultBrowser,
          runtime: defaultRuntime,
          resources: resourcesFor(donorRoot, shardIndex),
        });
        const context: PreflightShardJournalContext = {
          source,
          assignment,
          shard,
          resourceProof,
        };
        const archiveRoot = resourceProof.resources.archiveRoot;
        await ensurePreflightArchiveRoot(archiveRoot);
        const journalPath = preflightShardJournalPathFor(context);
        for (const state of shard.states)
          await persistState({ context, archiveRoot, journalPath, state });
        const filePath = preflightShardCompletionPathFor(context);
        await writePreflightShardCompletion({
          context,
          archiveRoot,
          filePath,
          journalPath,
        });
        requests.push({ context, archiveRoot, filePath, journalPath });
      }
      return {
        source,
        assignment,
        requests,
        dispose: async () => {
          await rm(donorRoot, { recursive: true, force: true });
          await rm(manifestFixture.root, { recursive: true, force: true });
        },
      };
    } catch (error: unknown) {
      await rm(donorRoot, { recursive: true, force: true });
      await rm(manifestFixture.root, { recursive: true, force: true });
      throw error;
    }
  };
