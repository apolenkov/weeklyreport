import { assertRevealPath } from "../../reveal-path.ts";
import * as reductionDiagnosis from "../guards/preflight-reveal-canonicalization-diagnosis.ts";
import {
  controlsForImmediateReveal,
  registerDynamicControls,
  registerVisitedRevealState,
  revealPathContainsState,
} from "../guards/preflight-reveal-registration.ts";
import { assertRevealControlCapacity } from "./preflight-reveal-branch-capacity.ts";
import {
  type RevealBranch,
  type RevealCandidate,
  type RevealDiscoveryState,
  type RevealPureQueueInput,
} from "./preflight-reveal-branches.ts";
import { RevealCapacityOverflowError } from "./preflight-reveal-capacity-errors.ts";
import { RevealDiscoveryError } from "./preflight-reveal-types.ts";

const knownBranchCountFor = (state: RevealDiscoveryState): number =>
  new Set([
    ...state.queue.map(({ path }) => path.digest),
    ...(state.currentBranch === undefined
      ? []
      : [state.currentBranch.path.digest]),
    ...state.controls.map(({ revealPath }) => revealPath.digest),
  ]).size;

export const enqueueChangedBranch = (input: {
  readonly queueInput: RevealPureQueueInput;
  readonly state: RevealDiscoveryState;
  readonly current: RevealBranch;
  readonly branch: RevealBranch;
  readonly action: RevealCandidate["action"];
}): RevealDiscoveryState => {
  const { queueInput, state, current, branch, action } = input;
  assertRevealControlCapacity(
    state.controls.length,
    queueInput.maxControlsPerSegment,
  );
  if (revealPathContainsState(current, branch)) return state;
  const visited = registerVisitedRevealState(state.visitedStatePaths, branch);
  if (!visited.isNew) return state;
  const reduction =
    reductionDiagnosis.independentDisclosureReductionDiagnosisForState({
      state,
      branch,
    });
  if (reduction.reason === "reduction-proven")
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
  const projectedControls = state.controls.length + plans.length;
  if (projectedControls > queueInput.maxControlsPerSegment)
    throw new RevealCapacityOverflowError({
      current,
      branch,
      state,
      action,
      message: `Reveal control bound exceeded: ${String(projectedControls)} controls; maxControlsPerSegment is ${String(queueInput.maxControlsPerSegment)}; reductionReason=${reduction.reason}${reductionDiagnosis.independentDisclosureReductionCapacityDetailsFor(reduction)}; pathDepth=${String(branch.path.steps.length)}; knownBranches=${String(knownBranchCountFor(state))}; plannedControls=${String(plans.length)}; projectedControls=${String(projectedControls)}`,
    });
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
