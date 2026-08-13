import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { preflightShardCompletionPathFor } from "../completion/preflight-shard-completion-io.ts";
import {
  preflightShardJournalPathFor,
  readPreflightShardJournal,
} from "../journal/preflight-shard-journal-io.ts";
import { createPreflightShardAssignment } from "../preflight-shard-assignment.ts";
import { withSource } from "../preflight-shard-assignment-test-support.ts";
import { createPreflightShardResourceProof } from "../resources/preflight-shard-resource-proof-planner.ts";
import {
  defaultBrowser,
  defaultRuntime,
  resourcesFor,
} from "../resources/preflight-shard-resource-proof-test-support.ts";
import type { PreflightShardRunnerInput } from "./preflight-shard-runner.ts";

const ISOLATED_SHARD_COUNT = 4;

export const segmentFor = (
  state: PreflightShardRunnerInput["context"]["source"]["plan"]["states"][number],
) => ({
  state,
  controls: [],
  specialized: [],
});

const pathsFor = (input: PreflightShardRunnerInput["context"]) => ({
  archiveRoot: input.resourceProof.resources.archiveRoot,
  journalPath: preflightShardJournalPathFor(input),
  completionPath: preflightShardCompletionPathFor(input),
});

export const inputFor = (
  context: PreflightShardRunnerInput["context"],
  overrides: Partial<
    Pick<
      PreflightShardRunnerInput,
      "assertLiveSource" | "recreateDisposableBoundary" | "runState"
    >
  > = {},
): PreflightShardRunnerInput => ({
  context,
  ...pathsFor(context),
  assertLiveSource: () => Promise.resolve(),
  recreateDisposableBoundary: () => Promise.resolve(),
  runState: ({ state }) => Promise.resolve(segmentFor(state)),
  ...overrides,
});

export const cleanupArchive = async (
  context: PreflightShardRunnerInput["context"],
): Promise<void> => {
  await rm(context.resourceProof.resources.archiveRoot, {
    recursive: true,
    force: true,
  });
};

export const withIsolatedRunnerFixture = async <T>(
  callback: (input: {
    readonly context: PreflightShardRunnerInput["context"];
    readonly archiveRoot: string;
  }) => Promise<T> | T,
): Promise<T> =>
  withSource(async (source) => {
    const isolatedRoot = await realpath(
      await mkdtemp(path.join(tmpdir(), "preflight-shard-runner-")),
    );
    try {
      const assignment = createPreflightShardAssignment(
        source,
        ISOLATED_SHARD_COUNT,
      );
      const shard = assignment.shards[0];
      if (shard === undefined) throw new Error("fixture has no first shard");
      const proof = createPreflightShardResourceProof({
        source,
        assignment,
        shard,
        donorId: "Pro",
        donorRoot: isolatedRoot,
        shardAttemptId: "attempt-1",
        browser: defaultBrowser,
        runtime: defaultRuntime,
        resources: resourcesFor(isolatedRoot, 0),
      });
      const context = { source, assignment, resourceProof: proof, shard };
      return await callback({
        context,
        archiveRoot: proof.resources.archiveRoot,
      });
    } finally {
      await rm(isolatedRoot, { recursive: true, force: true });
    }
  });

export const statusesFor = async (
  context: PreflightShardRunnerInput["context"],
): Promise<readonly string[]> =>
  (
    await readPreflightShardJournal({
      context,
      archiveRoot: context.resourceProof.resources.archiveRoot,
      filePath: preflightShardJournalPathFor(context),
    })
  ).map(({ status }) => status);
