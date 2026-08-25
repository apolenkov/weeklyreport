import { rm } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../../support/ids.ts";
import {
  runIdentityFor,
  strictRouteFor,
} from "../continuation/contracts/preflight-reveal-continuation-contract-factories.ts";
import {
  createParentPass,
  createRevealBootstrap,
} from "../continuation/preflight-reveal-continuation-artifacts.ts";
import {
  controlsDigestFor,
  reducerStateDigestFor,
} from "../continuation/preflight-reveal-continuation-reducer.ts";
import {
  branchAssetFor,
  candidateListAssetFor,
} from "../continuation/receipts/preflight-reveal-continuation-receipt-assets.ts";
import {
  enqueueChangedBranch,
  RevealCapacityOverflowError,
} from "../interaction/preflight-reveal-branches.ts";
import { diagnoseSourceBoundCapacityFrontier } from "./preflight-reveal-capacity-diagnosis.ts";
import { fullReductionFixtureFor } from "./preflight-reveal-capacity-frontier-full-fixture.ts";
import { fixtureFor } from "./preflight-reveal-capacity-frontier-test-fixture.ts";
import { packetFor } from "./preflight-reveal-capacity-frontier-test-support.ts";
import { routeStateFor } from "./preflight-reveal-capacity-frontier-test-support.ts";

describe("source-bound capacity diagnosis", () => {
  it("does not claim reduction when the parsed frontier is too shallow", async () => {
    const { fixture, input, packetRoot } = await fixtureFor();
    try {
      const diagnosis = diagnoseSourceBoundCapacityFrontier(input);
      expect(diagnosis).toMatchObject({
        evidenceComplete: false,
        ordinaryControlCount: 1,
        reducedControlCount: 0,
        computedSavings: 0,
        reason: "reduction-not-proven",
        reductionReason: "depth-too-shallow",
        ledger: [],
      });
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
      await rm(packetRoot, { recursive: true, force: true });
    }
  });

  it("reports complete independent reduction only with the full branch matrix", async () => {
    const { fixture, input, packetRoot } = await fullReductionFixtureFor();
    try {
      expect(input.packet.pendingBranch?.path.digest).toBeDefined();
      expect(input.packet.pendingBranch?.path.digest).not.toBe(
        input.packet.branch.path.digest,
      );
      const diagnosis = diagnoseSourceBoundCapacityFrontier(input);
      expect(diagnosis).toMatchObject({
        evidenceComplete: true,
        ordinaryControlCount: 1,
        reducedControlCount: 0,
        computedSavings: 1,
        thresholdSatisfied: true,
        reason: "diagnostic-complete",
        reductionReason: "reduction-proven",
      });
      expect(diagnosis.ledger).toHaveLength(1);
      expect(diagnosis.ledger[0]?.controlKey).toBe("d");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
      await rm(packetRoot, { recursive: true, force: true });
    }
  });

  it("fails closed when the source-bound adapter rejects", async () => {
    const { fixture, input, packetRoot } = await fixtureFor();
    try {
      const diagnosis = diagnoseSourceBoundCapacityFrontier({
        ...input,
        capacityPlanArtifactDigest: "f".repeat(64),
      });
      expect(diagnosis).toMatchObject({
        evidenceComplete: false,
        ordinaryControlCount: 0,
        computedSavings: 0,
        reason: "source-identity-not-bound",
        ledger: [],
      });
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
      await rm(packetRoot, { recursive: true, force: true });
    }
  });

  it("carries a real queue overflow through archive read-back and diagnosis", async () => {
    const { fixture, input, packetRoot, pendingBranch } = await fixtureFor();
    let overflow: RevealCapacityOverflowError | undefined;
    let packetFixture: Awaited<ReturnType<typeof packetFor>> | undefined;
    try {
      const current = input.packet.branch;
      const candidate = input.initialState.currentCandidates?.[0];
      if (candidate === undefined)
        throw new Error("Overflow fixture candidate is missing");
      const sourceState = input.source.plan.states.find(
        (state) => state.stateId === input.queueInput.state.stateId,
      );
      if (sourceState === undefined)
        throw new Error("Overflow fixture source state is missing");
      const { route } = routeStateFor(input.source);
      const plan = input.queueInput.plansFor(pendingBranch.inventory)[0];
      if (plan === undefined)
        throw new Error("Overflow fixture plan is missing");
      const preparedControl = input.queueInput.controlFor(
        plan,
        current.path,
        current.surface,
        null,
        null,
      );
      const discoveryState = {
        ...input.initialState,
        controls: Array.from(
          { length: input.queueInput.maxControlsPerSegment },
          () => preparedControl,
        ),
        currentBranch: current,
        currentCandidates: [candidate],
        currentCandidateIndex: 0,
      };
      try {
        enqueueChangedBranch({
          queueInput: input.queueInput,
          state: discoveryState,
          current,
          branch: pendingBranch,
          action: candidate.action,
        });
      } catch (error: unknown) {
        if (!(error instanceof RevealCapacityOverflowError)) throw error;
        overflow = error;
      }
      if (overflow === undefined)
        throw new Error("Expected the real enqueue path to overflow");
      expect(overflow.branch.path.digest).toBe(pendingBranch.path.digest);

      packetFixture = await packetFor({
        source: input.source,
        state: sourceState,
        route,
        queueInput: input.queueInput,
        discoveryState,
        branch: current,
        pendingBranch: overflow.branch,
        candidates: [candidate],
      });
      const branchAsset = branchAssetFor(current);
      const candidateAsset = candidateListAssetFor(
        current,
        [candidate],
        branchAsset.digest,
      );
      const run = runIdentityFor({
        source: input.source,
        state: sourceState,
        route: strictRouteFor(route),
        executionScope: "canary",
        attemptId: "attempt-capacity-frontier-real-overflow",
      });
      const reducerStateDigest = reducerStateDigestFor(discoveryState);
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
          url: current.url,
        },
        bounds: {
          maxDepth: input.queueInput.maxDepth,
          maxRevealMaterialEdges: input.queueInput.maxRevealMaterialEdges,
          maxRevealActions: input.queueInput.maxRevealActions,
          maxControlsPerSegment:
            input.source.matrixLimits.maxControlsPerSegment,
        },
        reducerStateDigest,
        controlsDigest: controlsDigestFor(discoveryState.controls),
        controlsCount: discoveryState.controls.length,
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
        controlsDigest: controlsDigestFor(discoveryState.controls),
        controlsCount: discoveryState.controls.length,
        authorityKey: "a".repeat(64),
      });
      const diagnosis = diagnoseSourceBoundCapacityFrontier({
        source: input.source,
        packet: packetFixture.packet,
        capacityPlanArtifactDigest: packetFixture.plan.planArtifactDigest,
        capacityPlanSelectorDigest: packetFixture.plan.selector.selectorDigest,
        queueInput: input.queueInput,
        initialState: discoveryState,
        receipts: [],
        bootstrap,
        parentPass,
      });
      expect(diagnosis).toMatchObject({
        evidenceComplete: false,
        ordinaryControlCount: 1,
        projectedControlCount: input.queueInput.maxControlsPerSegment + 1,
        reason: "reduction-not-proven",
        reductionReason: "depth-too-shallow",
      });
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
      await rm(packetRoot, { recursive: true, force: true });
      if (packetFixture !== undefined)
        await rm(packetFixture.packetRoot, { recursive: true, force: true });
    }
  });
});
