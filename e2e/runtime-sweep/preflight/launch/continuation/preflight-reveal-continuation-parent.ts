import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";

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
  readonly runPlaywright: RunPlaywright;
}>;

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
  readonly runPlaywright: RunPlaywright;
}): Promise<number> => {
  await assertFreshCanary(input.canaryPath);
  const limits = revealContinuationLimitsFromEnvironment(process.env);
  const selection = resolvePreflightCanarySelection({
    source: input.source,
    selector: input.selector,
  });
  const context: ParentContext = {
    ...input,
    selection,
    revealRoute: revealRouteFor(selection.route),
    authorityKey: randomBytes(AUTHORITY_KEY_BYTES).toString("hex"),
    attemptId: `reveal-attempt-${randomBytes(ATTEMPT_ID_BYTES).toString("hex")}`,
    chunkBudget: String(limits.softWallMs),
    chunkBudgetMs: limits.softWallMs,
    continuationLimits: limits,
  };
  const maxChildren = input.source.matrixLimits.maxRevealActions + 1;
  const progress: ParentProgress = {
    previousGrantDigest: null,
    previousCompletedCandidateCount: 0,
    receiptHead: null,
    receiptCount: 0,
    chunkHead: null,
    chunkCount: 0,
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
