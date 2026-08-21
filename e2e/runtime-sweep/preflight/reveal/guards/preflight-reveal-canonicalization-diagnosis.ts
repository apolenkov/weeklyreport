import { stableSerialize } from "../../../support/ids.ts";
import type { RevealDiscoveryState } from "../interaction/preflight-reveal-branches.ts";
import {
  type BranchView,
  knownBranchesFor,
  sequenceFor,
  type ToggleBinding,
  type ToggleBindingEligibilityPredicate,
  toggleBindingsAnalysisFor,
  uniqueBindingsFor,
} from "./preflight-reveal-canonicalization.ts";
import {
  matchesUnion,
  type RevealSurfaceMaterial,
  revealSurfaceMaterialFor,
  sameRevealSurfaceMaterial,
} from "./reveal-surface-material.ts";

const MIN_CANONICALIZATION_DEPTH = 3;

type IndependentDisclosureReductionReason =
  | "depth-too-shallow"
  | "step-not-eligible"
  | "bindings-not-unique"
  | "single-branch-missing"
  | "single-branch-material-or-url-mismatch"
  | "pair-order-missing-or-mismatch"
  | "union-mismatch"
  | "reduction-proven";

type StepNotEligibleDiagnosis = Readonly<{
  readonly eligible: false;
  readonly reason: "step-not-eligible";
  readonly stepIndex: number;
  readonly predicate: ToggleBindingEligibilityPredicate;
}>;

export type IndependentDisclosureReductionDiagnosis = Readonly<
  | StepNotEligibleDiagnosis
  | {
      readonly eligible: false;
      readonly reason: Exclude<
        IndependentDisclosureReductionReason,
        "reduction-proven" | "step-not-eligible"
      >;
    }
  | { readonly eligible: true; readonly reason: "reduction-proven" }
>;

export const independentDisclosureReductionCapacityDetailsFor = (
  diagnosis: IndependentDisclosureReductionDiagnosis,
): string =>
  diagnosis.reason === "step-not-eligible"
    ? `; reductionStepIndex=${String(diagnosis.stepIndex)}; reductionPredicate=${diagnosis.predicate}`
    : "";

type BranchSequenceLookup = Readonly<
  | { readonly kind: "missing" }
  | { readonly kind: "conflict" }
  | { readonly kind: "match"; readonly branch: BranchView }
>;

type BindingPair = Readonly<{
  readonly left: ToggleBinding;
  readonly right: ToggleBinding;
  readonly leftIndex: number;
  readonly rightIndex: number;
}>;

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

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

export const independentDisclosureReductionDiagnosisFor = (input: {
  readonly branch: BranchView;
  readonly knownBranches: readonly BranchView[];
}): IndependentDisclosureReductionDiagnosis => {
  const steps = input.branch.path.steps;
  if (steps.length < MIN_CANONICALIZATION_DEPTH)
    return { eligible: false, reason: "depth-too-shallow" };
  const bindingsAnalysis = toggleBindingsAnalysisFor(input.branch.path);
  if (!bindingsAnalysis.eligible)
    return {
      eligible: false,
      reason: "step-not-eligible",
      stepIndex: bindingsAnalysis.stepIndex,
      predicate: bindingsAnalysis.predicate,
    };
  const { bindings } = bindingsAnalysis;
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
