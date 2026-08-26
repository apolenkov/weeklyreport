import { link, unlink } from "node:fs/promises";
import * as path from "node:path";

import { stableSerialize } from "../../../support/ids.ts";
import {
  assertLivePreflightSourceIdentity,
  assertPreflightCanaryPassForSource,
  createPreflightCanaryPass,
  readPreflightCanaryArtifact,
  writePreflightCanaryArtifact,
} from "../../canary/preflight-canary.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveRoot,
} from "../../preflight-archive-path.ts";
import { publishDeadlineBound } from "../../preflight-deadline-publication.ts";
import {
  runIdentityFor,
  strictRouteFor,
} from "../../reveal/continuation/contracts/preflight-reveal-continuation-contract-factories.ts";
import type {
  RevealContinuationFrontier,
  RevealExecutionGrant,
  RevealReceiptChunk,
} from "../../reveal/continuation/contracts/preflight-reveal-continuation-schemas.ts";
import { addRevealOperationTotals } from "../../reveal/continuation/operation/preflight-reveal-operation-evidence-reducer.ts";
import { R188_ZERO_DIGEST } from "../../reveal/continuation/preflight-reveal-continuation-digests.ts";
import { reducerStateDigestFor } from "../../reveal/continuation/preflight-reveal-continuation-reducer.ts";
import {
  branchForRef,
  frontierFor,
} from "../../reveal/continuation/receipts/preflight-reveal-continuation-receipts.ts";
import { revealCandidatesFor } from "../../reveal/interaction/preflight-reveal-discovery.ts";
import type {
  ParentContext,
  ParentProgress,
  RevealContinuationTerminalPublicationCommit,
} from "./preflight-reveal-continuation-parent.ts";
import { assertRevealContinuationActive } from "./preflight-reveal-continuation-parent.ts";
import {
  type ParentReplayContext,
  parentReplayContextFor,
} from "./preflight-reveal-continuation-parent-replay.ts";

export const zeroDigest = R188_ZERO_DIGEST;

export const chainFor = (input: {
  readonly progress: ParentProgress;
  readonly chunk: RevealReceiptChunk;
}): RevealExecutionGrant["chain"] => ({
  receiptHead: input.chunk.receiptHead,
  receiptCount: input.chunk.receiptCount,
  chunkHead: input.chunk.chunkDigest,
  chunkCount: input.chunk.predecessorChunkCount + 1,
  operationHead: input.chunk.operationEvidence.operationDigest,
  operationChunkCount: input.progress.operationChunkCount + 1,
  operationTotals: addRevealOperationTotals(
    input.progress.operationTotals,
    input.chunk.operationEvidence.summary,
  ),
});

export const assertChunkRun = (input: {
  readonly context: ParentContext;
  readonly chunk: RevealReceiptChunk;
}): void => {
  const expected = runIdentityFor({
    source: input.context.source,
    state: input.context.selection.state,
    route: strictRouteFor(input.context.revealRoute),
    executionScope: "canary",
    attemptId: input.context.attemptId,
  });
  if (stableSerialize(expected) !== stableSerialize(input.chunk.run))
    throw new Error(
      "R188 child chunk source/state/route/attempt binding drifted",
    );
};

export const contextForChunk = (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly chunk: RevealReceiptChunk;
}): ParentReplayContext => {
  if (
    input.progress.reducerInput !== undefined &&
    input.progress.reducerState !== undefined
  )
    return {
      initialState: input.progress.reducerState,
      queueInput: input.progress.reducerInput,
    };
  const firstReceipt = input.chunk.receipts[0];
  if (firstReceipt === undefined)
    throw new Error("R188 child chunk has no terminal receipt");
  const initialBranch = branchForRef(firstReceipt.branchRef);
  if (initialBranch.url !== input.context.revealRoute.resolvedRoute)
    throw new Error("R188 first receipt does not bind to the selected route");
  return parentReplayContextFor({
    source: input.context.source,
    state: input.context.selection.state,
    route: input.context.revealRoute,
    initialUrl: initialBranch.url,
    initialInventory: initialBranch.inventory,
  });
};

