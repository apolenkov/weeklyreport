import { describe, expect, it } from "vitest";

import {
  controlFor,
  inventoryFor,
  runChunk,
  selectionFor,
  withSource,
} from "./preflight-reveal-continuation-fixture.ts";

describe("R188 suffix scaling contract", () => {
  it("keeps the first child artifact proportional to its new suffix", async () => {
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
      const { chunk } = result.result;
      expect(chunk.predecessorReceiptCount).toBe(0);
      expect(chunk.receiptCount).toBe(chunk.receipts.length);
      expect(chunk.predecessorChunkCount).toBe(0);
      expect(chunk.chunkSequence).toBe(1);
    });
  });
});
