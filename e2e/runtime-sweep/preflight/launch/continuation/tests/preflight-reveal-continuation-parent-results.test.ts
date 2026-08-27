import { describe, expect, it } from "vitest";

import type { RevealReceiptChunk } from "../../../reveal/continuation/contracts/preflight-reveal-continuation-schemas.ts";
import {
  chunkDigestForBody,
  operationEvidenceDigestForBody,
} from "../../../reveal/continuation/preflight-reveal-continuation-digests.ts";
import {
  inventoryFor,
  runChunk,
} from "../../../reveal/continuation/preflight-reveal-continuation-fixture.ts";
import { continueChild } from "../preflight-reveal-continuation-parent-results.ts";
import {
  persistChunkAssets,
  withCleanSealedGrantFixture,
} from "../preflight-reveal-continuation-parent-test-fixture.ts";

describe("continuation parent progress", () => {
  it("preserves the host-checkpoint predecessor across a real child reduction", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      let clock = 0;
      const resumed = await runChunk({
        source: fixture.source,
        state: fixture.state,
        route: fixture.route,
        root: fixture.root,
        nested: inventoryFor([]),
        stableAllPostAction: fixture.root,
        grant: fixture.sealed.grant,
        expectedGrantDigest: fixture.sealed.grant.grantDigest,
        now: () => clock++,
        deadlineAt: 10_000,
      });
      await persistChunkAssets(fixture.archiveRoot, resumed.result.chunk);

      const previousCheckpointDigest = "b".repeat(64);
      const result = await continueChild({
        context: fixture.context,
        progress: {
          ...fixture.validProgress,
          previousCheckpointDigest,
          previousSampleSequence: 61,
        },
        chunk: resumed.result.chunk,
        ordinal: 1,
        expectedChildExecutionId: "e".repeat(64),
      });

      expect(result.progress).toMatchObject({
        previousCheckpointDigest,
        previousSampleSequence: 61,
        operationHead: resumed.result.chunk.operationEvidence.operationDigest,
        operationChunkCount: fixture.validProgress.operationChunkCount + 1,
      });
      expect(
        result.progress.operationTotals.physicalActions,
      ).toBeLessThanOrEqual(result.progress.operationTotals.chargedActions);
    });
  });

  it("rejects rehashed operation scope, receipt, and summary drift", async () => {
    await withCleanSealedGrantFixture(async (fixture) => {
      let clock = 0;
      const resumed = await runChunk({
        source: fixture.source,
        state: fixture.state,
        route: fixture.route,
        root: fixture.root,
        nested: inventoryFor([]),
        stableAllPostAction: fixture.root,
        grant: fixture.sealed.grant,
        expectedGrantDigest: fixture.sealed.grant.grantDigest,
        now: () => clock++,
        deadlineAt: 10_000,
      });
      await persistChunkAssets(fixture.archiveRoot, resumed.result.chunk);
      const original = resumed.result.chunk;
      const rehashed = (
        operationBody: Omit<
          RevealReceiptChunk["operationEvidence"],
          "operationDigest"
        >,
      ): RevealReceiptChunk => {
        const operationEvidence = {
          ...operationBody,
          operationDigest: operationEvidenceDigestForBody(operationBody),
        };
        const { chunkDigest: _chunkDigest, ...chunkBody } = original;
        const body = { ...chunkBody, operationEvidence };
        return { ...body, chunkDigest: chunkDigestForBody(body) };
      };
      const { operationDigest: _operationDigest, ...operationBody } =
        original.operationEvidence;
      const firstOperation = operationBody.candidateOperations[0];
      if (firstOperation === undefined)
        throw new Error("Fixture operation evidence has no candidate");
      const drifts = [
        rehashed({
          ...operationBody,
          predecessorOperationDigest: "f".repeat(64),
        }),
        rehashed({
          ...operationBody,
          candidateOperations: [
            { ...firstOperation, receiptDigest: "f".repeat(64) },
            ...operationBody.candidateOperations.slice(1),
          ],
        }),
        rehashed({
          ...operationBody,
          summary: {
            ...operationBody.summary,
            chargedActions: operationBody.summary.chargedActions + 1,
          },
        }),
      ];
      for (const chunk of drifts)
        await expect(
          continueChild({
            context: fixture.context,
            progress: fixture.validProgress,
            chunk,
            ordinal: 1,
            expectedChildExecutionId: "e".repeat(64),
          }),
        ).rejects.toThrow(/operation/iu);
    });
  });
});
