import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type { MatrixPreflightControl } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import type { DomInventory } from "../../../replay/dom/dom-inventory.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { MAX_REVEAL_DEPTH, revealSurfaceFor } from "../../reveal-path.ts";
import {
  assertRoutePath,
  requiredCurrentUrl,
} from "../guards/preflight-reveal-guards.ts";
import { revealReductionContextFor } from "../guards/preflight-reveal-reduction-context.ts";
import { candidatesForImmediateReveal } from "../guards/preflight-reveal-registration.ts";
import {
  type RevealDiscoveryState,
  type RevealQueueInput,
} from "../interaction/preflight-reveal-branches.ts";
import {
  initialRevealStateFor,
  plansFor,
  revealCandidatesFor,
  type RevealDiscoveryInput,
} from "../interaction/preflight-reveal-discovery.ts";
import type {
  RevealExecutionHarness,
  RevealRoute,
} from "../interaction/preflight-reveal-types.ts";
import {
  assertCooperativeRevealContinuationLimits,
  type RevealContinuationCooperativeLimits,
} from "./contracts/preflight-reveal-continuation-limits.ts";
import type { RevealExecutionGrant } from "./contracts/preflight-reveal-continuation-schemas.ts";
import { PREFLIGHT_REVEAL_CANDIDATE_LIST } from "./contracts/preflight-reveal-continuation-schemas.ts";
import { rememberedRevealContinuationAsset } from "./preflight-reveal-continuation-assets.ts";
import { canonicalCandidatesForList } from "./preflight-reveal-continuation-candidates.ts";
import {
  reducerStateDigestFor,
  reducerStateForCheckpoint,
} from "./preflight-reveal-continuation-reducer.ts";
import { executeRevealContinuationChunk } from "./preflight-reveal-continuation-runner-execution.ts";
import {
  assertResumeGrant,
  assertRevealExecutionGrantInput,
} from "./preflight-reveal-continuation-runner-grant.ts";
import { branchForRef } from "./receipts/preflight-reveal-continuation-receipts.ts";

export { assertRevealExecutionGrantInput } from "./preflight-reveal-continuation-runner-grant.ts";

const MINUTES_PER_CHUNK = 30;
const MILLISECONDS_PER_MINUTE = 60_000;
const DEFAULT_REVEAL_CHUNK_BUDGET_MS =
  MINUTES_PER_CHUNK * MILLISECONDS_PER_MINUTE;

export type RevealContinuationBootstrapResult = Readonly<{
  /** An empty observation carries no receipt and grants no execution authority. */
  readonly status: "BOOTSTRAP";
  readonly bootstrap: import("./contracts/preflight-reveal-continuation-schemas.ts").RevealBootstrap;
  readonly controls: readonly MatrixPreflightControl[];
  readonly completedCandidateCount: 0;
}>;

export type RevealContinuationReceiptChunkResult = Readonly<{
  /** The child emits only a raw suffix; the parent owns PASS. */
  readonly status: "CHUNK";
  readonly completed: boolean;
  readonly chunk: import("./contracts/preflight-reveal-continuation-schemas.ts").RevealReceiptChunk;
  readonly controls?: readonly MatrixPreflightControl[];
  readonly completedCandidateCount: number;
}>;

export type RevealContinuationChunkResult =
  RevealContinuationBootstrapResult | RevealContinuationReceiptChunkResult;

export type RevealContinuationInput = Readonly<{
  readonly source: SourceArtifact;
  readonly archiveRoot?: string;
  readonly state: CampaignMatrixState;
  readonly route: RevealRoute;
  readonly initialInventory: DomInventory;
  readonly harness: RevealExecutionHarness;
  readonly controlFor: RevealDiscoveryInput["controlFor"];
  readonly grant?: RevealExecutionGrant;
  readonly executionScope: "canary";
  readonly attemptId: string;
  readonly childExecutionId: string;
  readonly childOrdinal: number;
  readonly expectedGrantDigest?: string;
  readonly deadlineAt?: number;
  readonly chunkBudgetMs?: number;
  readonly cooperativeLimits?: RevealContinuationCooperativeLimits;
  readonly now?: () => number;
}>;

export type RevealContinuationInitialState = Readonly<{
  readonly state: RevealDiscoveryState;
  readonly initialSurface: ReturnType<typeof revealSurfaceFor>;
  readonly initialUrl: string;
}>;

const assertBudget = (budgetMs: number): void => {
  if (!Number.isSafeInteger(budgetMs) || budgetMs <= 0)
    throw new Error(
      "Reveal continuation chunk budget must be a positive integer",
    );
};

const reducerInputFor = (input: {
  readonly state: CampaignMatrixState;
  readonly route: RevealRoute;
  readonly initialSurface: ReturnType<typeof revealSurfaceFor>;
  readonly harness: RevealExecutionHarness;
  readonly controlFor: RevealDiscoveryInput["controlFor"];
  readonly source: SourceArtifact;
}): RevealQueueInput => {
  const reductionContext = revealReductionContextFor({
    source: input.source,
    state: input.state,
    route: input.route,
  });
  return {
    state: input.state,
    route: input.route,
    ...(reductionContext === undefined ? {} : { reductionContext }),
    initialSurface: input.initialSurface,
    harness: input.harness,
    controlFor: input.controlFor,
    plansFor,
    candidatesFor: (inventory) => revealCandidatesFor(inventory, input.route),
    maxDepth: MAX_REVEAL_DEPTH,
    maxRevealMaterialEdges: input.source.matrixLimits.maxRevealMaterialEdges,
    maxRevealActions: input.source.matrixLimits.maxRevealActions,
    maxControlsPerSegment: input.source.matrixLimits.maxControlsPerSegment,
  };
};

