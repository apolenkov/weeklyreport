import type {
  NetworkEvidencePolicy,
  StateAxes,
} from "../../source/contracts.ts";
import { stableId } from "../../support/ids.ts";
import type { ResolverOutcomeExpectation } from "../../support/resolver-outcome-expectations.ts";
import type { CampaignMatrixState } from "../campaign-matrix.ts";
import type {
  MatrixFinalizationInput,
  MatrixPreparation,
} from "./matrix-finalizer-contract.ts";

type IdentityRoute = Readonly<{
  readonly role: CampaignMatrixState["axes"]["role"];
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
  readonly networkPolicy: NetworkEvidencePolicy;
  readonly expectedOutcome?: ResolverOutcomeExpectation;
}>;

export const executionStateFor = ({
  role: _role,
  route: _route,
  ...state
}: CampaignMatrixState["axes"]): StateAxes => state;

const workProperty = (work: unknown, key: string): unknown => {
  if (typeof work !== "object" || work === null || !(key in work))
    return undefined;
  return (work as Record<string, unknown>)[key];
};

const identityWorkFor = (work: unknown) => ({
  controlKey: workProperty(work, "controlKey"),
  declarationId: workProperty(work, "declarationId"),
  resolverRecoveryOutcome: workProperty(work, "resolverRecoveryOutcome"),
});

export const identityFor = (
  input: Pick<MatrixFinalizationInput, "sourceSha" | "sourceDigest">,
  state: CampaignMatrixState,
  route: IdentityRoute,
  work: unknown,
  preparation?: MatrixPreparation,
) => {
  const { controlKey, declarationId, resolverRecoveryOutcome } =
    identityWorkFor(work);
  return {
    kind: "executable" as const,
    caseId: stableId("matrix-case", {
      sourceSha: input.sourceSha,
      profile: state.profile,
      state: state.axes,
      networkPolicy: route.networkPolicy,
      work:
        preparation === undefined
          ? work
          : {
              work,
              preparation,
            },
    }),
    stateId: state.stateId,
    sourceSha: input.sourceSha,
    profile: state.profile,
    role: route.role,
    catalogRoute: route.catalogRoute,
    resolvedRoute: route.resolvedRoute,
    networkPolicy: route.networkPolicy,
    state: executionStateFor(state.axes),
    ...(typeof controlKey === "string" ? { controlKey } : {}),
    ...(typeof declarationId === "string" ? { declarationId } : {}),
    ...(resolverRecoveryOutcome === undefined
      ? {}
      : { resolverRecoveryOutcome }),
    ...(route.expectedOutcome === undefined
      ? {}
      : { expectedOutcome: route.expectedOutcome }),
    ...(preparation === undefined ? {} : { preparation }),
  };
};
