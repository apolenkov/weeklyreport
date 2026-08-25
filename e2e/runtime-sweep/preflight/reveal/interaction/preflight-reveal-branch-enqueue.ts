import { stableSerialize } from "../../../support/ids.ts";
import {
  assertRevealPath,
  revealControlPreparationIdentityFor,
  surfaceSignatureFor,
} from "../../reveal-path.ts";
import * as reductionDiagnosis from "../guards/preflight-reveal-canonicalization-diagnosis.ts";
import {
  controlsForImmediateReveal,
  registerDynamicControls,
  registerVisitedRevealState,
  revealPathContainsState,
} from "../guards/preflight-reveal-registration.ts";
import {
  revealSurfaceMaterialControlFor,
  revealSurfaceMaterialIdentityFor,
  revealSurfaceMaterialSignatureFor,
} from "../guards/reveal-surface-material.ts";
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

type RetainedControl = RevealDiscoveryState["controls"][number];
type SourceBoundControl = RevealBranch["surface"]["controls"][number];

const retainedControlIdentityFor = (
  control: Pick<
    RetainedControl,
    "controlKey" | "revealPath" | "expectedSurface"
  >,
): string =>
  revealControlPreparationIdentityFor(
    control.controlKey,
    control.revealPath,
    control.expectedSurface,
  );

const sourceBoundMaterialIdentityFor = (
  control: SourceBoundControl,
): string | undefined => {
  if (
    control.disclosureIndependence !== "source-bound-row-local" ||
    control.ariaControls === undefined ||
    control.ariaControls === null
  )
    return undefined;
  const materialControl = revealSurfaceMaterialControlFor(control);
  return stableSerialize({
    identity: revealSurfaceMaterialIdentityFor(materialControl),
    signature: revealSurfaceMaterialSignatureFor(materialControl),
  });
};

type RetainedRepresentative = Readonly<{
  readonly control: RetainedControl;
  readonly representative: SourceBoundControl;
}>;

const retainedRepresentativeFor = (input: {
  readonly state: RevealDiscoveryState;
  readonly control: SourceBoundControl;
}): RetainedRepresentative | undefined => {
  const materialIdentity = sourceBoundMaterialIdentityFor(input.control);
  if (materialIdentity === undefined) return undefined;
  const retainedMatches = input.state.controls.filter(
    ({ inventory }) =>
      inventory.ariaControls === input.control.ariaControls &&
      inventory.disclosureIndependence === input.control.disclosureIndependence,
  );
  if (retainedMatches.length !== 1) return undefined;
  const control = retainedMatches.at(0);
  if (control === undefined) return undefined;
  const representatives = control.expectedSurface.controls.filter(
    (representative) =>
      sourceBoundMaterialIdentityFor(representative) === materialIdentity,
  );
  if (representatives.length !== 1) return undefined;
  const representative = representatives.at(0);
  return representative === undefined ? undefined : { control, representative };
};

const hasRetainedControlFor = (input: {
  readonly state: RevealDiscoveryState;
  readonly control: SourceBoundControl;
}): boolean => {
  const retained = retainedRepresentativeFor({
    state: input.state,
    control: input.control,
  });
  if (retained === undefined) return false;
  const identity = retainedControlIdentityFor(retained.control);
  const discovered = input.state.discovered.get(identity);
  if (discovered === undefined) return false;
  if (
    discovered.signature !== surfaceSignatureFor(retained.representative) ||
    discovered.pathDigest !== retained.control.revealPath.digest ||
    discovered.surfaceDigest !== retained.control.expectedSurface.digest
  )
    return false;
  return (
    input.state.controls.filter(
      (control) => retainedControlIdentityFor(control) === identity,
    ).length === 1
  );
};

const allImmediateControlsRetainedFor = (input: {
  readonly state: RevealDiscoveryState;
  readonly controls: readonly RevealBranch["surface"]["controls"][number][];
}): boolean =>
  input.controls.every((control) =>
    hasRetainedControlFor({
      state: input.state,
      control,
    }),
  );

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
  const immediateControls = controlsForImmediateReveal(branch);
  const reduction =
    reductionDiagnosis.independentDisclosureReductionDiagnosisForState({
      state,
      branch,
    });
  if (
    reduction.reason === "reduction-proven" &&
    allImmediateControlsRetainedFor({
      state,
      controls: immediateControls,
    })
  )
    return {
      ...state,
      visitedStatePaths: visited.visitedStatePaths,
    };
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
