import { randomBytes } from "node:crypto";
import { access, readdir } from "node:fs/promises";
import * as path from "node:path";
import { performance } from "node:perf_hooks";

import type { SourceArtifact } from "../../../source/source-artifact.ts";
import {
  preflightCanarySelectorFromEnvironment,
  resolvePreflightCanarySelection,
} from "../../canary/preflight-canary.ts";
import { revealRouteFor } from "../../execution/playwright-preflight-support.ts";
import {
  REVEAL_CONTINUATION_LIMITS,
  revealContinuationLimitsFromEnvironment,
} from "../../reveal/continuation/contracts/preflight-reveal-continuation-limits.ts";
import type { RevealExecutionGrant } from "../../reveal/continuation/contracts/preflight-reveal-continuation-schemas.ts";
import type { RevealOperationTotals } from "../../reveal/continuation/operation/preflight-reveal-operation-evidence-reducer.ts";
import type { RevealReducerInput } from "../../reveal/continuation/preflight-reveal-continuation-reducer.ts";
import type { RevealDiscoveryState } from "../../reveal/interaction/preflight-reveal-branches.ts";
import type { RequestHostCheckpoint } from "../checkpoint/preflight-reveal-host-checkpoint-client.ts";
import type { PreflightLaunchMode } from "../preflight-launch-guard.ts";
import type { PreflightFullPaths } from "../preflight-launcher-support.ts";
import type { PreflightPlaywrightChildCleanupEvidence } from "../preflight-playwright-child-cleanup.ts";
import { attemptDeadlinesFor } from "./preflight-reveal-continuation-parent-deadline.ts";
import { runRevealContinuationWithRuntime } from "./preflight-reveal-continuation-parent-runtime.ts";

const AUTHORITY_KEY_BYTES = 32;
const ATTEMPT_ID_BYTES = 16;
const REVEAL_CONTINUATION_ABORTED = "Reveal continuation aborted";
const REVEAL_CONTINUATION_DEADLINE_EXCEEDED =
  "Reveal continuation 24-minute deadline exceeded";
const TERMINALIZATION_PERMIT: unique symbol = Symbol(
  "reveal-continuation-terminalization",
);
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
    readonly onCleanup?: (
      evidence: PreflightPlaywrightChildCleanupEvidence,
    ) => void;
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
  /** The cumulative attempt deadline; terminal publication may use this. */
  readonly deadlineAt?: number;
  readonly deadlineMonotonic?: number;
  /** Aggregate partitions keep the uncapped supervisor deadline for terminalization. */
  readonly terminalDeadlineAt?: number;
  readonly terminalDeadlineMonotonic?: number;
  /** Normal browser/checkpoint work must finish before terminalization grace. */
  readonly functionalDeadlineAt?: number;
  readonly functionalDeadlineMonotonic?: number;
  readonly signal?: AbortSignal;
  readonly runPlaywright: RunPlaywright;
  readonly onChildCleanup?: (
    evidence: PreflightPlaywrightChildCleanupEvidence & {
      readonly childOrdinal: number;
    },
  ) => void;
  /** Close and verify attempt-owned runtime dependencies before any terminal PASS. */
  readonly beforeAggregateTerminalPublication?: () => Promise<void>;
  readonly aggregatePlan?: import("./preflight-reveal-continuation-partition.ts").RevealPartitionPlan;
}>;

export type RevealContinuationTerminalizationPermit = Readonly<{
  readonly [TERMINALIZATION_PERMIT]: boolean;
  readonly attemptId: string;
  readonly terminalChildOrdinal: number;
  readonly finalCheckpointDigest: string;
}>;

export type RevealContinuationTerminalPublicationCommit = () => Promise<void>;

export const createRevealContinuationTerminalizationPermit = (input: {
  readonly attemptId: string;
  readonly terminalChildOrdinal: number;
  readonly finalCheckpointDigest: string;
}): RevealContinuationTerminalizationPermit => ({
  [TERMINALIZATION_PERMIT]: true,
  ...input,
});

export const remainingRevealContinuationMs = (
  context: Pick<
    ParentContext,
    "deadlineMonotonic" | "functionalDeadlineMonotonic" | "monotonicNow"
  >,
): number => {
  const deadline =
    context.functionalDeadlineMonotonic ?? context.deadlineMonotonic;
  if (deadline === undefined || context.monotonicNow === undefined)
    return Number.POSITIVE_INFINITY;
  return Math.floor(deadline - context.monotonicNow());
};

export const assertRevealContinuationActive = (
  context: Pick<
    ParentContext,
    | "deadlineMonotonic"
    | "functionalDeadlineMonotonic"
    | "monotonicNow"
    | "signal"
  >,
  reserveMs = 0,
): void => {
  if (context.signal?.aborted)
    throw context.signal.reason ?? new Error(REVEAL_CONTINUATION_ABORTED);
  if (remainingRevealContinuationMs(context) <= reserveMs)
    throw new Error(REVEAL_CONTINUATION_DEADLINE_EXCEEDED);
};

