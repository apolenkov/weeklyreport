import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type { MatrixPreflightControl } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import type { RevealTransition } from "../../../matrix/reveal-transition.ts";
import type { DomInventory } from "../../../replay/dom/dom-inventory.ts";
import type { LiveControlPlan } from "../../../replay/live-control/live-control-planning.ts";
import type { Action } from "../../../source/contracts.ts";
import {
  assertRevealPath,
  revealControlPreparationIdentityFor,
  type RevealPath,
  type RevealSurface,
} from "../../reveal-path.ts";
import { independentDisclosureReductionForState } from "../guards/preflight-reveal-canonicalization.ts";
import {
  controlsForImmediateReveal,
  registerDynamicControls,
  registerVisitedRevealState,
  revealPathContainsState,
} from "../guards/preflight-reveal-registration.ts";
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
  readonly originalError: unknown;
}>;

export type RevealCandidateFailureHandler = (
  failure: RevealCandidateFailure,
) => Promise<void> | void;

export interface RevealQueueInput {
  readonly state: CampaignMatrixState;
  readonly route: RevealRoute;
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

export const assertRevealControlCapacity = (
  count: number,
  maxControlsPerSegment: number,
): void => {
  if (!Number.isSafeInteger(maxControlsPerSegment) || maxControlsPerSegment < 1)
    throw new RevealDiscoveryError(
      "Reveal control bound must be a positive integer",
    );
  if (count > maxControlsPerSegment)
    throw new RevealDiscoveryError(
      `Reveal control bound exceeded: ${String(count)} controls; maxControlsPerSegment is ${String(maxControlsPerSegment)}`,
    );
};

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

export const enqueueChangedBranch = (input: {
  readonly queueInput: RevealPureQueueInput;
  readonly state: RevealDiscoveryState;
  readonly current: RevealBranch;
  readonly branch: RevealBranch;
}): RevealDiscoveryState => {
  const { queueInput, state, current, branch } = input;
  assertRevealControlCapacity(
    state.controls.length,
    queueInput.maxControlsPerSegment,
  );
  if (revealPathContainsState(current, branch)) return state;
  const visited = registerVisitedRevealState(state.visitedStatePaths, branch);
  if (!visited.isNew) return state;
  if (
    independentDisclosureReductionForState({
      state,
      branch,
    })
  )
    return {
      ...state,
      visitedStatePaths: visited.visitedStatePaths,
    };
  const immediateControls = controlsForImmediateReveal(branch);
  const registration = registerDynamicControls(
    state,
    branch,
    current,
    immediateControls,
  );
  const plans = queueInput
    .plansFor(branch.inventory)
    .filter(({ control }) =>
      registration.controls.some(
        ({ controlKey }) => controlKey === control.controlKey,
      ),
    );
  assertRevealControlCapacity(
    state.controls.length + plans.length,
    queueInput.maxControlsPerSegment,
  );
  assertRevealPath(branch.path, branch.surface);
  const prepared = plans.map((plan) =>
    queueInput.controlFor(plan, branch.path, branch.surface, null, null),
  );
  if (current.path.steps.length >= queueInput.maxDepth)
    throw new RevealDiscoveryError("Reveal depth bound exceeded");
  return {
    ...state,
    queue: [...state.queue, branch],
    controls: [...state.controls, ...prepared],
    discovered: registration.state.discovered,
    visitedStatePaths: visited.visitedStatePaths,
  };
};
