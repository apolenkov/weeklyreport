import { stableSerialize } from "../../../support/ids.ts";
import type {
  RevealPath,
  RevealSurface,
  RevealSurfaceControl,
} from "../../reveal-path.ts";
import type {
  RevealBranch,
  RevealDiscoveryState,
} from "../interaction/preflight-reveal-branches.ts";
import {
  type RevealSurfaceMaterial,
  revealSurfaceMaterialFor,
  sameRevealSurfaceMaterial,
} from "./reveal-surface-material.ts";

const MIN_CANONICALIZATION_DEPTH = 3;

type BranchView = Readonly<Pick<RevealBranch, "path" | "surface" | "url">>;

const SCOPED_DISCLOSURE_TRANSITIONS = new Set(["none", "open", "cancel"]);

type ToggleBinding = Readonly<{
  readonly controlKey: string;
  readonly targetId: string;
}>;

type MaterialControl = RevealSurfaceMaterial["controls"][number];

type BindingPair = Readonly<{
  readonly left: ToggleBinding;
  readonly right: ToggleBinding;
  readonly leftIndex: number;
  readonly rightIndex: number;
}>;

interface MaterialUnionState {
  readonly controls: Map<string, MaterialControl>;
  readonly changed: Map<string, string>;
}

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

const sequenceFor = (path: RevealPath): readonly string[] =>
  path.steps.map(({ controlKey }) => controlKey);

const sourceControlFor = (
  surface: RevealSurface,
  controlKey: string,
): RevealSurfaceControl | undefined =>
  surface.controls.find((control) => control.controlKey === controlKey);

const hasModalOrBackgroundControl = (surface: RevealSurface): boolean =>
  surface.controls.some(
    ({ keyboardFocusScope }) =>
      keyboardFocusScope === "active-modal" ||
      keyboardFocusScope === "background",
  );

const toggleBindingForStep = (
  step: RevealPath["steps"][number],
): ToggleBinding | undefined => {
  if (
    step.operation !== "click" ||
    step.safety !== "read-only" ||
    !SCOPED_DISCLOSURE_TRANSITIONS.has(step.transition) ||
    step.beforeUrl !== step.afterUrl ||
    hasModalOrBackgroundControl(step.before)
  )
    return undefined;

  const source = sourceControlFor(step.before, step.controlKey);
  const after = sourceControlFor(step.after, step.controlKey);
  const targetId = source?.ariaControls;
  if (
    source === undefined ||
    after === undefined ||
    source.ariaRole !== "button" ||
    !source.enabled ||
    source.interactionEffect === "mutation-required" ||
    source.disclosureIndependence !== "source-bound-row-local" ||
    after.disclosureIndependence !== "source-bound-row-local" ||
    typeof targetId !== "string" ||
    targetId.length === 0 ||
    /\s/u.test(targetId) ||
    typeof source.ariaExpanded !== "boolean" ||
    typeof after.ariaExpanded !== "boolean" ||
    after.ariaExpanded === source.ariaExpanded
  )
    return undefined;

  return { controlKey: step.controlKey, targetId };
};

const toggleBindingsFor = (
  path: RevealPath,
): readonly ToggleBinding[] | undefined => {
  const bindings = path.steps.map(toggleBindingForStep);
  return bindings.every(isDefined) ? bindings : undefined;
};

const uniqueBindingsFor = (bindings: readonly ToggleBinding[]): boolean =>
  new Set(bindings.map(({ controlKey }) => controlKey)).size ===
    bindings.length &&
  new Set(bindings.map(({ targetId }) => targetId)).size === bindings.length;

const branchForSequence = (
  knownBranches: readonly BranchView[],
  initialUrl: string,
  sequence: readonly string[],
): BranchView | undefined => {
  const matches = knownBranches.filter(
    (branch) =>
      branch.path.initialUrl === initialUrl &&
      stableSerialize(sequenceFor(branch.path)) === stableSerialize(sequence),
  );
  const first = matches[0];
  if (first === undefined) return undefined;
  return matches.every(
    (match) =>
      match.url === first.url &&
      sameRevealSurfaceMaterial(match.surface, first.surface),
  )
    ? first
    : undefined;
};

const materialControlsByKeyFor = (
  material: RevealSurfaceMaterial,
): ReadonlyMap<string, MaterialControl> =>
  new Map(material.controls.map((control) => [control.controlKey, control]));

const rootOrderIsStable = (
  root: RevealSurfaceMaterial,
  actual: RevealSurfaceMaterial,
): boolean => {
  const rootKeys = root.controls.map(({ controlKey }) => controlKey);
  const actualRootKeys = actual.controls
    .map(({ controlKey }) => controlKey)
    .filter((controlKey) => rootKeys.includes(controlKey));
  return stableSerialize(actualRootKeys) === stableSerialize(rootKeys);
};

const mergeMaterialControl = (
  state: MaterialUnionState,
  control: MaterialControl,
): boolean => {
  const signature = stableSerialize(control);
  const current = state.controls.get(control.controlKey);
  if (current !== undefined && stableSerialize(current) === signature)
    return true;
  const previousChange = state.changed.get(control.controlKey);
  if (previousChange !== undefined && previousChange !== signature)
    return false;
  state.changed.set(control.controlKey, signature);
  state.controls.set(control.controlKey, control);
  return true;
};