/** Diagnostic terminal publication may consume the reserved functional window. */
export const assertRevealContinuationTerminalPublicationActive = (
  context: Pick<
    ParentContext,
    | "deadlineMonotonic"
    | "terminalDeadlineMonotonic"
    | "monotonicNow"
    | "signal"
  >,
): void => {
  const deadlineMonotonic =
    context.terminalDeadlineMonotonic ?? context.deadlineMonotonic;
  if (context.signal?.aborted)
    throw context.signal.reason ?? new Error(REVEAL_CONTINUATION_ABORTED);
  if (
    deadlineMonotonic !== undefined &&
    context.monotonicNow !== undefined &&
    Math.floor(deadlineMonotonic - context.monotonicNow()) <= 0
  )
    throw new Error(REVEAL_CONTINUATION_DEADLINE_EXCEEDED);
};

/**
 * Terminalization is deliberately narrower than normal continuation work.
 * It is valid only after the last host checkpoint and until the cumulative
 * attempt deadline. No browser action or new checkpoint may call this guard.
 */
export const assertRevealContinuationTerminalizationActive = (
  context: Pick<
    ParentContext,
    | "attemptId"
    | "deadlineMonotonic"
    | "terminalDeadlineMonotonic"
    | "monotonicNow"
    | "signal"
  >,
  permit: RevealContinuationTerminalizationPermit,
): void => {
  const deadlineMonotonic =
    context.terminalDeadlineMonotonic ?? context.deadlineMonotonic;
  if (
    !permit[TERMINALIZATION_PERMIT] ||
    permit.attemptId !== context.attemptId ||
    permit.terminalChildOrdinal < 0 ||
    permit.finalCheckpointDigest.length === 0
  )
    throw new Error("Reveal continuation terminalization permit is invalid");
  if (context.signal?.aborted)
    throw context.signal.reason ?? new Error(REVEAL_CONTINUATION_ABORTED);
  if (
    deadlineMonotonic !== undefined &&
    context.monotonicNow !== undefined &&
    Math.floor(deadlineMonotonic - context.monotonicNow()) <= 0
  )
    throw new Error(REVEAL_CONTINUATION_DEADLINE_EXCEEDED);
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
  const canaryDirectory = path.dirname(canaryPath);
  const pendingPrefix = `.${path.basename(canaryPath)}.`;
  const entries = await readdir(canaryDirectory).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return [] as const;
    throw error;
  });
  if (
    entries.some(
      (entry) => entry.startsWith(pendingPrefix) && entry.endsWith(".pending"),
    )
  )
    throw new Error(
      "A continuation attempt cannot start while a staged terminal canary publication is pending; inspect or remove the incomplete attempt explicitly",
    );
};

const runtimeOptionsFor = (input: {
  readonly aggregatePlan?: ParentContext["aggregatePlan"];
  readonly beforeRun?: (context: ParentContext) => Promise<void>;
  readonly afterRun?: (context: ParentContext) => Promise<void>;
}) => ({
  ...(input.aggregatePlan === undefined
    ? {}
    : { aggregatePlan: input.aggregatePlan }),
  ...(input.beforeRun === undefined ? {} : { beforeRun: input.beforeRun }),
  ...(input.afterRun === undefined ? {} : { afterRun: input.afterRun }),
});

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
  readonly functionalDeadlineAt?: number;
  readonly functionalDeadlineMonotonic?: number;
  readonly signal?: AbortSignal;
  readonly aggregatePlan?: import("./preflight-reveal-continuation-partition.ts").RevealPartitionPlan;
  /** Prepare campaign-owned runtime dependencies after the attempt deadline exists. */
  readonly beforeRun?: (context: ParentContext) => Promise<void>;
  /** Release campaign-owned runtime dependencies even when the child fails. */
  readonly afterRun?: (context: ParentContext) => Promise<void>;
  readonly beforeAggregateTerminalPublication?: () => Promise<void>;
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
  const deadlines = attemptDeadlinesFor({
    ...input,
    now,
    monotonicNow,
    reserveMs: limits.yieldReserveMs,
  });
  const signal = input.signal ?? new AbortController().signal;
  const context: ParentContext = {
    ...input,
    now,
    monotonicNow,
    ...deadlines,
    signal,
    selection,
    revealRoute: revealRouteFor(selection.route),
    authorityKey: randomBytes(AUTHORITY_KEY_BYTES).toString("hex"),
    attemptId: `reveal-attempt-${randomBytes(ATTEMPT_ID_BYTES).toString("hex")}`,
    chunkBudget: String(limits.softWallMs),
    chunkBudgetMs: limits.softWallMs,
    continuationLimits: limits,
    ...(input.aggregatePlan === undefined
      ? {}
      : { aggregatePlan: input.aggregatePlan }),
  };
  assertRevealContinuationActive(context);
  const maxChildren = input.source.matrixLimits.maxRevealActions + 1;
  return runRevealContinuationWithRuntime({
    context,
    maxChildren,
    ...runtimeOptionsFor(input),
  });
};
