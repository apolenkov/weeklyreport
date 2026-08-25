import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type { MatrixPreflightControl } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import type { RevealTransition } from "../../../matrix/reveal-transition.ts";
import type { DomInventory } from "../../../replay/dom/dom-inventory.ts";
import type { LiveControlPlan } from "../../../replay/live-control/live-control-planning.ts";
import type { Action } from "../../../source/contracts.ts";
import {
  revealControlPreparationIdentityFor,
  type RevealPath,
  type RevealSurface,
} from "../../reveal-path.ts";
import type { RevealReductionContext } from "../guards/preflight-reveal-reduction-context.ts";
import type { RevealRepresentativeInput } from "./preflight-reveal-transition.ts";
import {
  type RevealControlFactory,
  RevealDiscoveryError,
  type RevealExecutionHarness,
  type RevealRoute,
} from "./preflight-reveal-types.ts";

export type RevealCandidate = LiveControlPlan & {
  readonly action: Action;
  readonly representativeInput?: RevealRepresentativeInput;
};

export type RevealBranch = Readonly<{
  readonly path: RevealPath;
  readonly inventory: DomInventory;
  readonly surface: RevealSurface;
  readonly url: string;
  readonly preparation?:
    import("./preflight-reveal-types.ts").RevealPreparation | undefined;
}>;

export type RevealDiscoveryState = Readonly<{
  readonly queue: readonly RevealBranch[];
  readonly controls: readonly MatrixPreflightControl[];
  readonly discovered: ReadonlyMap<
    string,
    Readonly<{
      readonly signature: string;
      readonly pathDigest: string;
      readonly surfaceDigest: string;
    }>
  >;
  readonly visitedStatePaths: ReadonlyMap<string, string>;
  readonly actionCount: number;
  readonly branchCount: number;
  /** Runtime-only cursor fields; continuation checkpoints strip preparations. */
  readonly currentBranch?: RevealBranch;
  readonly currentCandidates?: readonly RevealCandidate[];
  readonly currentCandidateIndex?: number;
}>;

export type RevealQueueChunkResult = Readonly<{
  readonly state: RevealDiscoveryState;
  readonly completed: boolean;
  readonly currentBranch?: RevealBranch;
  readonly remainingQueue?: readonly RevealBranch[];
  readonly candidates?: readonly RevealCandidate[];
  readonly nextCandidateIndex?: number;
}>;

export type RevealCandidateTerminalResult = Readonly<{
  readonly candidate: RevealCandidate;
  readonly result: Readonly<{
    readonly branch: RevealBranch;
    readonly transition: RevealTransition;
    readonly explore: boolean;
  }>;
  readonly candidateIndex: number;
  readonly materialChanged: boolean;
}>;

export type RevealCandidateFailure = Readonly<{
  readonly state: RevealDiscoveryState;
  readonly branch: RevealBranch;
  readonly candidates: readonly RevealCandidate[];
  readonly candidateIndex: number;
  readonly candidateIdentity: string;
  /** Present only when a terminal branch was materialized before a capacity overflow. */
  readonly pendingBranch?: RevealBranch | undefined;
  readonly originalError: unknown;
}>;

export type RevealCandidateFailureHandler = (
  failure: RevealCandidateFailure,
) => Promise<void> | void;

export interface RevealQueueInput {
  readonly state: CampaignMatrixState;
  readonly route: RevealRoute;
  readonly reductionContext?: RevealReductionContext;
  readonly initialSurface: RevealSurface;
  readonly harness: RevealExecutionHarness;
  readonly controlFor: RevealControlFactory;
  readonly plansFor: (inventory: DomInventory) => readonly LiveControlPlan[];
  readonly candidatesFor: (
    inventory: DomInventory,
  ) => readonly RevealCandidate[];
  readonly maxDepth: number;
  readonly maxRevealMaterialEdges: number;
  readonly maxRevealActions: number;
  readonly maxControlsPerSegment: number;
  readonly onCandidateFailure?: RevealCandidateFailureHandler;
}

export type RevealPureQueueInput = Omit<RevealQueueInput, "harness">;

