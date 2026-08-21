import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import type { RevealDiscoveryState } from "../interaction/preflight-reveal-branches.ts";
import {
  type BranchView,
  knownBranchesFor,
  type ToggleBinding,
  toggleBindingsAnalysisFor,
  uniqueBindingsFor,
} from "./preflight-reveal-canonicalization.ts";
import type { RevealReductionContext } from "./preflight-reveal-reduction-context.ts";
import {
  matchesUnion,
  revealSurfaceMaterialFor,
  sameRevealSurfaceMaterial,
} from "./reveal-surface-material.ts";

const SCOPED_DISCLOSURE_TRANSITIONS = new Set(["none", "open", "cancel"]);

type PairDiagnosticReason =
  | "context-not-bound"
  | "pair-suffix-not-found"
  | "reverse-order-not-found"
  | "single-order-not-found"
  | "pair-material-or-url-mismatch"
  | "pair-union-mismatch"
  | "additional-disclosure"
  | "threshold-not-met"
  | "diagnostic-complete";

export type PairReductionDiagnostic = Readonly<{
  readonly evidenceComplete: boolean;
  readonly computedSavings: number;
  readonly requiredSavings: number;
  readonly thresholdSatisfied: boolean;
  readonly reason: PairDiagnosticReason;
}>;

type DisclosurePathEvidence = Readonly<{
  readonly branch: BranchView;
  readonly prefixDigest: string;
  readonly bindings: readonly ToggleBinding[];
  readonly rootSurface: BranchView["surface"];
}>;

const prefixFingerprintFor = (
  path: BranchView["path"],
  suffixStartIndex: number,
): string => {
  const firstStep = path.steps[0];
  const prefixSteps = path.steps.slice(0, suffixStartIndex);
  const exitStep = prefixSteps.at(-1);
  return sha256Hex({
    initialUrl: path.initialUrl,
    initialRootSurfaceDigest: firstStep?.before.digest ?? "",
    prefixSteps: prefixSteps.map((step) => ({
      controlKey: step.controlKey,
      operation: step.operation,
      safety: step.safety,
      transition: step.transition,
      beforeUrl: step.beforeUrl,
      afterUrl: step.afterUrl,
      beforeSurfaceDigest: step.before.digest,
      afterSurfaceDigest: step.after.digest,
    })),
    exitUrl: exitStep?.afterUrl ?? path.initialUrl,
    exitSurfaceDigest: exitStep?.after.digest ?? firstStep?.before.digest ?? "",
  });
};

const suffixStartIndexFor = (path: BranchView["path"]): number | undefined => {
  const index = path.steps.findIndex(
    (step) =>
      step.operation === "click" &&
      step.safety === "read-only" &&
      SCOPED_DISCLOSURE_TRANSITIONS.has(step.transition) &&
      step.beforeUrl === step.afterUrl,
  );
  return index === -1 ? undefined : index;
};

const disclosurePathEvidenceFor = (
  branch: BranchView,
): DisclosurePathEvidence | undefined => {
  const suffixStartIndex = suffixStartIndexFor(branch.path);
  if (suffixStartIndex === undefined) return undefined;
  const analysis = toggleBindingsAnalysisFor({
    ...branch.path,
    steps: branch.path.steps.slice(suffixStartIndex),
  });
  if (!analysis.eligible || analysis.bindings.length === 0) return undefined;
  if (!uniqueBindingsFor(analysis.bindings)) return undefined;
  return {
    branch,
    prefixDigest: prefixFingerprintFor(branch.path, suffixStartIndex),
    bindings: analysis.bindings,
    rootSurface:
      branch.path.steps[suffixStartIndex - 1]?.after ??
      branch.path.steps[0]?.before ??
      branch.surface,
  };
};

const pairEvidenceFor = (
  branch: BranchView,
): DisclosurePathEvidence | undefined => {
  const evidence = disclosurePathEvidenceFor(branch);
  return evidence?.bindings.length === 2 ? evidence : undefined;
};

const pathWithOrderFor = (
  branches: readonly BranchView[],
  prefixDigest: string,
  order: readonly string[],
): DisclosurePathEvidence | undefined => {
  for (const branch of branches) {
    const evidence = disclosurePathEvidenceFor(branch);
    if (evidence?.prefixDigest !== prefixDigest) continue;
    if (
      stableSerialize(evidence.bindings.map(({ identity }) => identity)) ===
      stableSerialize(order)
    )
      return evidence;
  }
  return undefined;
};

const hasAdditionalDisclosureFor = (input: {
  readonly branches: readonly BranchView[];
  readonly prefixDigest: string;
  readonly pairBindings: readonly ToggleBinding[];
}): boolean =>
  input.branches.some((branch) => {
    const suffixStartIndex = suffixStartIndexFor(branch.path);
    if (suffixStartIndex === undefined) return false;
    if (
      prefixFingerprintFor(branch.path, suffixStartIndex) !== input.prefixDigest
    )
      return false;
    const analysis = toggleBindingsAnalysisFor({
      ...branch.path,
      steps: branch.path.steps.slice(suffixStartIndex),
    });
    return (
      !analysis.eligible || analysis.bindings.length > input.pairBindings.length
    );
  });

