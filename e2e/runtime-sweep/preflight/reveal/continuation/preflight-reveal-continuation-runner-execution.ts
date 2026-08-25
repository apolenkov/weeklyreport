import type { MatrixPreflightControl } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import { compareRevealControlIdentity } from "../../reveal-path.ts";
import { restoreRevealBranch } from "../interaction/preflight-reveal-branch-execution.ts";
import type {
  RevealDiscoveryState,
  RevealQueueChunkResult,
  RevealQueueInput,
} from "../interaction/preflight-reveal-branches.ts";
import {
  freezeRevealCandidateInputs,
  processRevealQueueChunk,
} from "../interaction/preflight-reveal-queue.ts";
import type { RevealQueueYieldInput } from "../interaction/preflight-reveal-queue-candidates.ts";
import { createRevealBootstrap } from "./preflight-reveal-continuation-artifacts.ts";
import {
  createRevealReceiptChunk,
  runIdentityFor,
  strictRouteFor,
} from "./preflight-reveal-continuation-contract-factories.ts";
import { R188_ZERO_DIGEST } from "./preflight-reveal-continuation-digests.ts";
import { genesisForState } from "./preflight-reveal-continuation-genesis.ts";
import { REVEAL_CONTINUATION_LIMITS } from "./preflight-reveal-continuation-limits.ts";
import {
  controlsDigestFor,
  emptyInitialFrontierStateFor,
  reducerStateDigestFor,
} from "./preflight-reveal-continuation-reducer.ts";
import type {
  RevealContinuationBootstrapResult,
  RevealContinuationChunkResult,
  RevealContinuationInitialState,
  RevealContinuationInput,
} from "./preflight-reveal-continuation-runner.ts";
import {
  writeBootstrapAssets,
  writeReceiptAssets,
} from "./preflight-reveal-continuation-runner-output.ts";
import type {
  RevealContinuationReceipt,
  RevealExecutionGrant,
  RevealReceiptChunk,
} from "./preflight-reveal-continuation-schemas.ts";
import { receiptForTerminal } from "./receipts/preflight-reveal-continuation-receipts.ts";

const controlsSorted = (
  controls: readonly MatrixPreflightControl[],
): readonly MatrixPreflightControl[] =>
  controls.toSorted((left, right) =>
    compareRevealControlIdentity(
      {
        controlKey: left.controlKey,
        revealPathDigest: left.revealPath.digest,
        expectedSurfaceDigest: left.expectedSurface.digest,
      },
      {
        controlKey: right.controlKey,
        revealPathDigest: right.revealPath.digest,
        expectedSurfaceDigest: right.expectedSurface.digest,
      },
    ),
  );

interface Progress {
  readonly receipts: RevealContinuationReceipt[];
  completedCandidateCount: number;
}

const frozenNextFrontierFor = async (input: {
  readonly queueInput: RevealQueueInput;
  readonly continuation: NonNullable<RevealQueueYieldInput["continuation"]>;
}) => {
  const requiresLiveRestore = input.continuation.candidates.some(
    (candidate) =>
      candidate.action.operation === "select" &&
      candidate.representativeInput === undefined,
  );
  if (requiresLiveRestore)
    await restoreRevealBranch({
      harness: input.queueInput.harness,
      state: input.queueInput.state,
      route: input.queueInput.route,
      initialSurface: input.queueInput.initialSurface,
      branch: input.continuation.currentBranch,
    });
  return {
    branch: input.continuation.currentBranch,
    candidates: requiresLiveRestore
      ? await freezeRevealCandidateInputs(
          input.queueInput,
          input.continuation.candidates,
        )
      : input.continuation.candidates,
  };
};

const chunkFor = (input: {
  readonly input: RevealContinuationInput;
  readonly initial: RevealContinuationInitialState;
  readonly grant: RevealExecutionGrant | undefined;
  readonly result: RevealQueueChunkResult;
  readonly progress: Progress;
}): RevealReceiptChunk => {
  const receipts = input.progress.receipts;
  const last = receipts.at(-1);
  if (last === undefined)
    throw new Error("Reveal continuation child produced no terminal receipts");
  const run = runIdentityFor({
    source: input.input.source,
    state: input.input.state,
    route: strictRouteFor(input.input.route),
    executionScope: "canary",
    attemptId: input.input.attemptId,
  });
  const previousReceiptHead = input.grant?.chain.receiptHead ?? null;
  const previousReceiptCount = input.grant?.chain.receiptCount ?? 0;
  const previousChunkHead = input.grant?.chain.chunkHead ?? null;
  const previousChunkCount = input.grant?.chain.chunkCount ?? 0;
  return createRevealReceiptChunk({
    run,
    grantDigest: input.grant?.grantDigest ?? R188_ZERO_DIGEST,
    status: input.result.completed ? "BRANCH_EXHAUSTED" : "YIELD",
    predecessorReceiptHead: previousReceiptHead,
    predecessorReceiptCount: previousReceiptCount,
    receiptHead: last.digest,
    receiptCount: previousReceiptCount + receipts.length,
    predecessorChunkHead: previousChunkHead,
    predecessorChunkCount: previousChunkCount,
    chunkSequence: previousChunkCount + 1,
    receipts,
  });
};