const preparationIdentityFor = (
  control: Pick<
    MatrixPreflightControl,
    "controlKey" | "revealPath" | "expectedSurface"
  >,
): string =>
  revealControlPreparationIdentityFor(
    control.controlKey,
    control.revealPath,
    control.expectedSurface,
  );

export const revealCandidateAlreadyProcessed = (
  state: RevealDiscoveryState,
  current: RevealBranch,
  candidate: RevealCandidate,
): boolean => {
  const identity = revealControlPreparationIdentityFor(
    candidate.action.controlKey,
    current.path,
    current.surface,
  );
  const existing = state.controls.find(
    (control) => preparationIdentityFor(control) === identity,
  )?.expectedActionTransition;
  if (existing !== undefined && existing !== null) return true;
  return current.path.steps.some(
    ({ controlKey, before, beforeUrl }) =>
      controlKey === candidate.action.controlKey &&
      before.digest === current.surface.digest &&
      beforeUrl === current.url,
  );
};

const exactPreparedControl = (
  controls: readonly MatrixPreflightControl[],
  identity: string,
  controlKey: string,
): MatrixPreflightControl => {
  const matches = controls.filter(
    (control) => preparationIdentityFor(control) === identity,
  );
  if (matches.length === 0)
    throw new RevealDiscoveryError(
      `Reveal transition source control is absent from exact preflight preparation: ${controlKey}`,
    );
  if (matches.length > 1)
    throw new RevealDiscoveryError(
      `Reveal transition has duplicate preflight preparation: ${controlKey}`,
    );
  const match = matches[0];
  if (match === undefined)
    throw new RevealDiscoveryError("Missing reveal control");
  return match;
};

const nextTransitionBinding = (
  match: MatrixPreflightControl,
  action: Action,
  transition: NonNullable<MatrixPreflightControl["expectedActionTransition"]>,
  expectedActionSurface: MatrixPreflightControl["expectedActionSurface"],
): Pick<
  MatrixPreflightControl,
  "expectedActionTransition" | "expectedActionSurface"
> => {
  if (
    (match.expectedActionTransition === null) !==
    (match.expectedActionSurface === null)
  )
    throw new RevealDiscoveryError(
      `Reveal transition and action-surface bindings are inconsistent: ${action.controlKey}`,
    );
  if (
    match.expectedActionTransition !== null &&
    match.expectedActionTransition.digest !== transition.digest
  )
    throw new RevealDiscoveryError(
      `Ambiguous reveal transition for control: ${action.controlKey}`,
    );
  if (
    match.expectedActionSurface !== null &&
    match.expectedActionSurface.digest !== transition.afterSurfaceDigest
  )
    throw new RevealDiscoveryError(
      `Ambiguous reveal action surface for control: ${action.controlKey}`,
    );
  if (expectedActionSurface?.digest !== transition.afterSurfaceDigest)
    throw new RevealDiscoveryError(
      `Reveal transition after-surface binding is missing: ${action.controlKey}`,
    );
  return {
    expectedActionTransition: match.expectedActionTransition ?? transition,
    expectedActionSurface: match.expectedActionSurface ?? expectedActionSurface,
  };
};

export const controlsWithTransition = (
  controls: readonly MatrixPreflightControl[],
  branch: RevealBranch,
  action: Action,
  transition: NonNullable<MatrixPreflightControl["expectedActionTransition"]>,
  expectedActionSurface: MatrixPreflightControl["expectedActionSurface"],
): readonly MatrixPreflightControl[] => {
  const identity = revealControlPreparationIdentityFor(
    action.controlKey,
    branch.path,
    branch.surface,
  );
  const match = exactPreparedControl(controls, identity, action.controlKey);
  const binding = nextTransitionBinding(
    match,
    action,
    transition,
    expectedActionSurface,
  );
  return controls.map((candidate) =>
    preparationIdentityFor(candidate) === identity
      ? { ...candidate, ...binding }
      : candidate,
  );
};

export { assertRevealControlCapacity } from "./preflight-reveal-branch-capacity.ts";
export { enqueueChangedBranch } from "./preflight-reveal-branch-enqueue.ts";
export { RevealCapacityOverflowError } from "./preflight-reveal-capacity-errors.ts";
