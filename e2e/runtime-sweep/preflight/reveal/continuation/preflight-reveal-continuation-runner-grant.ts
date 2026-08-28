import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import type {
  RevealCandidate,
  RevealDiscoveryState,
} from "../interaction/preflight-reveal-branches.ts";
import type { RevealRoute } from "../interaction/preflight-reveal-types.ts";
import { strictRouteFor } from "./contracts/preflight-reveal-continuation-contract-factories.ts";
import type { RevealExecutionGrant } from "./contracts/preflight-reveal-continuation-schemas.ts";
import { assertFreshGenesis } from "./preflight-reveal-continuation-genesis.ts";
import {
  assertRevealExecutionGrantInput as assertGrantInput,
  assertRevealExecutionGrantSource,
} from "./preflight-reveal-continuation-validators.ts";

export const assertRevealExecutionGrantInput = (input: {
  readonly grant?: RevealExecutionGrant;
  readonly expectedGrantDigest?: string;
}): void => {
  const hasGrant = input.grant !== undefined;
  const hasExpectedDigest = input.expectedGrantDigest !== undefined;
  if (hasGrant !== hasExpectedDigest)
    throw new Error(
      hasGrant
        ? "Reveal continuation resume requires the parent-sealed grant digest"
        : "Reveal continuation expected a sealed grant to resume",
    );
  if (input.grant !== undefined && input.expectedGrantDigest !== undefined)
    assertGrantInput({
      grant: input.grant,
      expectedGrantDigest: input.expectedGrantDigest,
    });
};

export const assertResumeGrant = (input: {
  readonly grant?: RevealExecutionGrant;
  readonly expectedGrantDigest?: string;
  readonly source: SourceArtifact;
  readonly state: CampaignMatrixState;
  readonly route: RevealRoute;
  readonly executionScope: "canary";
  readonly attemptId: string;
  readonly initialState: RevealDiscoveryState;
  readonly candidatesFor: (
    inventory: RevealDiscoveryState["queue"][number]["inventory"],
  ) => readonly RevealCandidate[];
}): void => {
  if (input.grant === undefined) return;
  assertRevealExecutionGrantSource({
    grant: input.grant,
    source: input.source,
    state: input.state,
    route: strictRouteFor(input.route),
    executionScope: input.executionScope,
    attemptId: input.attemptId,
    ...(input.expectedGrantDigest === undefined
      ? {}
      : { expectedGrantDigest: input.expectedGrantDigest }),
  });
  assertFreshGenesis({
    state: input.initialState,
    candidatesFor: input.candidatesFor,
    grant: input.grant,
  });
};