const contextMatches = (input: {
  readonly context: RevealReductionContext | undefined;
  readonly expectedContext?: RevealReductionContext;
}): boolean =>
  input.context !== undefined &&
  (input.expectedContext === undefined ||
    stableSerialize(input.context) === stableSerialize(input.expectedContext));

const requiredSavingsFor = (input: {
  readonly currentControlCount: number;
  readonly plannedControlCount: number;
  readonly maxControlsPerSegment: number;
}): number =>
  Math.max(
    0,
    input.currentControlCount +
      input.plannedControlCount -
      input.maxControlsPerSegment,
  );

const ordinaryDiagnosticFor = (
  requiredSavings: number,
  reason: PairDiagnosticReason,
): PairReductionDiagnostic => ({
  evidenceComplete: false,
  computedSavings: 0,
  requiredSavings,
  thresholdSatisfied: false,
  reason,
});

const completePairDiagnosticFor = (input: {
  readonly current: DisclosurePathEvidence;
  readonly reverse: DisclosurePathEvidence;
  readonly singles: readonly DisclosurePathEvidence[];
  readonly requiredSavings: number;
}): PairReductionDiagnostic => {
  if (
    input.current.branch.url !== input.reverse.branch.url ||
    !sameRevealSurfaceMaterial(
      input.current.branch.surface,
      input.reverse.branch.surface,
    )
  )
    return ordinaryDiagnosticFor(
      input.requiredSavings,
      "pair-material-or-url-mismatch",
    );
  if (
    !matchesUnion({
      root: revealSurfaceMaterialFor(input.current.rootSurface),
      singles: input.singles.map(({ branch }) => branch),
      actual: revealSurfaceMaterialFor(input.current.branch.surface),
    })
  )
    return ordinaryDiagnosticFor(input.requiredSavings, "pair-union-mismatch");
  const naiveRegistrations =
    input.current.bindings.length + input.reverse.bindings.length;
  const uniqueRegistrations = new Set([
    ...input.current.bindings.map(({ targetId }) => targetId),
    ...input.reverse.bindings.map(({ targetId }) => targetId),
  ]).size;
  const computedSavings = naiveRegistrations - uniqueRegistrations;
  const thresholdSatisfied = computedSavings >= input.requiredSavings;
  return {
    evidenceComplete: true,
    computedSavings,
    requiredSavings: input.requiredSavings,
    thresholdSatisfied,
    reason: thresholdSatisfied ? "diagnostic-complete" : "threshold-not-met",
  };
};

/** Diagnostic-only pair evidence; it never enables reduction or replay. */
export const pairReductionDiagnosisFor = (input: {
  readonly branch: BranchView;
  readonly knownBranches: readonly BranchView[];
  readonly context: RevealReductionContext | undefined;
  readonly expectedContext?: RevealReductionContext;
  readonly currentControlCount: number;
  readonly plannedControlCount: number;
  readonly maxControlsPerSegment: number;
}): PairReductionDiagnostic => {
  const requiredSavings = requiredSavingsFor(input);
  const ordinary = (reason: PairDiagnosticReason): PairReductionDiagnostic =>
    ordinaryDiagnosticFor(requiredSavings, reason);
  if (!contextMatches(input)) return ordinary("context-not-bound");
  const current = pairEvidenceFor(input.branch);
  if (current === undefined) return ordinary("pair-suffix-not-found");
  const branches = [input.branch, ...input.knownBranches];
  if (
    hasAdditionalDisclosureFor({
      branches,
      prefixDigest: current.prefixDigest,
      pairBindings: current.bindings,
    })
  )
    return ordinary("additional-disclosure");
  const firstBinding = current.bindings[0];
  const secondBinding = current.bindings[1];
  if (firstBinding === undefined || secondBinding === undefined)
    return ordinary("pair-suffix-not-found");
  const reverseOrder = [secondBinding.identity, firstBinding.identity];
  const reverse = pathWithOrderFor(
    branches,
    current.prefixDigest,
    reverseOrder,
  );
  if (reverse === undefined) return ordinary("reverse-order-not-found");
  const singles = current.bindings.map(({ identity }) =>
    pathWithOrderFor(branches, current.prefixDigest, [identity]),
  );
  const resolvedSingles = singles.filter(
    (single): single is DisclosurePathEvidence => single !== undefined,
  );
  if (resolvedSingles.length !== singles.length)
    return ordinary("single-order-not-found");
  return completePairDiagnosticFor({
    current,
    reverse,
    singles: resolvedSingles,
    requiredSavings,
  });
};

export const pairReductionDiagnosisForState = (input: {
  readonly state: RevealDiscoveryState;
  readonly branch: BranchView;
  readonly context: RevealReductionContext | undefined;
  readonly expectedContext?: RevealReductionContext;
  readonly currentControlCount: number;
  readonly plannedControlCount: number;
  readonly maxControlsPerSegment: number;
}): PairReductionDiagnostic =>
  pairReductionDiagnosisFor({
    branch: input.branch,
    knownBranches: knownBranchesFor(input.state),
    context: input.context,
    ...(input.expectedContext === undefined
      ? {}
      : { expectedContext: input.expectedContext }),
    currentControlCount: input.currentControlCount,
    plannedControlCount: input.plannedControlCount,
    maxControlsPerSegment: input.maxControlsPerSegment,
  });
