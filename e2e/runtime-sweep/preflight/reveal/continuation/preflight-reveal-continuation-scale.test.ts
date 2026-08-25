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

  it.each([
    [
      "terminal-candidate limit",
      { maxTerminalCandidates: 1, maxRevealActionDelta: 1024 },
      [0],
      10_000,
    ],
    [
      "reveal-action delta limit",
      { maxTerminalCandidates: 256, maxRevealActionDelta: 1 },
      [0],
      10_000,
    ],
    [
      "soft wall limit",
      { maxTerminalCandidates: 256, maxRevealActionDelta: 1024 },
      [0, 2],
      1,
    ],
  ] as const)(
    "yields cooperatively after a complete candidate at the %s",
    async (_name, cooperativeLimits, nowValues, deadlineAt) => {
      await withSource(async (source) => {
        const state = source.plan.states[0];
        if (state === undefined) throw new Error("Fixture has no source state");
        const { route } = selectionFor(source, state.stateId);
        let nowIndex = 0;
        const now = (): number => {
          const value = nowValues[Math.min(nowIndex, nowValues.length - 1)];
          nowIndex += 1;
          return value ?? 0;
        };
        const result = await runChunk({
          source,
          state,
          route,
          root: inventoryFor([
            controlFor("button:a-open:0", "Open panel A", 0),
            controlFor("button:b-open:1", "Open panel B", 1),
          ]),
          nested: inventoryFor([]),
          cooperativeLimits,
          now,
          deadlineAt,
        });

        expect(result.result.completed).toBe(false);
        expect(result.result.chunk.receipts).toHaveLength(1);
        expect(result.result.completedCandidateCount).toBe(1);
      });
    },
  );
});
