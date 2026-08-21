import { buildCampaignSource } from "../../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../../manifest/manifest-fixture.ts";
import { sha256Hex } from "../../../support/ids.ts";
import { preflightControlForPlan } from "../../execution/playwright-preflight-support.ts";
import {
  revealPathFor,
  revealStepFor,
  revealSurfaceFor,
} from "../../reveal-path.ts";
import {
  createParentPass,
  createRevealBootstrap,
} from "../continuation/preflight-reveal-continuation-artifacts.ts";
import {
  runIdentityFor,
  strictRouteFor,
} from "../continuation/preflight-reveal-continuation-contract-factories.ts";
import {
  controlFor,
  inventoryFor,
} from "../continuation/preflight-reveal-continuation-fixture.ts";
import {
  controlsDigestFor,
  reducerStateDigestFor,
  type RevealReducerInput,
} from "../continuation/preflight-reveal-continuation-reducer.ts";
import {
  branchAssetFor,
  candidateListAssetFor,
} from "../continuation/receipts/preflight-reveal-continuation-receipt-assets.ts";
import { revealReductionContextFor } from "../guards/preflight-reveal-reduction-context.ts";
import type {
  RevealBranch,
  RevealDiscoveryState,
} from "../interaction/preflight-reveal-branches.ts";
import {
  plansFor,
  revealCandidatesFor,
} from "../interaction/preflight-reveal-discovery.ts";
import type { RevealRoute } from "../interaction/preflight-reveal-types.ts";
import type { SourceBoundCapacityFrontierInput } from "./preflight-reveal-capacity-frontier-adapter-contract.ts";
import {
  packetFor,
  routeStateFor,
} from "./preflight-reveal-capacity-frontier-test-support.ts";

const AUTHORITY_KEY_LENGTH = 64;

type BranchFixture = Readonly<{
  readonly branch: RevealBranch;
  readonly candidates: ReturnType<typeof revealCandidatesFor>;
  readonly pendingBranch: RevealBranch;
}>;

const branchesFor = (route: RevealRoute): BranchFixture => {
  const inventory = inventoryFor([
    controlFor("button:a-open:0", "Open panel", 0),
  ]);
  const branch: RevealBranch = {
    path: revealPathFor([], route.resolvedRoute),
    inventory,
    surface: revealSurfaceFor(inventory.controls),
    url: route.resolvedRoute,
    preparation: undefined,
  };
  const candidates = revealCandidatesFor(inventory, route);
  const pendingInventory = inventoryFor([
    controlFor("button:a-close:0", "Close panel", 0),
  ]);
  const pendingSurface = revealSurfaceFor(pendingInventory.controls);
  const pendingCandidate = candidates[0];
  if (pendingCandidate === undefined)
    throw new Error("Fixture candidate is missing");
  const pendingBranch: RevealBranch = {
    path: revealPathFor(
      [
        revealStepFor(
          pendingCandidate.action,
          branch.surface,
          pendingSurface,
          branch.url,
          `${branch.url}?panel=open#dialog`,
          {
            status: "unchanged",
            beforeDigest: sha256Hex("capacity-frontier-non-mutation"),
            afterDigest: sha256Hex("capacity-frontier-non-mutation"),
          },
        ),
      ],
      branch.path.initialUrl,
    ),
    inventory: pendingInventory,
    surface: pendingSurface,
    url: `${branch.url}?panel=open#dialog`,
    preparation: undefined,
  };
  return { branch, candidates, pendingBranch };
};

const discoveryStateFor = (input: {
  readonly branch: RevealBranch;
  readonly candidates: ReturnType<typeof revealCandidatesFor>;
}): RevealDiscoveryState => ({
  queue: [],
  controls: [],
  discovered: new Map(),
  visitedStatePaths: new Map(),
  actionCount: 0,
  branchCount: 0,
  currentBranch: input.branch,
  currentCandidates: input.candidates,
  currentCandidateIndex: 0,
});

