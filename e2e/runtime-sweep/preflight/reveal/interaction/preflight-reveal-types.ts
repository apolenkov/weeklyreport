import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type { MatrixPreflightControl } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import type { RevealTransition } from "../../../matrix/reveal-transition.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import type { LiveControlPlan } from "../../../replay/live-control/live-control-planning.ts";
import type { Action } from "../../../source/contracts.ts";
import type { ResolverOutcomeExpectation } from "../../../support/resolver-outcome-expectations.ts";
import type {
  RevealNonMutationProof,
  RevealPath,
  RevealSurface,
} from "../../reveal-path.ts";
import type { RevealRepresentativeInput } from "./preflight-reveal-transition.ts";

export type RevealRoute = Readonly<{
  readonly resolvedRoute: string;
  readonly landingRoute?: string | undefined;
  readonly expectedOutcome?: ResolverOutcomeExpectation | undefined;
}>;

export type RevealPreparation = Readonly<{
  readonly proveNonMutation: (
    action: () => Promise<void>,
  ) => Promise<RevealNonMutationProof>;
}>;

export type RevealExecution = Readonly<{
  readonly url: string;
  readonly inventory: DomInventory;
  readonly nonMutation: RevealNonMutationProof;
  readonly representativeInput?: RevealRepresentativeInput;
}>;

export interface RevealExecutionHarness {
  readonly prepare: (
    state: CampaignMatrixState,
    route: RevealRoute,
  ) => Promise<RevealPreparation | void>;
  readonly navigate: (route: string) => Promise<void>;
  readonly currentUrl: () => string;
  readonly inventory: () => Promise<DomInventory>;
  readonly executeReveal: (input: {
    readonly control: DomControlObservation;
    readonly action: Action;
    readonly representativeInput?: RevealRepresentativeInput;
    readonly preparation: RevealPreparation | undefined;
  }) => Promise<RevealExecution>;
}

export type { RevealRepresentativeInput } from "./preflight-reveal-transition.ts";

export type RevealControlFactory = (
  plan: LiveControlPlan,
  revealPath: RevealPath,
  expectedSurface: RevealSurface,
  expectedActionTransition?: RevealTransition | null,
  expectedActionSurface?: RevealSurface | null,
) => MatrixPreflightControl;

export class RevealDiscoveryError extends Error {
  override readonly name = "RevealDiscoveryError";
}
