import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import * as path from "node:path";

import { stableSerialize } from "../../../support/ids.ts";
import { assertLivePreflightSourceIdentity } from "../../canary/preflight-canary.ts";
import { strictRouteFor } from "../../reveal/continuation/contracts/preflight-reveal-continuation-contract-factories.ts";
import {
  REVEAL_CONTINUATION_LIMITS,
  revealContinuationLimitEnvironment,
} from "../../reveal/continuation/contracts/preflight-reveal-continuation-limits.ts";
import {
  assertRevealContinuationOutputAbsent,
  hydrateRevealContinuationAssets,
  readRevealContinuationArtifact,
} from "../../reveal/continuation/preflight-reveal-continuation-io.ts";
import {
  reducerStateDigestFor,
  reducerStateSnapshotFor,
} from "../../reveal/continuation/preflight-reveal-continuation-reducer.ts";
import {
  assertRevealExecutionGrantAuthority,
  assertRevealExecutionGrantSource,
} from "../../reveal/continuation/preflight-reveal-continuation-validators.ts";
import { RevealContinuationBudgetError } from "./preflight-reveal-continuation-budget-error.ts";
import type {
  ParentContext,
  ParentProgress,
  RevealContinuationTerminalizationPermit,
  RevealContinuationTerminalPublicationCommit,
} from "./preflight-reveal-continuation-parent.ts";
import {
  assertRevealContinuationActive,
  remainingRevealContinuationMs,
} from "./preflight-reveal-continuation-parent.ts";
import { completeEmptyBootstrap } from "./preflight-reveal-continuation-parent-bootstrap.ts";
import { continueChild } from "./preflight-reveal-continuation-parent-results.ts";
import { frontierForState } from "./preflight-reveal-continuation-parent-support.ts";

const CHILD_EXECUTION_ID_BYTES = 32;

export const assertRevealContinuationChildBudget = (input: {
  readonly remainingMs: number;
  readonly hardWallMs: number;
  readonly killGraceMs: number;
}): void => {
  const requiredMs = input.hardWallMs + input.killGraceMs;
  if (Number.isNaN(input.remainingMs) || input.remainingMs < requiredMs)
    throw new RevealContinuationBudgetError({
      remainingMs: input.remainingMs,
      requiredMs,
    });
};

const continuationEnvironmentFor = (
  progress: ParentProgress,
): NodeJS.ProcessEnv => {
  if (progress.inputPath === undefined) return {};
  if (progress.previousGrantDigest === null)
    throw new Error(
      "Continuation input path has no sealed predecessor grant digest",
    );
  return {
    RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_INPUT: progress.inputPath,
    RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_EXPECTED_GRANT_DIGEST:
      progress.previousGrantDigest,
  };
};

const assertGrantIdentity = (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly replayState: NonNullable<ParentProgress["reducerState"]>;
}): void => {
  const { context, progress } = input;
  const grant = progress.grant;
  if (grant === undefined) throw new Error("R188 child has no sealed grant");
  assertRevealExecutionGrantSource({
    grant,
    source: context.source,
    state: context.selection.state,
    route: strictRouteFor(context.revealRoute),
    executionScope: "canary",
    attemptId: context.attemptId,
    ...(progress.previousGrantDigest === null
      ? {}
      : { expectedGrantDigest: progress.previousGrantDigest }),
  });
  assertRevealExecutionGrantAuthority({
    grant,
    source: context.source,
    authorityKey: context.authorityKey,
    attemptId: context.attemptId,
    stateId: context.selection.state.stateId,
    role: context.revealRoute.role,
    route: context.revealRoute.catalogRoute,
    profile: context.selection.state.profile,
  });
  if (
    progress.genesis === undefined ||
    stableSerialize(progress.genesis) !== stableSerialize(grant.genesis)
  )
    throw new Error("R188 sealed grant genesis is not parent-derived");
  if (
    input.replayState.currentBranch === undefined &&
    input.replayState.queue.length === 0
  )
    throw new Error("R188 sealed grant replay state has no frontier");
};

const assertGrantReplayState = (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly replayState: NonNullable<ParentProgress["reducerState"]>;
}): void => {
  const { context, progress, replayState } = input;
  const grant = progress.grant;
  const reducerInput = progress.reducerInput;
  if (grant === undefined || reducerInput === undefined)
    throw new Error("R188 sealed grant has no reducer input");
  const expectedFrontier = frontierForState({
    context: { initialState: replayState, queueInput: reducerInput },
    route: context.revealRoute,
    state: replayState,
    completedCandidateCount: progress.previousCompletedCandidateCount,
  });
  if (stableSerialize(expectedFrontier) !== stableSerialize(grant.frontier))
    throw new Error("R188 sealed grant frontier is not reducer-derived");
  if (reducerStateDigestFor(replayState) !== grant.reducerStateDigest)
    throw new Error("R188 sealed grant reducer state digest is stale");
  if (
    stableSerialize(reducerStateSnapshotFor(replayState)) !==
    stableSerialize(grant.reducerState)
  )
    throw new Error("R188 sealed grant reducer state snapshot is stale");
};

