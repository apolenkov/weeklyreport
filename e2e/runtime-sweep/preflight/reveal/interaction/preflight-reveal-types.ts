import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type { MatrixPreflightControl } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import type { RevealTransition } from "../../../matrix/reveal-transition.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import type { LiveControlPlan } from "../../../replay/live-control/live-control-planning.ts";
import type { Action } from "../../../source/contracts.ts";
import type { Role, RouteBindingTarget } from "../../../source/contracts.ts";
import type { ResolverOutcomeExpectation } from "../../../support/resolver-outcome-expectations.ts";
import type {
  RevealNonMutationProof,
  RevealPath,
  RevealSurface,
} from "../../reveal-path.ts";
import type { RevealRepresentativeInput } from "./preflight-reveal-transition.ts";

export type RevealRoute = Readonly<{
  readonly resolvedRoute: string;
  readonly landingRoute?: string | undefined;
  readonly expectedOutcome?: ResolverOutcomeExpectation | undefined;
  /** Optional source-bound identity, required when writing continuation state. */
  readonly role?: Role;
  readonly catalogRoute?: string;
  readonly target?: RouteBindingTarget;
  readonly kind?: "unconditional" | "resolver";
}>;

export const REVEAL_EXECUTION_TIMING_STAGES = [
  "replayExecute",
  "candidateExecute",
  "preSettle",
  "beforeSnapshot",
  "action",
  "actionRevealReady",
  "actionNavigationBoundary",
  "navigationNone",
  "navigationObserved",
  "postSettle",
  "afterSnapshot",
  "representativeInput",
  "postObservation",
] as const;

export type RevealExecutionTimingStage =
  (typeof REVEAL_EXECUTION_TIMING_STAGES)[number];

export type RevealExecutionTiming = Readonly<{
  readonly span: <Value>(
    stage: RevealExecutionTimingStage,
    operation: () => Promise<Value>,
  ) => Promise<Value>;
}>;

export type RevealExecutionKind = "replay" | "candidate";

export type RevealPreparation = Readonly<{
  readonly proveNonMutation: (
    action: () => Promise<void>,
    timing?: RevealExecutionTiming,
  ) => Promise<RevealNonMutationProof>;
}>;

export type RevealExecution = Readonly<{
  readonly url: string;
  readonly inventory: DomInventory;
  readonly nonMutation: RevealNonMutationProof;
  readonly representativeInput?: RevealRepresentativeInput;
}>;

type RevealDiscoverySummary = Readonly<{
  readonly completedCandidateCount: number;
  readonly revealActionCount: number;
  readonly materialEdgeCount: number;
  readonly controlCount: number;
  readonly visitedStateCount: number;
  readonly maxQueueLength: number;
  readonly initialSurfaceDigest: string;
  readonly queueEmpty: true;
}>;

export type RevealDiscoveryProgress = Readonly<{
  readonly completedCandidateCount: number;
  readonly revealActionCount: number;
  readonly materialEdgeCount: number;
  readonly controlCount: number;
  readonly visitedStateCount: number;
  readonly queueLength: number;
  readonly maxQueueLength: number;
}>;

export type RevealDiscoveryWithSummary = Readonly<{
  readonly controls: readonly MatrixPreflightControl[];
  readonly summary: RevealDiscoverySummary;
}>;

export interface RevealExecutionHarness {
  readonly prepare: (
    state: CampaignMatrixState,
    route: RevealRoute,
  ) => Promise<RevealPreparation | void>;
  readonly navigate: (route: string) => Promise<void>;
  readonly currentUrl: () => string;
  readonly inventory: () => Promise<DomInventory>;
  /** Wait for a named, expected surface signal before replay equality checks. */
  readonly waitForRevealSurfaceReady?: (
    expected: RevealSurface,
  ) => Promise<void>;
  readonly freezeRepresentativeInput?: (input: {
    readonly control: DomControlObservation;
    readonly action: Action;
    readonly representativeInput?: RevealRepresentativeInput;
  }) => Promise<RevealRepresentativeInput | undefined>;
  readonly executeReveal: (input: {
    readonly executionKind?: RevealExecutionKind;
    readonly control: DomControlObservation;
    readonly action: Action;
    readonly representativeInput?: RevealRepresentativeInput;
    readonly preparation: RevealPreparation | undefined;
    readonly timing?: RevealExecutionTiming;
  }) => Promise<RevealExecution>;
}

export type RevealControlFactory = (
  plan: LiveControlPlan,
  revealPath: RevealPath,
  expectedSurface: RevealSurface,
  expectedActionTransition?: RevealTransition | null,
  expectedActionSurface?: RevealSurface | null,
) => MatrixPreflightControl;

export class RevealDiscoveryError extends Error {
  override readonly name = "RevealDiscoveryError";
}
