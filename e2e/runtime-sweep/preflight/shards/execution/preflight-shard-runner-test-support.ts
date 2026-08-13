import { rm } from "node:fs/promises";

import { preflightShardCompletionPathFor } from "../completion/preflight-shard-completion-io.ts";
import {
  preflightShardJournalPathFor,
  readPreflightShardJournal,
} from "../journal/preflight-shard-journal-io.ts";
import { withResourceProofFixture } from "../resources/preflight-shard-resource-proof-test-support.ts";
import type { PreflightShardRunnerInput } from "./preflight-shard-runner.ts";

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

export const withRunnerFixture = async <T>(
  callback: (input: {
    readonly context: PreflightShardRunnerInput["context"];
    readonly archiveRoot: string;
  }) => Promise<T> | T,
): Promise<T> =>
  withResourceProofFixture(async ({ source, assignment, proof, shard }) => {
    const context = { source, assignment, resourceProof: proof, shard };
    try {
      return await callback({
        context,
        archiveRoot: proof.resources.archiveRoot,
      });
    } finally {
      await cleanupArchive(context);
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
