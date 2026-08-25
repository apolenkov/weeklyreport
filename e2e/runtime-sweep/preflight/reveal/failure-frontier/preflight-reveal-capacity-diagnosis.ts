import {
  revealControlPreparationIdentityFor,
  surfaceSignatureFor,
} from "../../reveal-path.ts";
import {
  type IndependentDisclosureReductionDiagnosis,
  independentDisclosureReductionDiagnosisForState,
} from "../guards/preflight-reveal-canonicalization-diagnosis.ts";
import {
  controlsForImmediateReveal,
  registerDynamicControls,
} from "../guards/preflight-reveal-registration.ts";
import {
  adaptSourceBoundCapacityFrontier,
  type SourceBoundCapacityFrontierInput,
} from "./preflight-reveal-capacity-frontier-adapter.ts";
import type {
  CapacityFrontierAdapterResult,
  SourceBoundCapacityFrontier,
} from "./preflight-reveal-capacity-frontier-adapter-contract.ts";

type CapacityDiagnosisReason =
  | "source-frontier-not-bound"
  | "source-identity-not-bound"
  | "context-not-bound"
  | "receipt-chain-invalid"
  | "reducer-state-not-bound"
  | "frontier-integrity-failed"
  | "canonical-plan-derivation-failed"
  | "reduction-not-proven"
  | "threshold-not-met"
  | "diagnostic-complete";

type CapacityFrontierLedgerEntry = Readonly<{
  readonly controlKey: string;
  readonly preparationIdentity: string;
  readonly pathDigest: string;
  readonly surfaceDigest: string;
  readonly signature: string;
}>;

export type SourceBoundCapacityDiagnosis = Readonly<{
  readonly evidenceComplete: boolean;
  readonly ordinaryControlCount: number;
  readonly reducedControlCount: number;
  readonly computedSavings: number;
  readonly requiredSavings: number;
  readonly projectedControlCount: number;
  readonly thresholdSatisfied: boolean;
  readonly reason: CapacityDiagnosisReason;
  readonly reductionReason?: IndependentDisclosureReductionDiagnosis["reason"];
  readonly frontierDigest?: string;
  readonly receiptChainDigest?: string;
  readonly ledger: readonly CapacityFrontierLedgerEntry[];
}>;

const emptyDiagnosisFor = (
  reason: CapacityDiagnosisReason,
): SourceBoundCapacityDiagnosis => ({
  evidenceComplete: false,
  ordinaryControlCount: 0,
  reducedControlCount: 0,
  computedSavings: 0,
  requiredSavings: 0,
  projectedControlCount: 0,
  thresholdSatisfied: false,
  reason,
  ledger: [],
});

const rejectedDiagnosisFor = (
  result: Extract<CapacityFrontierAdapterResult, { readonly kind: "rejected" }>,
): SourceBoundCapacityDiagnosis => emptyDiagnosisFor(result.reason);

const ledgerFor = (input: {
  readonly frontier: SourceBoundCapacityFrontier;
  readonly controls: readonly SourceBoundCapacityFrontier["branch"]["surface"]["controls"][number][];
}): readonly CapacityFrontierLedgerEntry[] =>
  input.controls.map((control) => ({
    controlKey: control.controlKey,
    preparationIdentity: revealControlPreparationIdentityFor(
      control.controlKey,
      input.frontier.branch.path,
      input.frontier.branch.surface,
    ),
    pathDigest: input.frontier.branch.path.digest,
    surfaceDigest: input.frontier.branch.surface.digest,
    signature: surfaceSignatureFor(control),
  }));

const ordinaryFor = (input: {
  readonly frontier: SourceBoundCapacityFrontier;
  readonly ordinaryControlCount: number;
  readonly projectedControlCount: number;
  readonly requiredSavings: number;
  readonly reduction: IndependentDisclosureReductionDiagnosis;
}): SourceBoundCapacityDiagnosis => ({
  evidenceComplete: false,
  ordinaryControlCount: input.ordinaryControlCount,
  reducedControlCount: 0,
  computedSavings: 0,
  requiredSavings: input.requiredSavings,
  projectedControlCount: input.projectedControlCount,
  thresholdSatisfied: false,
  reason: "reduction-not-proven",
  reductionReason: input.reduction.reason,
  frontierDigest: input.frontier.frontierDigest,
  receiptChainDigest: input.frontier.receiptChainDigest,
  ledger: [],
});

