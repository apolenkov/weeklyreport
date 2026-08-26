import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import type { SourceArtifact } from "../../../source/source-artifact.ts";
import {
  preflightCanarySelectorFromEnvironment,
  resolvePreflightCanarySelection,
} from "../../canary/preflight-canary.ts";
import { revealRouteFor } from "../../execution/playwright-preflight-support.ts";
import {
  REVEAL_CONTINUATION_ATTEMPT_MAX_MS,
  REVEAL_CONTINUATION_LIMITS,
  revealContinuationLimitsFromEnvironment,
} from "../../reveal/continuation/contracts/preflight-reveal-continuation-limits.ts";
import type { RevealExecutionGrant } from "../../reveal/continuation/contracts/preflight-reveal-continuation-schemas.ts";
import {
  type RevealOperationTotals,
  zeroRevealOperationTotals,
} from "../../reveal/continuation/operation/preflight-reveal-operation-evidence-reducer.ts";
import type { RevealReducerInput } from "../../reveal/continuation/preflight-reveal-continuation-reducer.ts";
import type { RevealDiscoveryState } from "../../reveal/interaction/preflight-reveal-branches.ts";
import type { RequestHostCheckpoint } from "../checkpoint/preflight-reveal-host-checkpoint-client.ts";
import { runChildUntilDone } from "../checkpoint/preflight-reveal-host-checkpoint-parent.ts";
import type { PreflightLaunchMode } from "../preflight-launch-guard.ts";
import type { PreflightFullPaths } from "../preflight-launcher-support.ts";

const AUTHORITY_KEY_BYTES = 32;
const ATTEMPT_ID_BYTES = 16;
export type ContinuationSelector = ReturnType<
  typeof preflightCanarySelectorFromEnvironment
>;
type CanarySelection = ReturnType<typeof resolvePreflightCanarySelection>;
export type RunPlaywright = (
  mode: PreflightLaunchMode,
  fullPreflight?: PreflightFullPaths,
  extraEnvironment?: NodeJS.ProcessEnv,
  bounds?: Readonly<{
    readonly maxDurationMs: number;
    readonly terminationGraceMs: number;
    readonly signal?: AbortSignal;
  }>,
) => Promise<number>;

/** Parent-only mutable state; no cumulative receipt array crosses the child boundary. */
export type ParentProgress = Readonly<{
  readonly inputPath?: string;
  readonly previousGrantDigest: string | null;
  readonly previousCompletedCandidateCount: number;
  readonly receiptHead: string | null;
  readonly receiptCount: number;
  readonly chunkHead: string | null;
  readonly chunkCount: number;
  readonly operationHead: string | null;
  readonly operationChunkCount: number;
  readonly operationTotals: RevealOperationTotals;
  readonly previousCheckpointDigest?: string | null;
  readonly previousSampleSequence?: number | null;
  readonly grant?: RevealExecutionGrant;
  readonly genesis?: RevealExecutionGrant["genesis"];
  readonly reducerState?: RevealDiscoveryState;
  readonly reducerInput?: RevealReducerInput;
}>;
export type ParentContext = Readonly<{
  readonly source: SourceArtifact;
  readonly repoRoot: string;
  readonly archiveRoot: string;
  readonly canaryPath: string;
  readonly baselineReceiptDigest?: string;
  readonly selection: CanarySelection;
  readonly revealRoute: ReturnType<typeof revealRouteFor>;
  readonly authorityKey: string;
  readonly attemptId: string;
  readonly chunkBudget: string;
  readonly chunkBudgetMs: number;
  readonly continuationLimits?: typeof REVEAL_CONTINUATION_LIMITS;
  readonly requestHostCheckpoint?: RequestHostCheckpoint;
  readonly now?: () => number;
  readonly monotonicNow?: () => number;
  readonly deadlineAt?: number;
  readonly deadlineMonotonic?: number;
  readonly signal?: AbortSignal;
  readonly runPlaywright: RunPlaywright;
}>;

export const remainingRevealContinuationMs = (
  context: Pick<ParentContext, "deadlineMonotonic" | "monotonicNow">,
): number =>
  context.deadlineMonotonic === undefined || context.monotonicNow === undefined
    ? Number.POSITIVE_INFINITY
    : Math.floor(context.deadlineMonotonic - context.monotonicNow());

export const assertRevealContinuationActive = (
  context: Pick<ParentContext, "deadlineMonotonic" | "monotonicNow" | "signal">,
  reserveMs = 0,
): void => {
  if (context.signal?.aborted)
    throw context.signal.reason ?? new Error("Reveal continuation aborted");
  if (remainingRevealContinuationMs(context) <= reserveMs)
    throw new Error("Reveal continuation 24-minute deadline exceeded");
};

const assertFreshCanary = async (canaryPath: string): Promise<void> => {
  try {
    await access(canaryPath);
    throw new Error(
      "A continuation attempt cannot start while PREFLIGHT_CANARY.json already exists",
    );
  } catch (error: unknown) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }
};

export const runPreflightRevealContinuation = async (input: {
  readonly source: SourceArtifact;
  readonly repoRoot: string;
  readonly archiveRoot: string;
  readonly canaryPath: string;
  readonly baselineReceiptDigest?: string;
  readonly selector: ContinuationSelector;
  readonly requestHostCheckpoint?: RequestHostCheckpoint;
  readonly now?: () => number;
  readonly monotonicNow?: () => number;
  readonly deadlineAt?: number;
  readonly deadlineMonotonic?: number;
  readonly signal?: AbortSignal;
  readonly runPlaywright: RunPlaywright;
}): Promise<number> => {
  await assertFreshCanary(input.canaryPath);
  const limits = revealContinuationLimitsFromEnvironment(process.env);
  const selection = resolvePreflightCanarySelection({
    source: input.source,
    selector: input.selector,
  });
  const now = input.now ?? Date.now;
  const monotonicNow = input.monotonicNow ?? performance.now.bind(performance);
  const deadlineAt =
    input.deadlineAt ?? now() + REVEAL_CONTINUATION_ATTEMPT_MAX_MS;
  const deadlineMonotonic =
    input.deadlineMonotonic ??
    monotonicNow() + REVEAL_CONTINUATION_ATTEMPT_MAX_MS;
  const signal = input.signal ?? new AbortController().signal;
  const context: ParentContext = {
    ...input,
    now,
    monotonicNow,
    deadlineAt,
    deadlineMonotonic,
    signal,
    selection,
    revealRoute: revealRouteFor(selection.route),
    authorityKey: randomBytes(AUTHORITY_KEY_BYTES).toString("hex"),
    attemptId: `reveal-attempt-${randomBytes(ATTEMPT_ID_BYTES).toString("hex")}`,
    chunkBudget: String(limits.softWallMs),
    chunkBudgetMs: limits.softWallMs,
    continuationLimits: limits,
  };
  assertRevealContinuationActive(context);
  const maxChildren = input.source.matrixLimits.maxRevealActions + 1;
  const progress: ParentProgress = {
    previousGrantDigest: null,
    previousCompletedCandidateCount: 0,
    receiptHead: null,
    receiptCount: 0,
    chunkHead: null,
    chunkCount: 0,
    operationHead: null,
    operationChunkCount: 0,
    operationTotals: zeroRevealOperationTotals(),
    previousCheckpointDigest: null,
    previousSampleSequence: null,
  };
  return runChildUntilDone({
    context,
    progress,
    ordinal: 0,
    maxChildren,
  });
};
