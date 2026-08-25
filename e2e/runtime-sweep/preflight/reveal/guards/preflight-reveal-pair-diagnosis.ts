import { stableSerialize } from "../../../support/ids.ts";
import type { BranchView } from "./preflight-reveal-canonicalization.ts";
import {
  type DisclosurePathEvidence,
  hasAdditionalDisclosureFor,
  pairEvidenceFor,
  pathWithOrderFor,
} from "./preflight-reveal-pair-evidence.ts";
import type { RevealReductionContext } from "./preflight-reveal-reduction-context.ts";
import {
  matchesUnion,
  revealSurfaceMaterialFor,
  sameRevealSurfaceMaterial,
} from "./reveal-surface-material.ts";

type PairDiagnosticReason =
  | "context-not-bound"
  | "pair-suffix-not-found"
  | "reverse-order-not-found"
  | "reverse-order-conflict"
  | "single-order-not-found"
  | "single-order-conflict"
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

const contextMatches = (input: {
  readonly context: RevealReductionContext | undefined;
  readonly expectedContext: RevealReductionContext;
}): boolean =>
  input.context !== undefined &&
  stableSerialize(input.context) === stableSerialize(input.expectedContext);

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
  readonly expectedContext: RevealReductionContext;
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
  const reverseLookup = pathWithOrderFor(
    branches,
    current.prefixDigest,
    reverseOrder,
  );
  if (reverseLookup.kind === "missing")
    return ordinary("reverse-order-not-found");
  if (reverseLookup.kind === "conflict")
    return ordinary("reverse-order-conflict");
  const singleLookups = current.bindings.map(({ identity }) =>
    pathWithOrderFor(branches, current.prefixDigest, [identity]),
  );
  if (singleLookups.some(({ kind }) => kind === "conflict"))
    return ordinary("single-order-conflict");
  const resolvedSingles = singleLookups.flatMap((lookup) =>
    lookup.kind === "match" ? [lookup.evidence] : [],
  );
  if (resolvedSingles.length !== singleLookups.length)
    return ordinary("single-order-not-found");
  return completePairDiagnosticFor({
    current,
    reverse: reverseLookup.evidence,
    singles: resolvedSingles,
    requiredSavings,
  });
};
