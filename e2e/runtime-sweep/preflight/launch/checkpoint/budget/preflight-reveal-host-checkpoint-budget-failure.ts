import { link, unlink } from "node:fs/promises";
import * as path from "node:path";

import {
  assertLivePreflightSourceIdentity,
  createPreflightCanaryBudgetFailure,
  readPreflightCanaryArtifact,
  writePreflightCanaryArtifact,
} from "../../../canary/preflight-canary.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveRoot,
} from "../../../preflight-archive-path.ts";
import { R188_ZERO_DIGEST } from "../../../reveal/continuation/preflight-reveal-continuation-digests.ts";
import { RevealContinuationBudgetError } from "../../continuation/preflight-reveal-continuation-budget-error.ts";
import { assertRevealContinuationInitialProgress } from "../../continuation/preflight-reveal-continuation-initial-progress.ts";
import type {
  ParentContext,
  ParentProgress,
} from "../../continuation/preflight-reveal-continuation-parent.ts";
import { assertSealedContinuationGrant } from "../../continuation/preflight-reveal-continuation-parent-child.ts";
import { publishDeadlineBound } from "../../preflight-deadline-publication.ts";

const stagedPathFor = (context: ParentContext): string =>
  path.join(
    path.dirname(context.canaryPath),
    `.${path.basename(context.canaryPath)}.${context.attemptId}.pending`,
  );

const unlinkIfPresent = async (filePath: string): Promise<void> => {
  try {
    await unlink(filePath);
  } catch (error: unknown) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }
};

export const isPublishableRevealContinuationBudgetError = (
  error: unknown,
): error is RevealContinuationBudgetError =>
  error instanceof RevealContinuationBudgetError &&
  Number.isFinite(error.remainingMs) &&
  Number.isFinite(error.requiredMs) &&
  error.remainingMs < error.requiredMs;

const budgetFailureCanaryFor = (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly ordinal: number;
  readonly error: RevealContinuationBudgetError;
}) => {
  const requiredChildWindowMs: number = input.error.requiredMs;
  const frontier = input.progress.grant?.frontier ?? null;
  const checkpointDigest = input.progress.previousCheckpointDigest ?? null;
  return createPreflightCanaryBudgetFailure({
    source: input.context.source,
    selection: input.context.selection,
    attemptId: input.context.attemptId,
    nextChildOrdinal: input.ordinal,
    lastCheckpointDigest: checkpointDigest,
    lastCheckpointSequence: checkpointDigest === null ? null : input.ordinal,
    lastSampleSequence: input.progress.previousSampleSequence ?? null,
    grantDigest: input.progress.grant?.grantDigest ?? R188_ZERO_DIGEST,
    frontier,
    reducerStateDigest:
      input.progress.grant?.reducerStateDigest ?? R188_ZERO_DIGEST,
    chain: {
      receiptHead: input.progress.receiptHead,
      receiptCount: input.progress.receiptCount,
      chunkHead: input.progress.chunkHead,
      chunkCount: input.progress.chunkCount,
      operationHead: input.progress.operationHead,
      operationChunkCount: input.progress.operationChunkCount,
      operationTotals: input.progress.operationTotals,
    },
    functionalRemainingMs: input.error.remainingMs,
    requiredChildWindowMs,
    error: input.error,
  });
};

const assertPostCheckpointProgress = (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly ordinal: number;
}): void => {
  const checkpointDigest = input.progress.previousCheckpointDigest ?? null;
  const sampleSequence = input.progress.previousSampleSequence ?? null;
  if ((checkpointDigest === null) !== (sampleSequence === null))
    throw new Error(
      "R188 budget diagnostic checkpoint and sample bindings are incomplete",
    );
  if (input.ordinal === 0) {
    assertRevealContinuationInitialProgress({
      progress: input.progress,
      ordinal: input.ordinal,
    });
    return;
  }
  if (checkpointDigest === null)
    throw new Error(
      "R188 post-checkpoint budget diagnostic requires a checkpoint binding",
    );
  assertSealedContinuationGrant({
    context: input.context,
    progress: input.progress,
  });
};

const publishStagedBudgetCanary = async (input: {
  readonly context: ParentContext;
  readonly stagedPath: string;
  readonly canary: Awaited<
    ReturnType<typeof createPreflightCanaryBudgetFailure>
  >;
  readonly assertTerminalPublicationActive: () => void;
}): Promise<void> => {
  await writePreflightCanaryArtifact(input.stagedPath, input.canary, () =>
    input.assertTerminalPublicationActive(),
  );
  await assertLivePreflightSourceIdentity({
    source: input.context.source,
    repoRoot: input.context.repoRoot,
  });
  await publishDeadlineBound({
    guard: input.assertTerminalPublicationActive,
    publish: async (markOwned) => {
      await link(input.stagedPath, input.context.canaryPath);
      markOwned();
      await assertLivePreflightSourceIdentity({
        source: input.context.source,
        repoRoot: input.context.repoRoot,
      });
    },
    rollback: () => unlinkIfPresent(input.context.canaryPath),
  });
  const published = await readPreflightCanaryArtifact(input.context.canaryPath);
  if (published.status !== "FAIL_NOT_PROVEN")
    throw new Error("Budget failure publication did not remain diagnostic");
};

export const publishRevealContinuationBudgetFailure = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly ordinal: number;
  readonly error: RevealContinuationBudgetError;
  readonly assertTerminalPublicationActive: () => void;
}): Promise<void> => {
  const stagedPath = stagedPathFor(input.context);
  const archiveRoot = await ensurePreflightArchiveRoot(
    input.context.archiveRoot,
  );
  await assertPreflightArchivePath(archiveRoot, input.context.canaryPath);
  await assertPreflightArchivePath(archiveRoot, stagedPath);
  input.assertTerminalPublicationActive();
  await assertLivePreflightSourceIdentity({
    source: input.context.source,
    repoRoot: input.context.repoRoot,
  });
  assertPostCheckpointProgress(input);
  try {
    await publishStagedBudgetCanary({
      context: input.context,
      stagedPath,
      canary: budgetFailureCanaryFor(input),
      assertTerminalPublicationActive: input.assertTerminalPublicationActive,
    });
  } finally {
    await unlinkIfPresent(stagedPath);
  }
};