export const continuationArtifactsFor = (input: {
  readonly source: Awaited<ReturnType<typeof buildCampaignSource>>;
  readonly state: Awaited<
    ReturnType<typeof buildCampaignSource>
  >["plan"]["states"][number];
  readonly route: RevealRoute;
  readonly queueInput: RevealReducerInput;
  readonly discoveryState: RevealDiscoveryState;
  readonly branch: RevealBranch;
  readonly candidates: ReturnType<typeof revealCandidatesFor>;
}): Readonly<{
  readonly bootstrap: ReturnType<typeof createRevealBootstrap>;
  readonly parentPass: ReturnType<typeof createParentPass>;
}> => {
  const run = runIdentityFor({
    source: input.source,
    state: input.state,
    route: strictRouteFor(input.route),
    executionScope: "canary",
    attemptId: "attempt-capacity-frontier",
  });
  const reducerStateDigest = reducerStateDigestFor(input.discoveryState);
  const branchAsset = branchAssetFor(input.branch);
  const candidateAsset = candidateListAssetFor(
    input.branch,
    input.candidates,
    branchAsset.digest,
  );
  const bootstrap = createRevealBootstrap({
    run,
    genesis: {
      inventoryRef: branchAsset.inventoryRef,
      inventoryDigest: branchAsset.inventoryDigest,
      surfaceRef: branchAsset.surfaceRef,
      surfaceDigest: branchAsset.surfaceDigest,
      pathNodeRef: branchAsset.pathNodeRef,
      pathDigest: branchAsset.pathDigest,
      branchRef: branchAsset.digest,
      branchDigest: branchAsset.digest,
      candidateListRef: candidateAsset.digest,
      candidateListDigest: sha256Hex(
        candidateAsset.candidates.map(({ candidateId }) => candidateId),
      ),
      url: input.branch.url,
    },
    bounds: {
      maxDepth: input.queueInput.maxDepth,
      maxRevealMaterialEdges: input.queueInput.maxRevealMaterialEdges,
      maxRevealActions: input.queueInput.maxRevealActions,
      maxControlsPerSegment: input.source.matrixLimits.maxControlsPerSegment,
    },
    reducerStateDigest,
    controlsDigest: controlsDigestFor(input.discoveryState.controls),
    controlsCount: input.discoveryState.controls.length,
  });
  const parentPass = createParentPass({
    run,
    chain: {
      receiptHead: null,
      receiptCount: 0,
      chunkHead: null,
      chunkCount: 0,
    },
    reducerStateDigest,
    controlsDigest: controlsDigestFor(input.discoveryState.controls),
    controlsCount: input.discoveryState.controls.length,
    authorityKey: "a".repeat(AUTHORITY_KEY_LENGTH),
  });
  return { bootstrap, parentPass };
};

export const fixtureFor = async () => {
  const fixture = await createManifestFixture();
  const source = await buildCampaignSource(fixture.input, fakeManifestGit());
  const { state, route } = routeStateFor(source);
  const { branch, candidates, pendingBranch } = branchesFor(route);
  const discoveryState = discoveryStateFor({ branch, candidates });
  const context = revealReductionContextFor({ source, state, route });
  if (context === undefined) throw new Error("Fixture context is missing");
  const queueInput: RevealReducerInput = {
    state,
    route,
    reductionContext: context,
    initialSurface: branch.surface,
    controlFor: preflightControlForPlan,
    plansFor,
    candidatesFor: (candidateInventory) =>
      revealCandidatesFor(candidateInventory, route),
    maxDepth: 8,
    maxRevealMaterialEdges: source.matrixLimits.maxRevealMaterialEdges,
    maxRevealActions: source.matrixLimits.maxRevealActions,
    maxControlsPerSegment: source.matrixLimits.maxControlsPerSegment,
  };
  const { bootstrap, parentPass } = continuationArtifactsFor({
    source,
    state,
    route,
    queueInput,
    discoveryState,
    branch,
    candidates,
  });
  const packetFixture = await packetFor({
    source,
    state,
    route,
    queueInput,
    discoveryState,
    branch,
    pendingBranch,
    candidates,
  });
  const input: SourceBoundCapacityFrontierInput = {
    source,
    packet: packetFixture.packet,
    capacityPlanArtifactDigest: packetFixture.plan.planArtifactDigest,
    capacityPlanSelectorDigest: packetFixture.plan.selector.selectorDigest,
    queueInput,
    initialState: discoveryState,
    receipts: [],
    bootstrap,
    parentPass,
  };
  return {
    fixture,
    input,
    bootstrap,
    pendingBranch,
    packetRoot: packetFixture.packetRoot,
  };
};