const completeFor = (input: {
  readonly frontier: SourceBoundCapacityFrontier;
  readonly ordinaryControlCount: number;
  readonly requiredSavings: number;
  readonly reduction: IndependentDisclosureReductionDiagnosis;
  readonly controls: readonly SourceBoundCapacityFrontier["branch"]["surface"]["controls"][number][];
}): SourceBoundCapacityDiagnosis => {
  const computedSavings = input.ordinaryControlCount;
  const thresholdSatisfied = computedSavings >= input.requiredSavings;
  return {
    evidenceComplete: true,
    ordinaryControlCount: input.ordinaryControlCount,
    reducedControlCount: 0,
    computedSavings,
    requiredSavings: input.requiredSavings,
    projectedControlCount: input.frontier.state.controls.length,
    thresholdSatisfied,
    reason: thresholdSatisfied ? "diagnostic-complete" : "threshold-not-met",
    reductionReason: input.reduction.reason,
    frontierDigest: input.frontier.frontierDigest,
    receiptChainDigest: input.frontier.receiptChainDigest,
    ledger: ledgerFor({ frontier: input.frontier, controls: input.controls }),
  };
};

/**
 * Applies only the existing whole-branch consumer arithmetic to a parsed,
 * source-bound frontier. This function has no product or runtime authority.
 */
const diagnoseAdaptedCapacityFrontier = (
  result: CapacityFrontierAdapterResult,
): SourceBoundCapacityDiagnosis => {
  if (result.kind === "rejected") return rejectedDiagnosisFor(result);
  const { frontier } = result;
  const immediateControls = controlsForImmediateReveal(frontier.branch);
  const registration = registerDynamicControls(
    frontier.state,
    frontier.branch,
    frontier.current,
    immediateControls,
  );
  const registeredKeys = new Set(
    registration.controls.map(({ controlKey }) => controlKey),
  );
  const countedPlans = frontier.ordinaryPlans.filter(({ control }) =>
    registeredKeys.has(control.controlKey),
  );
  const ordinaryControlCount = countedPlans.length;
  const projectedControlCount =
    frontier.state.controls.length + ordinaryControlCount;
  const requiredSavings = Math.max(
    0,
    projectedControlCount - frontier.maxControlsPerSegment,
  );
  const reduction = independentDisclosureReductionDiagnosisForState({
    state: frontier.state,
    branch: frontier.branch,
  });
  if (reduction.reason !== "reduction-proven")
    return ordinaryFor({
      frontier,
      ordinaryControlCount,
      projectedControlCount,
      requiredSavings,
      reduction,
    });
  const ledgerControls = countedPlans.map((plan) =>
    registration.controls.find(
      ({ controlKey }) => controlKey === plan.control.controlKey,
    ),
  );
  if (
    ledgerControls.includes(undefined) ||
    ledgerControls.length !== ordinaryControlCount
  )
    return {
      ...emptyDiagnosisFor("frontier-integrity-failed"),
      frontierDigest: frontier.frontierDigest,
      receiptChainDigest: frontier.receiptChainDigest,
    };
  const controls = ledgerControls.filter(
    (control): control is NonNullable<typeof control> => control !== undefined,
  );
  return completeFor({
    frontier,
    ordinaryControlCount,
    requiredSavings,
    reduction,
    controls,
  });
};

/**
 * Adapts the raw source-bound evidence and applies consumer arithmetic in one
 * opaque entrypoint. Callers cannot manufacture an accepted adapter result.
 */
export const diagnoseSourceBoundCapacityFrontier = (
  input: SourceBoundCapacityFrontierInput,
): SourceBoundCapacityDiagnosis =>
  diagnoseAdaptedCapacityFrontier(adaptSourceBoundCapacityFrontier(input));
