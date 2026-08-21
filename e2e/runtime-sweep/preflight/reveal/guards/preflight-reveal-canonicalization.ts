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
  matchesUnion,
  type RevealSurfaceMaterial,
  revealSurfaceMaterialFor,
  sameRevealSurfaceMaterial,
} from "./reveal-surface-material.ts";

const MIN_CANONICALIZATION_DEPTH = 3;
const SOURCE_BOUND_ROW_LOCAL = "source-bound-row-local" as const;

type BranchView = Readonly<Pick<RevealBranch, "path" | "surface" | "url">>;

type IndependentDisclosureReductionReason =
  | "depth-too-shallow"
  | "step-not-eligible"
  | "bindings-not-unique"
  | "single-branch-missing"
  | "single-branch-material-or-url-mismatch"
  | "pair-order-missing-or-mismatch"
  | "union-mismatch"
  | "reduction-proven";

export type IndependentDisclosureReductionDiagnosis = Readonly<
  | {
      readonly eligible: false;
      readonly reason: Exclude<
        IndependentDisclosureReductionReason,
        "reduction-proven"
      >;
    }
  | { readonly eligible: true; readonly reason: "reduction-proven" }
>;

const SCOPED_DISCLOSURE_TRANSITIONS = new Set(["none", "open", "cancel"]);

type ToggleBinding = Readonly<{
  readonly identity: string;
  readonly targetId: string;
}>;

type BindingPair = Readonly<{
  readonly left: ToggleBinding;
  readonly right: ToggleBinding;
  readonly leftIndex: number;
  readonly rightIndex: number;
}>;

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

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

const isSourceBoundDisclosure = (
  control: RevealSurfaceControl | undefined,
): control is RevealSurfaceControl =>
  control?.ariaRole === "button" &&
  control.enabled &&
  control.interactionEffect !== "mutation-required" &&
  control.disclosureIndependence === SOURCE_BOUND_ROW_LOCAL;

const hasValidTargetId = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.length > 0 && !/\s/u.test(value);

const sourceBoundIdentityFor = (targetId: string): string =>
  `source-bound-target:${targetId}`;

const sequenceKeyForStep = (step: RevealPath["steps"][number]): string => {
  const source = sourceControlFor(step.before, step.controlKey);
  return isSourceBoundDisclosure(source) &&
    hasValidTargetId(source.ariaControls)
    ? sourceBoundIdentityFor(source.ariaControls)
    : step.controlKey;
};

const sequenceFor = (path: RevealPath): readonly string[] =>
  path.steps.map(sequenceKeyForStep);

const sourceBoundAfterControlFor = (
  step: RevealPath["steps"][number],
  targetId: string,
): RevealSurfaceControl | undefined => {
  const matches = step.after.controls.filter(
    (control) =>
      control.ariaControls === targetId &&
      control.disclosureIndependence === SOURCE_BOUND_ROW_LOCAL,
  );
  return matches.length === 1 ? matches[0] : undefined;
};

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
  if (!isSourceBoundDisclosure(source)) return undefined;
  const targetId = source.ariaControls;
  if (!hasValidTargetId(targetId) || typeof source.ariaExpanded !== "boolean")
    return undefined;
  const beforeMatches = step.before.controls.filter(
    (control) =>
      isSourceBoundDisclosure(control) && control.ariaControls === targetId,
  );
  if (beforeMatches.length !== 1 || beforeMatches[0] !== source)
    return undefined;
  const after = sourceBoundAfterControlFor(step, targetId);
  if (
    after === undefined ||
    typeof after.ariaExpanded !== "boolean" ||
    after.ariaExpanded === source.ariaExpanded
  )
    return undefined;

  return { identity: sourceBoundIdentityFor(targetId), targetId };
};

const toggleBindingsFor = (
  path: RevealPath,
): readonly ToggleBinding[] | undefined => {
  const bindings = path.steps.map(toggleBindingForStep);
  return bindings.every(isDefined) ? bindings : undefined;
};

const uniqueBindingsFor = (bindings: readonly ToggleBinding[]): boolean =>
  new Set(bindings.map(({ identity }) => identity)).size === bindings.length &&
  new Set(bindings.map(({ targetId }) => targetId)).size === bindings.length;

type BranchSequenceLookup = Readonly<
  | { readonly kind: "missing" }
  | { readonly kind: "conflict" }
  | { readonly kind: "match"; readonly branch: BranchView }