export const assertSealedContinuationGrant = (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
}): void => {
  const { context, progress } = input;
  const replayState = progress.reducerState;
  if (
    progress.grant === undefined ||
    replayState === undefined ||
    progress.reducerInput === undefined
  )
    throw new Error(
      "R188 post-checkpoint budget diagnostic requires the complete sealed grant state",
    );
  assertGrantIdentity({ context, progress, replayState });
  assertGrantReplayState({ context, progress, replayState });
  const progressChain = {
    receiptHead: progress.receiptHead,
    receiptCount: progress.receiptCount,
    chunkHead: progress.chunkHead,
    chunkCount: progress.chunkCount,
    operationHead: progress.operationHead,
    operationChunkCount: progress.operationChunkCount,
    operationTotals: progress.operationTotals,
  };
  if (stableSerialize(progress.grant.chain) !== stableSerialize(progressChain))
    throw new Error("R188 post-checkpoint grant chain is not parent-derived");
};

const prepareParentGrant = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
}): Promise<void> => {
  const { context, progress } = input;
  if (progress.grant === undefined) return;
  assertSealedContinuationGrant(input);
  await hydrateRevealContinuationAssets({
    archiveRoot: context.archiveRoot,
    grant: progress.grant,
  });
};

const runBoundedContinuationChild = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly outputPath: string;
  readonly childExecutionId: string;
  readonly childOrdinal: number;
}): Promise<number> => {
  const { context, progress, outputPath } = input;
  const limits = context.continuationLimits ?? REVEAL_CONTINUATION_LIMITS;
  const remainingMs = remainingRevealContinuationMs(context);
  assertRevealContinuationChildBudget({
    remainingMs,
    hardWallMs: limits.hardWallMs,
    killGraceMs: limits.killGraceMs,
  });
  assertRevealContinuationActive(context);
  const maxDurationMs = Math.min(
    limits.hardWallMs,
    remainingMs - limits.killGraceMs,
  );
  const childDeadlineAt = Math.min(
    (context.now?.() ?? Date.now()) + limits.softWallMs - limits.yieldReserveMs,
    (context.functionalDeadlineAt ??
      context.deadlineAt ??
      Number.POSITIVE_INFINITY) - limits.killGraceMs,
  );
  try {
    return await context.runPlaywright(
      "canary",
      undefined,
      {
        RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_OUTPUT: outputPath,
        ...continuationEnvironmentFor(progress),
        RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_ATTEMPT_ID:
          context.attemptId,
        RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_CHILD_EXECUTION_ID:
          input.childExecutionId,
        RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_CHILD_ORDINAL: String(
          input.childOrdinal,
        ),
        RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_DEADLINE_AT:
          String(childDeadlineAt),
        ...revealContinuationLimitEnvironment(limits),
      },
      {
        maxDurationMs,
        terminationGraceMs: limits.killGraceMs,
        ...(context.signal === undefined ? {} : { signal: context.signal }),
      },
    );
  } catch (error: unknown) {
    await rm(outputPath, { force: true });
    throw error;
  }
};

export const runContinuationChild = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly ordinal: number;
}): Promise<
  Readonly<{
    readonly done: boolean;
    readonly progress: ParentProgress;
    readonly exitCode?: number;
    readonly publishTerminalArtifacts?: (
      permit: RevealContinuationTerminalizationPermit,
    ) => Promise<RevealContinuationTerminalPublicationCommit>;
  }>
> => {
  const { context, progress } = input;
  const limits = context.continuationLimits ?? REVEAL_CONTINUATION_LIMITS;
  assertRevealContinuationChildBudget({
    remainingMs: remainingRevealContinuationMs(context),
    hardWallMs: limits.hardWallMs,
    killGraceMs: limits.killGraceMs,
  });
  assertRevealContinuationActive(context);
  const childExecutionId = randomBytes(CHILD_EXECUTION_ID_BYTES).toString(
    "hex",
  );
  await prepareParentGrant({ context, progress });
  const outputPath = path.join(
    context.archiveRoot,
    "continuation",
    `PREFLIGHT_REVEAL_CONTINUATION.${context.attemptId}.${String(input.ordinal)}.json`,
  );
  await assertRevealContinuationOutputAbsent({
    archiveRoot: context.archiveRoot,
    filePath: outputPath,
  });
  const childCode = await runBoundedContinuationChild({
    context,
    progress,
    outputPath,
    childExecutionId,
    childOrdinal: input.ordinal,
  });
  assertRevealContinuationActive(context);
  await assertLivePreflightSourceIdentity({
    source: context.source,
    repoRoot: context.repoRoot,
  });
  if (childCode !== 0) return { done: true, progress, exitCode: childCode };
  const childArtifact = await readRevealContinuationArtifact({
    archiveRoot: context.archiveRoot,
    filePath: outputPath,
  });
  if (childArtifact === undefined)
    throw new Error("Continuation child produced no immutable result artifact");
  if (childArtifact.kind === "BOOTSTRAP")
    return completeEmptyBootstrap({
      context,
      progress,
      bootstrap: childArtifact.bootstrap,
      ordinal: input.ordinal,
    });
  return continueChild({
    context,
    progress,
    chunk: childArtifact.chunk,
    ordinal: input.ordinal,
    expectedChildExecutionId: childExecutionId,
  });
};