const bootstrapFor = (input: {
  readonly input: RevealContinuationInput;
  readonly initial: RevealContinuationInitialState;
  readonly queueInput: RevealQueueInput;
  readonly state: RevealDiscoveryState;
}): RevealContinuationBootstrapResult => {
  const controls = controlsSorted(input.state.controls);
  const bootstrap = createRevealBootstrap({
    run: runIdentityFor({
      source: input.input.source,
      state: input.input.state,
      route: strictRouteFor(input.input.route),
      executionScope: "canary",
      attemptId: input.input.attemptId,
    }),
    genesis: genesisForState({
      state: input.initial.state,
      candidatesFor: input.queueInput.candidatesFor,
    }),
    bounds: {
      maxDepth: input.queueInput.maxDepth,
      maxRevealMaterialEdges: input.queueInput.maxRevealMaterialEdges,
      maxRevealActions: input.queueInput.maxRevealActions,
      maxControlsPerSegment:
        input.input.source.matrixLimits.maxControlsPerSegment,
    },
    reducerStateDigest: reducerStateDigestFor(input.state),
    controlsDigest: controlsDigestFor(controls),
    controlsCount: controls.length,
  });
  return {
    status: "BOOTSTRAP",
    bootstrap,
    controls,
    completedCandidateCount: 0,
  };
};

const terminalHandlerFor =
  (input: {
    readonly continuation: RevealContinuationInput;
    readonly queueInput: RevealQueueInput;
    readonly grant: RevealExecutionGrant | undefined;
    readonly initial: RevealContinuationInitialState;
    readonly progress: Progress;
    readonly deadlineAt: number;
    readonly now: () => number;
    readonly startingActionCount: number;
  }): ((boundary: RevealQueueYieldInput) => Promise<boolean>) =>
  async (boundary: RevealQueueYieldInput): Promise<boolean> => {
    const sequence =
      (input.grant?.chain.receiptCount ?? 0) +
      input.progress.receipts.length +
      1;
    input.progress.completedCandidateCount += 1;
    const limits =
      input.continuation.cooperativeLimits ?? REVEAL_CONTINUATION_LIMITS;
    const shouldYield =
      input.now() >= input.deadlineAt ||
      input.progress.receipts.length + 1 >= limits.maxTerminalCandidates ||
      boundary.state.actionCount - input.startingActionCount >=
        limits.maxRevealActionDelta;
    const nextFrontier =
      shouldYield && boundary.continuation !== undefined
        ? await frozenNextFrontierFor({
            queueInput: input.queueInput,
            continuation: boundary.continuation,
          })
        : undefined;
    input.progress.receipts.push(
      receiptForTerminal({
        terminal: boundary.terminal,
        branch: boundary.currentBranch,
        candidates: boundary.candidates,
        sequence,
        predecessorDigest:
          input.progress.receipts.at(-1)?.digest ??
          input.grant?.chain.receiptHead ??
          null,
        completedCandidateCount: input.progress.completedCandidateCount,
        actionCount: boundary.state.actionCount,
        branchCount: boundary.state.branchCount,
        ...(nextFrontier === undefined ? {} : { nextFrontier }),
      }),
    );
    return shouldYield;
  };

const progressFor = (grant: RevealExecutionGrant | undefined): Progress => ({
  completedCandidateCount: grant?.frontier.completedCandidateCount ?? 0,
  receipts: [],
});

export const executeRevealContinuationChunk = async (input: {
  readonly input: RevealContinuationInput;
  readonly initial: RevealContinuationInitialState;
  readonly queueInput: RevealQueueInput;
  readonly state: RevealDiscoveryState;
  readonly grant?: RevealExecutionGrant;
  readonly deadlineAt: number;
  readonly now: () => number;
}): Promise<RevealContinuationChunkResult> => {
  if (input.grant === undefined) {
    const emptyState = emptyInitialFrontierStateFor({
      queueInput: input.queueInput,
      state: input.state,
    });
    if (emptyState !== undefined) {
      const bootstrap = bootstrapFor({
        input: input.input,
        initial: input.initial,
        queueInput: input.queueInput,
        state: emptyState,
      });
      await writeBootstrapAssets({
        archiveRoot: input.input.archiveRoot,
        result: bootstrap,
      });
      return bootstrap;
    }
  }
  const progress = progressFor(input.grant);
  const startingActionCount = input.state.actionCount;
  const result = await processRevealQueueChunk(
    input.queueInput,
    input.state,
    terminalHandlerFor({
      continuation: input.input,
      queueInput: input.queueInput,
      grant: input.grant,
      initial: input.initial,
      progress,
      deadlineAt: input.deadlineAt,
      now: input.now,
      startingActionCount,
    }),
  );
  if (progress.receipts.length === 0)
    throw new Error(
      "Reveal continuation child reached a receipt-free non-bootstrap boundary",
    );
  const chunk = chunkFor({
    input: input.input,
    initial: input.initial,
    grant: input.grant,
    result,
    progress,
  });
  await writeReceiptAssets({
    archiveRoot: input.input.archiveRoot,
    receipts: progress.receipts,
  });
  return {
    status: "CHUNK",
    chunk,
    completed: result.completed,
    ...(result.completed
      ? { controls: controlsSorted(result.state.controls) }
      : {}),
    completedCandidateCount: progress.completedCandidateCount,
  };
};
