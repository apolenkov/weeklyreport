import { stableSerialize } from "../../../support/ids.ts";
import {
  revealControlPreparationIdentityFor,
  type RevealSurface,
  surfaceSignatureFor,
} from "../../reveal-path.ts";
import type {
  RevealBranch,
  RevealCandidate,
  RevealDiscoveryState,
  RevealQueueInput,
} from "../interaction/preflight-reveal-branches.ts";
import { RevealDiscoveryError } from "../interaction/preflight-reveal-types.ts";

export const controlsForImmediateReveal = (
  branch: RevealBranch,
): readonly RevealSurface["controls"][number][] => {
  const step = branch.path.steps.at(-1);
  if (step === undefined || step.beforeUrl !== step.afterUrl)
    return branch.surface.controls;
  const previous = new Map(
    step.before.controls.map((control) => [control.controlKey, control]),
  );
  return branch.surface.controls.filter((control) => {
    const prior = previous.get(control.controlKey);
    return (
      prior === undefined ||
      surfaceSignatureFor(prior) !== surfaceSignatureFor(control)
    );
  });
};

export const candidatesForImmediateReveal = (
  input: Pick<RevealQueueInput, "candidatesFor">,
  branch: RevealBranch,
): readonly RevealCandidate[] => {
  const eligibleKeys = new Set(
    controlsForImmediateReveal(branch).map(({ controlKey }) => controlKey),
  );
  return input
    .candidatesFor(branch.inventory)
    .filter(({ control }) => eligibleKeys.has(control.controlKey));
};

type RevealState = Pick<RevealBranch, "surface" | "url">;
type RevealStatePath = Pick<RevealBranch, "path" | "surface" | "url">;

const revealStateIdentityFor = (branch: RevealState): string =>
  `${branch.surface.digest}:${branch.url}`;

export const revealStatePathIdentityFor = (branch: RevealStatePath): string =>
  revealStateIdentityFor(branch);

export const revealPathContainsState = (
  current: RevealStatePath,
  candidate: RevealState,
): boolean => {
  const first = current.path.steps[0];
  const identities =
    first === undefined
      ? [revealStateIdentityFor(current)]
      : [
          `${first.before.digest}:${current.path.initialUrl}`,
          ...current.path.steps.map(
            ({ after, afterUrl }) => `${after.digest}:${afterUrl}`,
          ),
        ];
  return identities.includes(revealStateIdentityFor(candidate));
};

export const registerVisitedRevealState = (
  visitedStatePaths: ReadonlyMap<string, string>,
  branch: RevealStatePath,
): Readonly<{
  readonly visitedStatePaths: ReadonlyMap<string, string>;
  readonly isNew: boolean;
}> => {
  const statePathIdentity = revealStatePathIdentityFor(branch);
  const existingPath = visitedStatePaths.get(statePathIdentity);
  if (existingPath !== undefined) return { visitedStatePaths, isNew: false };
  return {
    visitedStatePaths: new Map([
      ...visitedStatePaths.entries(),
      [statePathIdentity, branch.path.digest],
    ]),
    isNew: true,
  };
};

type ControlRegistration = Readonly<{
  readonly discovered: RevealDiscoveryState["discovered"];
  readonly controls: readonly RevealSurface["controls"][number][];
}>;

const assertPersistentSignatures = (
  branch: RevealBranch,
  current: RevealBranch,
): void => {
  if (current.path.digest !== branch.path.digest) return;
  const previousControls = new Map(
    current.surface.controls.map((control) => [control.controlKey, control]),
  );
  const changed = branch.surface.controls
    .filter((control) => {
      const previous = previousControls.get(control.controlKey);
      return (
        previous !== undefined &&
        surfaceSignatureFor(previous) !== surfaceSignatureFor(control)
      );
    })
    .map(({ controlKey }) => controlKey)
    .toSorted((left, right) => left.localeCompare(right));
  if (changed.length > 0)
    throw new RevealDiscoveryError(
      `Reveal control signature changed: ${changed.join(", ")}`,
    );
};

const registerSurfaceControl = (
  branch: RevealBranch,
  result: ControlRegistration,
  surfaceControl: RevealSurface["controls"][number],
): ControlRegistration => {
  const signature = surfaceSignatureFor(surfaceControl);
  const pathDigest = branch.path.digest;
  const surfaceDigest = branch.surface.digest;
  const identity = revealControlPreparationIdentityFor(
    surfaceControl.controlKey,
    branch.path,
    branch.surface,
  );
  const existing = result.discovered.get(identity);
  if (
    existing !== undefined &&
    (existing.signature !== signature ||
      existing.pathDigest !== pathDigest ||
      existing.surfaceDigest !== surfaceDigest)
  )
    throw new RevealDiscoveryError(
      `Reveal control signature changed: ${surfaceControl.controlKey}`,
    );
  if (existing !== undefined) return result;
  return {
    discovered: new Map([
      ...result.discovered.entries(),
      [identity, { signature, pathDigest, surfaceDigest }],
    ]),
    controls: [...result.controls, surfaceControl],
  };
};

export const registerDynamicControls = (
  state: RevealDiscoveryState,
  branch: RevealBranch,
  current: RevealBranch,
  controls: readonly RevealSurface["controls"][number][] = branch.surface
    .controls,
): Readonly<{
  readonly state: RevealDiscoveryState;
  readonly controls: readonly RevealSurface["controls"][number][];
}> => {
  assertPersistentSignatures(branch, current);
  const registration = controls.reduce<ControlRegistration>(
    (result, control) => registerSurfaceControl(branch, result, control),
    { discovered: state.discovered, controls: [] },
  );
  return {
    state: { ...state, discovered: registration.discovered },
    controls: registration.controls,
  };
};

export const sameRevealSurface = (
  left: RevealSurface,
  right: RevealSurface,
): boolean => stableSerialize(left) === stableSerialize(right);