export const frontierForState = (input: {
  readonly context: ParentReplayContext;
  readonly route: ParentContext["revealRoute"];
  readonly state: Parameters<typeof reducerStateDigestFor>[0];
  readonly completedCandidateCount: number;
}): RevealContinuationFrontier => {
  const currentBranch = input.state.currentBranch ?? input.state.queue[0];
  if (currentBranch === undefined)
    throw new Error("R188 open reducer has no frontier branch");
  const candidates =
    input.state.currentCandidates ??
    revealCandidatesFor(currentBranch.inventory, input.route);
  if (
    candidates.some(
      (candidate) =>
        candidate.action.operation === "select" &&
        candidate.representativeInput === undefined,
    )
  )
    throw new Error("R188 parent cannot seal an unfrozen select frontier");
  return frontierFor({
    state: input.state,
    currentBranch,
    candidates,
    nextCandidateIndex: input.state.currentCandidateIndex ?? 0,
    completedCandidateCount: input.completedCandidateCount,
  });
};

const stagedCanaryPathFor = (context: ParentContext): string =>
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

const commitStagedCanary =
  (input: {
    readonly context: ParentContext;
    readonly stagedPath: string;
    readonly commitGuard: () => void;
    readonly cleanupPending?: () => Promise<void>;
  }): RevealContinuationTerminalPublicationCommit =>
  async () => {
    input.commitGuard();
    const archiveRoot = await ensurePreflightArchiveRoot(
      input.context.archiveRoot,
    );
    await assertPreflightArchivePath(archiveRoot, input.context.canaryPath);
    await assertPreflightArchivePath(archiveRoot, input.stagedPath);
    await publishDeadlineBound({
      guard: input.commitGuard,
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
    // The canonical link is now the linearization point.  Do not run a
    // deadline guard after it; pending-marker cleanup must not revoke PASS.
    await (
      input.cleanupPending ?? (() => unlinkIfPresent(input.stagedPath))
    )().catch(() => undefined);
  };

export const writeCompleteCanary = async (input: {
  readonly context: ParentContext;
  readonly replay: Readonly<{
    readonly state: Parameters<typeof reducerStateDigestFor>[0];
    readonly completedCandidateCount: number;
  }>;
  readonly commitGuard?: () => void;
  readonly cleanupPending?: () => Promise<void>;
}): Promise<RevealContinuationTerminalPublicationCommit> => {
  const commitGuard =
    input.commitGuard ?? (() => assertRevealContinuationActive(input.context));
  commitGuard();
  await assertLivePreflightSourceIdentity({
    source: input.context.source,
    repoRoot: input.context.repoRoot,
  });
  const stagedPath = stagedCanaryPathFor(input.context);
  const archiveRoot = await ensurePreflightArchiveRoot(
    input.context.archiveRoot,
  );
  await assertPreflightArchivePath(archiveRoot, input.context.canaryPath);
  await assertPreflightArchivePath(archiveRoot, stagedPath);
  await writePreflightCanaryArtifact(
    stagedPath,
    createPreflightCanaryPass({
      source: input.context.source,
      selection: input.context.selection,
      segment: {
        state: input.context.selection.state,
        controls: input.replay.state.controls.toSorted((left, right) =>
          left.controlKey.localeCompare(right.controlKey),
        ),
        specialized: [],
      },
    }),
    commitGuard,
  );
  commitGuard();
  await assertLivePreflightSourceIdentity({
    source: input.context.source,
    repoRoot: input.context.repoRoot,
  });
  commitGuard();
  assertPreflightCanaryPassForSource({
    source: input.context.source,
    canary: await readPreflightCanaryArtifact(stagedPath),
    stateId: input.context.selection.state.stateId,
  });
  commitGuard();
  return commitStagedCanary({
    context: input.context,
    stagedPath,
    commitGuard,
    ...(input.cleanupPending === undefined
      ? {}
      : { cleanupPending: input.cleanupPending }),
  });
};
