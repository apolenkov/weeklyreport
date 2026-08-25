import type { RevealDiscoveryState } from "../interaction/preflight-reveal-branches.ts";
import {
  type BranchView,
  knownBranchesFor,
  type ToggleBindingEligibilityPredicate,
  toggleBindingsAnalysisFor,
  uniqueBindingsFor,
  untrustedDisclosureFor,
} from "./preflight-reveal-canonicalization.ts";
import {
  allPairOrdersEquivalentFor,
  singleProofBranchesFor,
} from "./preflight-reveal-canonicalization-proof.ts";
import {
  matchesUnion,
  revealSurfaceMaterialFor,
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
  | "untrusted-disclosure"
  | "reduction-proven";

type StepNotEligibleDiagnosis = Readonly<{
  readonly eligible: false;
  readonly reason: "step-not-eligible";
  readonly stepIndex: number;
  readonly predicate: ToggleBindingEligibilityPredicate;
}>;

type UntrustedDisclosureDiagnosis = Readonly<{
  readonly eligible: false;
  readonly reason: "untrusted-disclosure";
  readonly surfaceIndex: number;
}>;

export type IndependentDisclosureReductionDiagnosis = Readonly<
  | StepNotEligibleDiagnosis
  | UntrustedDisclosureDiagnosis
  | {
      readonly eligible: false;
      readonly reason: Exclude<
        IndependentDisclosureReductionReason,
        "reduction-proven" | "step-not-eligible" | "untrusted-disclosure"
      >;
    }
  | { readonly eligible: true; readonly reason: "reduction-proven" }
>;

export const independentDisclosureReductionCapacityDetailsFor = (
  diagnosis: IndependentDisclosureReductionDiagnosis,
): string =>
  diagnosis.reason === "step-not-eligible"
    ? `; reductionStepIndex=${String(diagnosis.stepIndex)}; reductionPredicate=${diagnosis.predicate}`
    : diagnosis.reason === "untrusted-disclosure"
      ? `; reductionSurfaceIndex=${String(diagnosis.surfaceIndex)}`
      : "";

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

const untrustedDisclosureDiagnosisFor = (
  branch: BranchView,
): UntrustedDisclosureDiagnosis | undefined => {
  const surfaceIndex = branch.path.steps
    .flatMap(({ before, after }) => [before, after])
    .findIndex((surface) => untrustedDisclosureFor(surface) !== undefined);
  return surfaceIndex === -1
    ? undefined
    : { eligible: false, reason: "untrusted-disclosure", surfaceIndex };
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
  const untrustedDiagnosis = untrustedDisclosureDiagnosisFor(input.branch);
  if (untrustedDiagnosis !== undefined) return untrustedDiagnosis;
  const { bindings } = bindingsAnalysis;
  if (!uniqueBindingsFor(bindings))
    return { eligible: false, reason: "bindings-not-unique" };
  const initialUrl = input.branch.path.initialUrl;
  const rootSurface = steps[0]?.before ?? input.branch.surface;
  const rootMaterial = revealSurfaceMaterialFor(rootSurface);
  const singleLookups = singleProofBranchesFor({
    bindings,
    knownBranches: input.knownBranches,
    initialUrl,
    rootSurface,
  });
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
    !allPairOrdersEquivalentFor({
      bindings,
      knownBranches: input.knownBranches,
      initialUrl,
      root: rootMaterial,
      rootSurface,
      singles: matchedSingles,
    })
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
