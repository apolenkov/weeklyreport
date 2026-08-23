import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import {
  type BranchView,
  type ToggleBinding,
  toggleBindingsAnalysisFor,
  uniqueBindingsFor,
} from "./preflight-reveal-canonicalization.ts";
import { sameRevealSurfaceMaterial } from "./reveal-surface-material.ts";

const SCOPED_DISCLOSURE_TRANSITIONS = new Set(["none", "open", "cancel"]);

export type DisclosurePathEvidence = Readonly<{
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

export const pairEvidenceFor = (
  branch: BranchView,
): DisclosurePathEvidence | undefined => {
  const evidence = disclosurePathEvidenceFor(branch);
  return evidence?.bindings.length === 2 ? evidence : undefined;
};

export type PathWithOrderLookup = Readonly<
  | { readonly kind: "missing" }
  | { readonly kind: "conflict" }
  | { readonly kind: "match"; readonly evidence: DisclosurePathEvidence }
>;

export const pathWithOrderFor = (
  branches: readonly BranchView[],
  prefixDigest: string,
  order: readonly string[],
): PathWithOrderLookup => {
  const matches = branches.flatMap((branch) => {
    const evidence = disclosurePathEvidenceFor(branch);
    if (evidence?.prefixDigest !== prefixDigest) return [];
    if (
      stableSerialize(evidence.bindings.map(({ identity }) => identity)) !==
      stableSerialize(order)
    )
      return [];
    return [evidence];
  });
  const first = matches[0];
  if (first === undefined) return { kind: "missing" };
  const distinctPaths = new Set(
    matches.map(({ branch }) => branch.path.digest),
  );
  if (distinctPaths.size > 1) return { kind: "conflict" };
  if (
    matches.some(
      ({ branch }) =>
        branch.url !== first.branch.url ||
        !sameRevealSurfaceMaterial(branch.surface, first.branch.surface),
    )
  )
    return { kind: "conflict" };
  return { kind: "match", evidence: first };
};

export const hasAdditionalDisclosureFor = (input: {
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
