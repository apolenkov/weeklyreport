import type { MatrixPreflightControl } from "../../../matrix/finalization/matrix-finalizer-preflight-contract.ts";
import { revealTransitionFor } from "../../../matrix/reveal-transition.ts";
import type { RevealDiscoveryState } from "../../reveal/interaction/preflight-reveal-branches.ts";
import {
  revealControlPreparationIdentityFor,
  revealSurfaceFor,
  surfaceSignatureFor,
} from "../../reveal-path.ts";

const R191_QUEUE_COUNT = 903;
export const R191_SURFACE_CONTROL_COUNT = 119;
const R191_ACTION_COUNT = 2870;
const R191_BRANCH_COUNT = 982;
export const MAX_ARTIFACT_BYTES = 8_388_608;
const DOM_ORDER_WIDTH = 5;

export const amplifiedStateFor = (
  state: RevealDiscoveryState,
  controlCount: number,
): RevealDiscoveryState => {
  const control = state.controls[0];
  const branch = state.currentBranch ?? state.queue[0];
  if (control === undefined || branch === undefined)
    throw new Error("Scale fixture requires one control and one branch");
  return {
    ...state,
    controls: Array.from({ length: controlCount }, () => control),
    queue: Array.from({ length: R191_QUEUE_COUNT }, () => branch),
    actionCount: R191_ACTION_COUNT,
    branchCount: R191_BRANCH_COUNT,
  };
};

const distinctControlFor = (
  control: MatrixPreflightControl,
  index: number,
): MatrixPreflightControl => {
  const controlKey = `${control.controlKey}:scale:${String(index)}`;
  const expectedSurface = revealSurfaceFor(
    control.expectedSurface.controls.map((surfaceControl) =>
      surfaceControl.controlKey === control.controlKey
        ? { ...surfaceControl, controlKey }
        : surfaceControl,
    ),
  );
  return {
    ...control,
    controlKey,
    inventory: {
      ...control.inventory,
      domOrderKey: `${String(index).padStart(DOM_ORDER_WIDTH, "0")}:${controlKey}`,
      order: index,
    },
    expectedSurface,
    ...(control.action === undefined
      ? {}
      : { action: { ...control.action, controlKey } }),
  };
};

export const distinctStateFor = (
  state: RevealDiscoveryState,
  controlCount: number,
): RevealDiscoveryState => {
  const template = state.controls[0];
  if (template === undefined)
    throw new Error("Scale fixture requires one control template");
  const controls = Array.from({ length: controlCount }, (_, index) =>
    distinctControlFor(template, index),
  );
  const discovered = new Map(
    controls.map((control) => {
      const surfaceControl = control.expectedSurface.controls.find(
        ({ controlKey }) => controlKey === control.controlKey,
      );
      if (surfaceControl === undefined)
        throw new Error("Scale control is absent from its surface");
      return [
        revealControlPreparationIdentityFor(
          control.controlKey,
          control.revealPath,
          control.expectedSurface,
        ),
        {
          signature: surfaceSignatureFor(surfaceControl),
          pathDigest: control.revealPath.digest,
          surfaceDigest: control.expectedSurface.digest,
        },
      ] as const;
    }),
  );
  return { ...state, controls, discovered };
};

export const coherentSegmentStateFor = (
  state: RevealDiscoveryState,
  controlCount: number,
): RevealDiscoveryState => {
  const distinct = distinctStateFor(state, controlCount);
  const surface = revealSurfaceFor(
    distinct.controls.map((control) => {
      const surfaceControl = control.expectedSurface.controls.find(
        ({ controlKey }) => controlKey === control.controlKey,
      );
      if (surfaceControl === undefined)
        throw new Error("Scale control is absent from its surface");
      return surfaceControl;
    }),
  );
  const controls = distinct.controls.map((control) => {
    const transition = control.expectedActionTransition;
    const action = control.action;
    return {
      ...control,
      expectedSurface: surface,
      ...(transition === null || action === undefined
        ? {}
        : {
            expectedActionTransition: revealTransitionFor(
              action,
              surface,
              surface,
              transition.beforeUrl,
              transition.afterUrl,
              transition.nonMutation,
              transition.representativeInput,
            ),
            expectedActionSurface: surface,
          }),
    };
  });
  const discovered = new Map(
    controls.map((control) => {
      const surfaceControl = surface.controls.find(
        ({ controlKey }) => controlKey === control.controlKey,
      );
      if (surfaceControl === undefined)
        throw new Error("Scale control is absent from the shared surface");
      return [
        revealControlPreparationIdentityFor(
          control.controlKey,
          control.revealPath,
          control.expectedSurface,
        ),
        {
          signature: surfaceSignatureFor(surfaceControl),
          pathDigest: control.revealPath.digest,
          surfaceDigest: surface.digest,
        },
      ] as const;
    }),
  );
  return { ...distinct, controls, discovered };
};

export const completedStateFor = (
  state: RevealDiscoveryState,
): RevealDiscoveryState => {
  const {
    currentBranch: _currentBranch,
    currentCandidates: _currentCandidates,
    currentCandidateIndex: _currentCandidateIndex,
    ...rest
  } = state;
  return { ...rest, queue: [] };
};
