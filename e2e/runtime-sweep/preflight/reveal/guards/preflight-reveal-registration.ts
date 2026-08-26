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
import { isSourceBoundDisclosureControl } from "./preflight-reveal-canonicalization.ts";
import {
  revealSurfaceMaterialControlFor,
  revealSurfaceMaterialFor,
  revealSurfaceMaterialIdentityFor,
  revealSurfaceMaterialSignatureFor,
} from "./reveal-surface-material.ts";

type MaterialControl = ReturnType<typeof revealSurfaceMaterialControlFor>;

const materialIdentityFor = (
  control: RevealSurface["controls"][number],
): string =>
  revealSurfaceMaterialIdentityFor(revealSurfaceMaterialControlFor(control));

const uniqueMaterialControlsFor = (
  controls: readonly MaterialControl[],
): ReadonlyMap<string, MaterialControl> | undefined => {
  const result = new Map<string, MaterialControl>();
  for (const control of controls) {
    const identity = revealSurfaceMaterialIdentityFor(control);
    if (result.has(identity)) return undefined;
    result.set(identity, control);
  }
  return result;
};

export const controlsForImmediateReveal = (
  branch: RevealBranch,
): readonly RevealSurface["controls"][number][] => {
  const step = branch.path.steps.at(-1);
  if (step === undefined || step.beforeUrl !== step.afterUrl)
    return branch.surface.controls;
  const previousMaterial = revealSurfaceMaterialFor(step.before);
  const currentMaterial = revealSurfaceMaterialFor(branch.surface);
  const previous = uniqueMaterialControlsFor(previousMaterial.controls);
  const current = uniqueMaterialControlsFor(currentMaterial.controls);
  if (previous === undefined || current === undefined)
    return branch.surface.controls;
  const sharedControlKeys = new Set(
    currentMaterial.controls
      .map(revealSurfaceMaterialIdentityFor)
      .filter((identity) => previous.has(identity)),
  );
  const relativeOrderFor = (
    controls: readonly MaterialControl[],
  ): readonly string[] =>
    controls
      .map(revealSurfaceMaterialIdentityFor)
      .filter((identity) => sharedControlKeys.has(identity));
  if (
    stableSerialize(relativeOrderFor(previousMaterial.controls)) !==
    stableSerialize(relativeOrderFor(currentMaterial.controls))
  )
    return branch.surface.controls;
  const changedIdentities = new Set(
    currentMaterial.controls.flatMap((control) => {
      const identity = revealSurfaceMaterialIdentityFor(control);
      const prior = previous.get(identity);
      return prior === undefined ||
        revealSurfaceMaterialSignatureFor(prior) !==
          revealSurfaceMaterialSignatureFor(control)
        ? [identity]
        : [];
    }),
  );
  return branch.surface.controls.filter((control) =>
    changedIdentities.has(materialIdentityFor(control)),
  );
};

const controlsForDirectedDisclosurePairs = (
  branch: RevealBranch,
): readonly RevealSurface["controls"][number][] => {
  const step = branch.path.steps.at(-1);
  if (step === undefined || step.beforeUrl !== step.afterUrl) return [];
  const source = step.before.controls.find(
    ({ controlKey }) => controlKey === step.controlKey,
  );
  return isSourceBoundDisclosureControl(source)
    ? branch.surface.controls.filter(isSourceBoundDisclosureControl)
    : [];
};

export const candidatesForImmediateReveal = (
  input: Pick<RevealQueueInput, "candidatesFor">,
  branch: RevealBranch,
): readonly RevealCandidate[] => {
  const eligibleKeys = new Set(
    [
      ...controlsForImmediateReveal(branch),
      ...controlsForDirectedDisclosurePairs(branch),
    ].map(({ controlKey }) => controlKey),
  );
  return input
    .candidatesFor(branch.inventory)
    .filter(({ control }) => eligibleKeys.has(control.controlKey));
};

type RevealState = Pick<RevealBranch, "surface" | "url">;
type RevealStatePath = Pick<RevealBranch, "path" | "surface" | "url">;

const revealStateIdentityFor = (branch: RevealState): string =>
  `${revealSurfaceMaterialFor(branch.surface).digest}:${branch.url}`;

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
          revealStateIdentityFor({
            surface: first.before,
            url: current.path.initialUrl,
          }),
          ...current.path.steps.map(({ after, afterUrl }) =>
            revealStateIdentityFor({ surface: after, url: afterUrl }),
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