>;

const branchForSequence = (
  knownBranches: readonly BranchView[],
  initialUrl: string,
  sequence: readonly string[],
): BranchSequenceLookup => {
  const matches = knownBranches.filter(
    (branch) =>
      branch.path.initialUrl === initialUrl &&
      stableSerialize(sequenceFor(branch.path)) === stableSerialize(sequence),
  );
  const first = matches[0];
  if (first === undefined) return { kind: "missing" };
  return matches.every(
    (match) =>
      match.url === first.url &&
      sameRevealSurfaceMaterial(match.surface, first.surface),
  )
    ? { kind: "match", branch: first }
    : { kind: "conflict" };
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
    pair.left.identity,
    pair.right.identity,
  ]);
  const reverse = branchForSequence(input.knownBranches, input.initialUrl, [
    pair.right.identity,
    pair.left.identity,
  ]);
  const leftSingle = input.singles[pair.leftIndex];
  const rightSingle = input.singles[pair.rightIndex];
  if (
    forward.kind !== "match" ||
    reverse.kind !== "match" ||
    leftSingle === undefined ||
    rightSingle === undefined ||
    forward.branch.url !== input.initialUrl ||
    reverse.branch.url !== input.initialUrl ||
    !sameRevealSurfaceMaterial(forward.branch.surface, reverse.branch.surface)
  )
    return false;
  return matchesUnion({
    root: input.root,
    singles: [leftSingle, rightSingle],
    actual: revealSurfaceMaterialFor(forward.branch.surface),
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

export const independentDisclosureReductionDiagnosisFor = (input: {
  readonly branch: BranchView;
  readonly knownBranches: readonly BranchView[];
}): IndependentDisclosureReductionDiagnosis => {
  const steps = input.branch.path.steps;
  if (steps.length < MIN_CANONICALIZATION_DEPTH)
    return { eligible: false, reason: "depth-too-shallow" };
  const bindings = toggleBindingsFor(input.branch.path);
  if (bindings === undefined)
    return { eligible: false, reason: "step-not-eligible" };
  if (!uniqueBindingsFor(bindings))
    return { eligible: false, reason: "bindings-not-unique" };
  const initialUrl = input.branch.path.initialUrl;
  const rootMaterial = revealSurfaceMaterialFor(
    steps[0]?.before ?? input.branch.surface,
  );
  const singleLookups = bindings.map(({ identity }) =>
    branchForSequence(input.knownBranches, initialUrl, [identity]),
  );
  if (singleLookups.some(({ kind }) => kind === "missing"))
    return { eligible: false, reason: "single-branch-missing" };
  if (singleLookups.some(({ kind }) => kind === "conflict"))
    return {
      eligible: false,
      reason: "single-branch-material-or-url-mismatch",
    };
  const resolvedSingles = singleLookups.map((lookup) =>
    lookup.kind === "match" ? lookup.branch : undefined,
  );
  if (
    resolvedSingles.includes(undefined) ||
    resolvedSingles.some((branch) => branch?.url !== initialUrl)
  )
    return {
      eligible: false,
      reason: "single-branch-material-or-url-mismatch",
    };
  const matchedSingles = resolvedSingles.filter(isDefined);
  if (
    !matchesUnion({
      root: rootMaterial,
      singles: matchedSingles,
      actual: revealSurfaceMaterialFor(input.branch.surface),
    })
  )
    return { eligible: false, reason: "union-mismatch" };
  if (
    !bindingPairsFor(bindings).every((pair) =>
      pairOrderEquivalentFor({
        pair,
        knownBranches: input.knownBranches,
        initialUrl,
        root: rootMaterial,
        singles: matchedSingles,
      }),
    )
  )
    return { eligible: false, reason: "pair-order-missing-or-mismatch" };
  return { eligible: true, reason: "reduction-proven" };
};

export const independentDisclosureReductionFor = (input: {
  readonly branch: BranchView;
  readonly knownBranches: readonly BranchView[];
}): boolean => independentDisclosureReductionDiagnosisFor(input).eligible;

export const independentDisclosureReductionDiagnosisForState = (input: {
  readonly state: RevealDiscoveryState;
  readonly branch: BranchView;
}): IndependentDisclosureReductionDiagnosis =>
  independentDisclosureReductionDiagnosisFor({
    branch: input.branch,
    knownBranches: knownBranchesFor(input.state),
  });
