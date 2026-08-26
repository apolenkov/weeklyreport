import type { CampaignMatrixState } from "../../../../matrix/campaign-matrix.ts";
import type { SourceArtifact } from "../../../../source/source-artifact.ts";
import { sha256Hex } from "../../../../support/ids.ts";
import type { RevealRoute } from "../../interaction/preflight-reveal-types.ts";
import {
  parseRevealExecutionGrant,
  parseRevealReceiptChunk,
} from "../preflight-reveal-continuation-artifacts.ts";
import {
  chunkDigestForBody,
  grantDigestForBody,
  hmacFor,
  R188_ZERO_DIGEST,
} from "../preflight-reveal-continuation-digests.ts";
import { RevealContinuationError } from "../preflight-reveal-continuation-errors.ts";
import {
  executionGrantSchema,
  PREFLIGHT_REVEAL_CONTINUATION_VERSION,
  receiptChunkBodySchema,
  type RevealContinuationFrontier,
  type RevealContinuationReceipt,
  type RevealContinuationRoute,
  type RevealExecutionGrant,
  type RevealReceiptChunk,
} from "./preflight-reveal-continuation-schemas.ts";

const EXECUTION_GRANT_DOMAIN = "execution-grant";

export const strictRouteFor = (
  route: RevealRoute | RevealContinuationRoute,
): RevealContinuationRoute => {
  if (
    route.role === undefined ||
    route.catalogRoute === undefined ||
    route.target === undefined
  )
    throw new RevealContinuationError(
      "R188 route requires role, catalogRoute, and target identity",
    );
  if (route.kind === "resolver") {
    if (route.expectedOutcome === undefined || route.landingRoute !== undefined)
      throw new RevealContinuationError(
        "R188 resolver route binding is invalid",
      );
    return {
      kind: "resolver",
      role: route.role,
      catalogRoute: route.catalogRoute,
      resolvedRoute: route.resolvedRoute,
      target: route.target,
      expectedOutcome: route.expectedOutcome,
    };
  }
  if (route.landingRoute === undefined || route.expectedOutcome !== undefined)
    throw new RevealContinuationError(
      "R188 unconditional route binding is invalid",
    );
  return {
    ...(route.kind === undefined ? {} : { kind: "unconditional" as const }),
    role: route.role,
    catalogRoute: route.catalogRoute,
    resolvedRoute: route.resolvedRoute,
    landingRoute: route.landingRoute,
    target: route.target,
  };
};

type SelectorInput = Readonly<{
  readonly stateId?: string;
  readonly role?: NonNullable<RevealRoute["role"]>;
  readonly route?: string;
  readonly profile?: CampaignMatrixState["profile"];
}>;

const selectorFor = (
  selector: SelectorInput | undefined,
  state: CampaignMatrixState,
  route: RevealContinuationRoute,
) => ({
  stateId: selector?.stateId ?? state.stateId,
  role: selector?.role ?? route.role,
  route: selector?.route ?? route.catalogRoute,
  profile: selector?.profile ?? state.profile,
});

export const runIdentityFor = (input: {
  readonly source: SourceArtifact;
  readonly state: CampaignMatrixState;
  readonly route: RevealContinuationRoute;
  readonly selector?: SelectorInput;
  readonly executionScope: "canary";
  readonly attemptId: string;
}) => {
  const selector = selectorFor(input.selector, input.state, input.route);
  const run = {
    campaignId: input.source.campaignId,
    sourceSha: input.source.sourceSha,
    sourceTree: input.source.sourceTree,
    treeDigest: input.source.treeDigest,
    sourceDigest: input.source.sourceDigest,
    planDigest: input.source.plan.digest,
    state: input.state,
    stateDigest: sha256Hex(input.state),
    selector,
    selectorDigest: sha256Hex(selector),
    route: input.route,
    routeDigest: sha256Hex(input.route),
    executionScope: input.executionScope,
    attemptId: input.attemptId,
  } as const;
  return run;
};

export const createRevealExecutionGrant = (input: {
  readonly source: SourceArtifact;
  readonly state: CampaignMatrixState;
  readonly route: RevealRoute | RevealContinuationRoute;
  readonly selector?: SelectorInput;
  readonly executionScope: "canary";
  readonly attemptId: string;
  readonly chain: RevealExecutionGrant["chain"];
  readonly genesis: RevealExecutionGrant["genesis"];
  readonly frontier: RevealContinuationFrontier;
  readonly reducerState: RevealExecutionGrant["reducerState"];
  readonly bounds: RevealExecutionGrant["bounds"];
  readonly reducerStateDigest: string;
  readonly authorityKey: string;
}): RevealExecutionGrant => {
  const strictRoute = strictRouteFor(input.route);
  const run = runIdentityFor({ ...input, route: strictRoute });
  const unsigned = {
    artifact: "PREFLIGHT_REVEAL_EXECUTION_GRANT" as const,
    version: PREFLIGHT_REVEAL_CONTINUATION_VERSION,
    status: "EXECUTION_GRANT" as const,
    run,
    chain: input.chain,
    genesis: input.genesis,
    frontier: input.frontier,
    reducerState: input.reducerState,
    bounds: input.bounds,
    reducerStateDigest: input.reducerStateDigest,
    authorityTag: R188_ZERO_DIGEST,
  } satisfies Parameters<typeof executionGrantSchema.parse>[0];
  const body = {
    ...unsigned,
    authorityTag: hmacFor(input.authorityKey, EXECUTION_GRANT_DOMAIN, unsigned),
  };
  return parseRevealExecutionGrant({
    ...body,
    grantDigest: grantDigestForBody(body),
  });
};

export const createRevealReceiptChunk = (input: {
  readonly run: RevealReceiptChunk["run"];
  readonly grantDigest: string;
  readonly status: RevealReceiptChunk["status"];
  readonly predecessorReceiptHead: string | null;
  readonly predecessorReceiptCount: number;
  readonly receiptHead: string;
  readonly receiptCount: number;
  readonly predecessorChunkHead: string | null;
  readonly predecessorChunkCount: number;
  readonly chunkSequence: number;
  readonly operationEvidence: RevealReceiptChunk["operationEvidence"];
  readonly receipts: readonly RevealContinuationReceipt[];
}): RevealReceiptChunk => {
  const body = {
    artifact: "PREFLIGHT_REVEAL_RECEIPT_CHUNK" as const,
    version: PREFLIGHT_REVEAL_CONTINUATION_VERSION,
    status: input.status,
    run: input.run,
    grantDigest: input.grantDigest,
    predecessorReceiptHead: input.predecessorReceiptHead,
    predecessorReceiptCount: input.predecessorReceiptCount,
    receiptHead: input.receiptHead,
    receiptCount: input.receiptCount,
    predecessorChunkHead: input.predecessorChunkHead,
    predecessorChunkCount: input.predecessorChunkCount,
    chunkSequence: input.chunkSequence,
    operationEvidence: input.operationEvidence,
    receipts: input.receipts,
    authorityTag: null,
  } satisfies Parameters<typeof receiptChunkBodySchema.parse>[0];
  return parseRevealReceiptChunk({
    ...body,
    chunkDigest: chunkDigestForBody(body),
  });
};
