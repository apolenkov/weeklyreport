import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type { MatrixPreflightControl } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import type { DomInventory } from "../../../replay/dom/dom-inventory.ts";
import type { LiveControlPlan } from "../../../replay/live-control/live-control-planning.ts";
import type { Action } from "../../../source/contracts.ts";
import {
  assertRevealPath,
  revealControlPreparationIdentityFor,
  type RevealPath,
  type RevealSurface,
} from "../../reveal-path.ts";
import {
  candidatesForImmediateReveal,
  controlsForImmediateReveal,
  registerDynamicControls,
  registerVisitedRevealState,
  revealPathContainsState,
} from "../guards/preflight-reveal-registration.ts";
import { sameRevealSurfaceMaterial } from "../guards/reveal-surface-material.ts";
import { branchFor } from "./preflight-reveal-branch-execution.ts";
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
  readonly preparation:
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
}>;

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
  readonly maxBranches: number;
  readonly maxActions: number;
}

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

const controlsWithTransition = (
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

const enqueueChangedBranch = (input: {
  readonly queueInput: RevealQueueInput;
  readonly state: RevealDiscoveryState;
  readonly current: RevealBranch;
  readonly branch: RevealBranch;
}): RevealDiscoveryState => {
  const { queueInput, state, current, branch } = input;
  if (revealPathContainsState(current, branch)) return state;
  const visited = registerVisitedRevealState(state.visitedStatePaths, branch);
  if (!visited.isNew) return state;
  const registration = registerDynamicControls(
    state,
    branch,
    current,
    controlsForImmediateReveal(branch),
  );
  assertRevealPath(branch.path, branch.surface);
  const plans = queueInput
    .plansFor(branch.inventory)
    .filter(({ control }) =>
      registration.controls.some(
        ({ controlKey }) => controlKey === control.controlKey,
      ),
    );
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

export const processRevealQueue = async (
  input: RevealQueueInput,
  state: RevealDiscoveryState,
): Promise<RevealDiscoveryState> => {
  const [current, ...remaining] = state.queue;
  if (current === undefined) return state;
  const candidates = candidatesForImmediateReveal(input, current);
  const processed = await candidates.reduce<Promise<RevealDiscoveryState>>(
    (promise, candidate) =>
      promise.then((nextState) =>
        processRevealCandidate(input, current, nextState, candidate),
      ),
    Promise.resolve<RevealDiscoveryState>({ ...state, queue: remaining }),
  );
  return processRevealQueue(input, processed);
};

const processRevealCandidate = async (
  input: RevealQueueInput,
  current: RevealBranch,
  state: RevealDiscoveryState,
  candidate: RevealCandidate,
): Promise<RevealDiscoveryState> => {
  const identity = revealControlPreparationIdentityFor(
    candidate.action.controlKey,
    current.path,
    current.surface,
  );
  const existing = state.controls.find(
    (control) => preparationIdentityFor(control) === identity,
  )?.expectedActionTransition;
  if (existing !== undefined && existing !== null) return state;
  if (
    current.path.steps.some(
      ({ controlKey, before, beforeUrl }) =>
        controlKey === candidate.action.controlKey &&
        before.digest === current.surface.digest &&
        beforeUrl === current.url,
    )
  )
    return state;
  const actionCount = state.actionCount + current.path.steps.length + 1;
  if (actionCount > input.maxActions)
    throw new RevealDiscoveryError("Reveal action bound exceeded");
  const result = await branchFor({
    harness: input.harness,
    state: input.state,
    route: input.route,
    initialSurface: input.initialSurface,
    branch: current,
    candidate,
  });
  const branch = result.branch;
  const materialChanged =
    result.explore &&
    !(
      sameRevealSurfaceMaterial(current.surface, branch.surface) &&
      current.url === branch.url
    );
  const branchCount = state.branchCount + (materialChanged ? 1 : 0);
  const transitioned = {
    ...state,
    controls: controlsWithTransition(
      state.controls,
      current,
      candidate.action,
      result.transition,
      result.branch.surface,
    ),
    actionCount,
    branchCount,
  };
  if (materialChanged && branchCount > input.maxBranches)
    throw new RevealDiscoveryError("Reveal branch bound exceeded");
  if (!materialChanged) return transitioned;
  return enqueueChangedBranch({
    queueInput: input,
    state: transitioned,
    current,
    branch,
  });
};
