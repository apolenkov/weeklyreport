import type { LiveControlPlan } from "../../../replay/live-control/live-control-planning.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import type { RevealReducerInput } from "../continuation/preflight-reveal-continuation-reducer.ts";
import type { RevealReductionContext } from "../guards/preflight-reveal-reduction-context.ts";
import type {
  RevealBranch,
  RevealDiscoveryState,
} from "../interaction/preflight-reveal-branches.ts";
import type { RevealFailureFrontierPacket } from "./preflight-reveal-failure-frontier-io.ts";

export type CapacityFrontierAdapterReason =
  | "source-frontier-not-bound"
  | "source-identity-not-bound"
  | "context-not-bound"
  | "receipt-chain-invalid"
  | "reducer-state-not-bound"
  | "frontier-integrity-failed"
  | "canonical-plan-derivation-failed";

export type SourceBoundCapacityFrontier = Readonly<{
  readonly source: SourceArtifact;
  readonly context: RevealReductionContext;
  readonly state: RevealDiscoveryState;
  readonly current: RevealBranch;
  readonly branch: RevealBranch;
  readonly ordinaryPlans: readonly LiveControlPlan[];
  readonly maxControlsPerSegment: number;
  readonly reducerStateDigest: string;
  readonly receiptChainDigest: string;
  readonly frontierDigest: string;
}>;

export type CapacityFrontierAdapterResult = Readonly<
  | { readonly kind: "ready"; readonly frontier: SourceBoundCapacityFrontier }
  | {
      readonly kind: "rejected";
      readonly reason: CapacityFrontierAdapterReason;
    }
>;

export type SourceBoundCapacityFrontierInput = Readonly<{
  /** Must come from canonical runtime source authority, not an ad-hoc identity object. */
  readonly source: SourceArtifact;
  /** Must come from readRevealFailureFrontierPacket after archive read-back. */
  readonly packet: RevealFailureFrontierPacket;
  /** Must be the digest of the exact capacity-survey plan used to read the packet. */
  readonly capacityPlanArtifactDigest: string;
  /** Must be the selector digest from that same capacity-survey plan. */
  readonly capacityPlanSelectorDigest: string;
  readonly queueInput: RevealReducerInput;
  readonly initialState: RevealDiscoveryState;
  /** Raw values are parsed and contract-checked before they enter arithmetic. */
  readonly receipts: readonly unknown[];
  readonly bootstrap: unknown;
  readonly parentPass: unknown;
}>;
