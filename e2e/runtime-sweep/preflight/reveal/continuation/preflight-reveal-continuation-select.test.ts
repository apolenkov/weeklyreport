import { mkdtemp, rm } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../../support/ids.ts";
import type { ParentContext } from "../../launch/continuation/preflight-reveal-continuation-parent.ts";
import { sealGrant } from "../../launch/continuation/preflight-reveal-continuation-parent-grant.ts";
import { parentReplayContextFor } from "../../launch/continuation/preflight-reveal-continuation-parent-replay.ts";
import { parseRevealTerminalReceipt } from "./preflight-reveal-continuation-artifacts.ts";
import { receiptDigestForBody } from "./preflight-reveal-continuation-digests.ts";
import {
  controlFor,
  inventoryFor,
  runChunk,
  selectionFor,
  withSource,
} from "./preflight-reveal-continuation-fixture.ts";
import { reduceRevealReceiptSuffix } from "./preflight-reveal-continuation-reducer.ts";
import { branchForRef } from "./receipts/preflight-reveal-continuation-receipts.ts";

describe("R188 select continuation", () => {
  it("seals and resumes from a frozen select receipt", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { selection, route } = selectionFor(source, state.stateId);
      const root = inventoryFor([
        {
          ...controlFor("a-select", "Parent", 0),
          role: "combobox",
          tagName: "select",
        },
        controlFor("z-button", "Open later", 1),
      ]);
      let nowCalls = 0;
      const result = await runChunk({
        source,
        state,
        route,
        root,
        nested: inventoryFor([]),
        stableAllPostAction: root,
        now: () => nowCalls++,
        deadlineAt: 1,
      });
      const receipt = result.result.chunk.receipts[0];
      if (receipt === undefined) throw new Error("Fixture produced no receipt");
      expect(receipt.representativeInput?.kind).toBe("select");
      const initialBranch = branchForRef(receipt.branchRef);
      const replay = parentReplayContextFor({
        source,
        state,
        route,
        initialUrl: initialBranch.url,
        initialInventory: initialBranch.inventory,
      });
      const { digest: _transitionDigest, ...transitionBody } =
        receipt.transition;
      const tamperedRepresentative = {
        kind: "select" as const,
        value: "tampered-parent",
        index: 1,
      };
      const tamperedTransitionBody = {
        ...transitionBody,
        representativeInput: tamperedRepresentative,
      };
      const tamperedTransition = {
        ...tamperedTransitionBody,
        digest: sha256Hex(tamperedTransitionBody),
      };
      const { digest: _receiptDigest, ...receiptBody } = receipt;
      const tamperedReceiptBody = {
        ...receiptBody,
        representativeInput: tamperedRepresentative,
        transition: tamperedTransition,
      };
      const tamperedReceipt = parseRevealTerminalReceipt({
        ...tamperedReceiptBody,
        digest: receiptDigestForBody(tamperedReceiptBody),
      });
      expect(() =>
        reduceRevealReceiptSuffix({
          queueInput: replay.queueInput,
          state: replay.initialState,
          receipts: [tamperedReceipt],
          predecessorCompletedCandidateCount: 0,
          predecessorDigest: null,
        }),
      ).toThrow(/candidate identity/u);
      const reduced = reduceRevealReceiptSuffix({
        queueInput: replay.queueInput,
        state: replay.initialState,
        receipts: [receipt],
        predecessorCompletedCandidateCount: 0,
        predecessorDigest: null,
      });
      expect(reduced.status).toBe("OPEN");
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r188-select-resume-"),
      );
      try {
        const context: ParentContext = {
          source,
          repoRoot: process.cwd(),
          archiveRoot,
          canaryPath: path.join(archiveRoot, "PREFLIGHT_CANARY.json"),
          selection,
          revealRoute: route,
          authorityKey: "a".repeat(64),
          attemptId: "attempt-fixture",
          chunkBudget: "1000",
          chunkBudgetMs: 1000,
          runPlaywright: () =>
            Promise.reject(new Error("Browser launch is forbidden")),
        };
        const sealed = await sealGrant({
          context,
          progress: {
            previousGrantDigest: null,
            previousCompletedCandidateCount: 0,
            receiptHead: null,
            receiptCount: 0,
            chunkHead: null,
            chunkCount: 0,
            operationHead: null,
            operationChunkCount: 0,
            operationTotals: {
              fullReplayActions: 0,
              candidateActions: 0,
              inverseActions: 0,
              successfulRestorations: 0,
              consumedLeases: 0,
              physicalActions: 0,
              chargedActions: 0,
            },
          },
          replay,
          state: reduced.state,
          chunk: result.result.chunk,
          ordinal: 0,
        });
        expect(sealed.grant.frontier.nextCandidateIndex).toBe(1);
        expect(sealed.grant.frontier.candidateListRef).toBe(
          receipt.candidateListRef,
        );
        const resumed = await runChunk({
          source,
          state,
          route,
          root,
          nested: inventoryFor([]),
          stableAllPostAction: root,
          grant: sealed.grant,
          expectedGrantDigest: sealed.grant.grantDigest,
          now: () => 0,
          deadlineAt: 10_000,
        });
        expect(resumed.result.completed).toBe(true);
        expect(resumed.result.chunk.receipts).toHaveLength(1);
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });
});