const mergeSingleMaterial = (
  state: MaterialUnionState,
  root: RevealSurfaceMaterial,
  single: BranchView,
): boolean => {
  const material = revealSurfaceMaterialFor(single.surface);
  const rootControlsByKey = materialControlsByKeyFor(root);
  const controlsByKey = materialControlsByKeyFor(material);
  if (!root.controls.every(({ controlKey }) => controlsByKey.has(controlKey)))
    return false;
  return material.controls.every((control) => {
    const rootControl = rootControlsByKey.get(control.controlKey);
    return rootControl !== undefined &&
      stableSerialize(rootControl) === stableSerialize(control)
      ? true
      : mergeMaterialControl(state, control);
  });
};

const unionMaterialFor = (
  root: RevealSurfaceMaterial,
  singles: readonly BranchView[],
): ReadonlyMap<string, MaterialControl> | undefined => {
  const state: MaterialUnionState = {
    controls: new Map(
      root.controls.map((control) => [control.controlKey, control]),
    ),
    changed: new Map(),
  };
  return singles.every((single) => mergeSingleMaterial(state, root, single))
    ? state.controls
    : undefined;
};

const matchesUnion = (input: {
  readonly root: RevealSurfaceMaterial;
  readonly singles: readonly BranchView[];
  readonly actual: RevealSurfaceMaterial;
}): boolean => {
  const expected = unionMaterialFor(input.root, input.singles);
  if (!expected) return false;
  if (
    input.actual.controls.length !== expected.size ||
    !rootOrderIsStable(input.root, input.actual)
  )
    return false;
  return input.actual.controls.every((control) => {
    const expectedControl = expected.get(control.controlKey);
    return (
      expectedControl !== undefined &&
      stableSerialize(expectedControl) === stableSerialize(control)
    );
  });
};

const bindingPairsFor = (
  bindings: readonly ToggleBinding[],
): readonly BindingPair[] =>
  bindings.flatMap((left, leftIndex) =>
    bindings.slice(leftIndex + 1).map((right, offset) => ({
      left,
      right,
      leftIndex,
      rightIndex: leftIndex + offset + 1,
    })),
  );

const pairOrderEquivalentFor = (input: {
  readonly pair: BindingPair;
  readonly knownBranches: readonly BranchView[];
  readonly initialUrl: string;
  readonly root: RevealSurfaceMaterial;
  readonly singles: readonly BranchView[];
}): boolean => {
  const { pair } = input;
  const forward = branchForSequence(input.knownBranches, input.initialUrl, [
    pair.left.controlKey,
    pair.right.controlKey,
  ]);
  const reverse = branchForSequence(input.knownBranches, input.initialUrl, [
    pair.right.controlKey,
    pair.left.controlKey,
  ]);
  const leftSingle = input.singles[pair.leftIndex];
  const rightSingle = input.singles[pair.rightIndex];
  if (
    forward === undefined ||
    reverse === undefined ||
    leftSingle === undefined ||
    rightSingle === undefined ||
    forward.url !== input.initialUrl ||
    reverse.url !== input.initialUrl ||
    !sameRevealSurfaceMaterial(forward.surface, reverse.surface)
  )
    return false;
  return matchesUnion({
    root: input.root,
    singles: [leftSingle, rightSingle],
    actual: revealSurfaceMaterialFor(forward.surface),
  });
};

const knownBranchesFor = (
  state: RevealDiscoveryState,
): readonly BranchView[] => {
  const views: BranchView[] = [...state.queue];
  if (state.currentBranch !== undefined) views.push(state.currentBranch);
  const fromControls = new Map<string, BranchView>();
  for (const control of state.controls) {
    const path = control.revealPath;
    const url = path.steps.at(-1)?.afterUrl ?? path.initialUrl;
    if (!fromControls.has(path.digest))
      fromControls.set(path.digest, {
        path,
        surface: control.expectedSurface,
        url,
      });
  }
  return [...views, ...fromControls.values()];
};

export const independentDisclosureReductionFor = (input: {
  readonly branch: BranchView;
  readonly knownBranches: readonly BranchView[];
}): boolean => {
  const steps = input.branch.path.steps;
  if (steps.length < MIN_CANONICALIZATION_DEPTH) return false;
  const bindings = toggleBindingsFor(input.branch.path);
  if (bindings === undefined || !uniqueBindingsFor(bindings)) return false;
  const initialUrl = input.branch.path.initialUrl;
  const rootMaterial = revealSurfaceMaterialFor(
    steps[0]?.before ?? input.branch.surface,
  );
  const resolvedSingles = bindings
    .map(({ controlKey }) =>
      branchForSequence(input.knownBranches, initialUrl, [controlKey]),
    )
    .filter(isDefined);
  if (
    resolvedSingles.length !== bindings.length ||
    !resolvedSingles.every((branch) => branch.url === initialUrl) ||
    !matchesUnion({
      root: rootMaterial,
      singles: resolvedSingles,
      actual: revealSurfaceMaterialFor(input.branch.surface),
    })
  )
    return false;
  return bindingPairsFor(bindings).every((pair) =>
    pairOrderEquivalentFor({
      pair,
      knownBranches: input.knownBranches,
      initialUrl,
      root: rootMaterial,
      singles: resolvedSingles,
    }),
  );
};

export const independentDisclosureReductionForState = (input: {
  readonly state: RevealDiscoveryState;
  readonly branch: BranchView;
}): boolean =>
  independentDisclosureReductionFor({
    branch: input.branch,
    knownBranches: knownBranchesFor(input.state),
  });