const initialStateFor = (
  input: RevealContinuationInput,
): RevealContinuationInitialState => {
  const initialSurface = revealSurfaceFor(input.initialInventory.controls);
  const initialUrl = requiredCurrentUrl(input.harness.currentUrl());
  assertRoutePath(input.route, initialUrl);
  return {
    state: initialRevealStateFor(
      {
        initialInventory: input.initialInventory,
        controlFor: input.controlFor,
        maxControlsPerSegment: input.source.matrixLimits.maxControlsPerSegment,
      },
      initialSurface,
      initialUrl,
    ),
    initialSurface,
    initialUrl,
  };
};

const resumedStateFor = (input: {
  readonly initial: RevealContinuationInitialState;
  readonly grant: RevealExecutionGrant;
  readonly route: RevealRoute;
}): RevealDiscoveryState => {
  const frontier = input.grant.frontier;
  const currentBranch = branchForRef(frontier.branchRef);
  if (
    currentBranch.path.digest !== frontier.pathDigest ||
    currentBranch.surface.digest !== frontier.surfaceDigest ||
    currentBranch.url !== frontier.url
  )
    throw new Error(
      "Reveal execution grant frontier assets are not bound to its branch",
    );
  const derivedCandidates = candidatesForImmediateReveal(
    {
      candidatesFor: (inventory) => revealCandidatesFor(inventory, input.route),
    },
    currentBranch,
  );
  const candidateList = rememberedRevealContinuationAsset({
    artifact: PREFLIGHT_REVEAL_CANDIDATE_LIST,
    ref: frontier.candidateListRef,
  });
  if (candidateList?.artifact !== PREFLIGHT_REVEAL_CANDIDATE_LIST)
    throw new Error(
      "Reveal execution grant frontier candidate list is unavailable",
    );
  const candidates = canonicalCandidatesForList({
    branch: currentBranch,
    branchDigest: frontier.branchDigest,
    candidates: derivedCandidates,
    candidateList,
    candidateListDigest: frontier.candidateListDigest,
  });
  if (frontier.nextCandidateIndex >= candidates.length)
    throw new Error(
      "Reveal execution grant frontier cursor is outside its candidate list",
    );
  const checkpoint = reducerStateForCheckpoint({
    snapshot: input.grant.reducerState,
    route: input.route,
  });
  const state: RevealDiscoveryState = {
    ...checkpoint,
    queue: frontier.queueRefs.map(branchForRef),
    currentBranch,
    currentCandidates: candidates,
    currentCandidateIndex: frontier.nextCandidateIndex,
    actionCount: frontier.actionCount,
    branchCount: frontier.branchCount,
  };
  if (reducerStateDigestFor(state) !== input.grant.reducerStateDigest)
    throw new Error(
      "Reveal execution grant reducer state does not match its digest",
    );
  return state;
};

export async function discoverRevealControlsChunk(
  input: RevealContinuationInput,
): Promise<RevealContinuationChunkResult> {
  assertRevealExecutionGrantInput({
    ...(input.grant === undefined ? {} : { grant: input.grant }),
    ...(input.expectedGrantDigest === undefined
      ? {}
      : { expectedGrantDigest: input.expectedGrantDigest }),
  });
  const budgetMs = input.chunkBudgetMs ?? DEFAULT_REVEAL_CHUNK_BUDGET_MS;
  assertBudget(budgetMs);
  assertCooperativeRevealContinuationLimits(input.cooperativeLimits);
  const now = input.now ?? Date.now;
  const deadlineAt = input.deadlineAt ?? now() + budgetMs;
  if (!Number.isSafeInteger(deadlineAt))
    throw new Error("Reveal continuation deadline must be a safe integer");
  const initial = initialStateFor(input);
  if (now() >= deadlineAt)
    throw new Error(
      "Reveal continuation child deadline expired before the next candidate boundary",
    );
  const queueInput = reducerInputFor({
    state: input.state,
    route: input.route,
    initialSurface: initial.initialSurface,
    harness: input.harness,
    controlFor: input.controlFor,
    source: input.source,
  });
  assertResumeGrant({
    ...(input.grant === undefined ? {} : { grant: input.grant }),
    ...(input.expectedGrantDigest === undefined
      ? {}
      : { expectedGrantDigest: input.expectedGrantDigest }),
    source: input.source,
    state: input.state,
    route: input.route,
    executionScope: input.executionScope,
    attemptId: input.attemptId,
    initialState: initial.state,
    candidatesFor: queueInput.candidatesFor,
  });
  const state =
    input.grant === undefined
      ? initial.state
      : resumedStateFor({ initial, grant: input.grant, route: input.route });
  return executeRevealContinuationChunk({
    input,
    initial,
    queueInput,
    state,
    ...(input.grant === undefined ? {} : { grant: input.grant }),
    deadlineAt,
    now,
  });
}
