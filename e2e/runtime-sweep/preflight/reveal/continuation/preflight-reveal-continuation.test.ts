import { describe, expect, it } from "vitest";

import {
  controlFor,
  inventoryFor,
  runBootstrap,
  runChunk,
  selectionFor,
  withSource,
} from "./preflight-reveal-continuation-fixture.ts";
import { assertReceiptChunkContract } from "./preflight-reveal-continuation-validators.ts";

describe("R188 v3 reveal continuation", () => {
  it("returns an observation-only bootstrap when the initial frontier is empty", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const result = await runBootstrap({
        source,
        state,
        route,
        root: inventoryFor([]),
        nested: inventoryFor([]),
        now: () => 0,
        deadlineAt: 10_000,
      });

      expect(result.result).toMatchObject({
        status: "BOOTSTRAP",
        completedCandidateCount: 0,
      });
      expect("chunk" in result.result).toBe(false);
      expect("completed" in result.result).toBe(false);
      expect(result.events).toEqual([]);
    });
  });

  it("emits a child-owned disjoint receipt suffix and never a parent PASS", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const result = await runChunk({
        source,
        state,
        route,
        root: inventoryFor([controlFor("button:a-open:0", "Open panel", 0)]),
        nested: inventoryFor([]),
        now: () => 0,
        deadlineAt: 10_000,
      });
      expect(result.result.status).toBe("CHUNK");
      expect(result.events).toContain("execute:button:a-open:0");
      expect(result.result.chunk.receipts).toHaveLength(1);
      expect(result.result.chunk.receiptCount).toBe(
        result.result.chunk.receipts.length,
      );
      expect("passDigest" in result.result.chunk).toBe(false);
      assertReceiptChunkContract(result.result.chunk);
    });
  });
});
