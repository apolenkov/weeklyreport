import { describe, expect, it } from "vitest";

import type { RevealCandidateFailure } from "../interaction/preflight-reveal-branches.ts";
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

  it("forwards the optional candidate-failure callback without replacing the error", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const failures: Pick<
        RevealCandidateFailure,
        "candidateIndex" | "candidateIdentity"
      >[] = [];

      await expect(
        runChunk({
          source,
          state,
          route,
          root: inventoryFor([controlFor("button:failure:0", "Failure", 0)]),
          nested: inventoryFor([]),
          maxRevealActions: 0,
          onCandidateFailure: ({ candidateIndex, candidateIdentity }) =>
            failures.push({ candidateIndex, candidateIdentity }),
          now: () => 0,
          deadlineAt: 10_000,
        }),
      ).rejects.toThrow("Reveal action bound exceeded");

      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatchObject({
        candidateIndex: 0,
      });
      expect(failures[0]?.candidateIdentity).toMatch(/^[0-9a-f]{64}$/u);
    });
  });

  it("freezes a select input before sealing its candidate identity and receipt", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const root = inventoryFor([
        {
          ...controlFor("combobox:parent:0", "Parent", 0),
          role: "combobox",
          tagName: "select",
        },
      ]);
      const result = await runChunk({
        source,
        state,
        route,
        root,
        nested: inventoryFor([]),
        stableAllPostAction: root,
        now: () => 0,
        deadlineAt: 10_000,
      });
      const receipt = result.result.chunk.receipts[0];
      expect(receipt?.representativeInput).toEqual({
        kind: "select",
        value: "parent-product",
        index: 1,
      });
      expect(receipt?.transition.representativeInput).toEqual(
        receipt?.representativeInput,
      );
      assertReceiptChunkContract(result.result.chunk);
    });
  });

  it("reuses the live nested branch after freezing its select input", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const events: string[] = [];
      const nested = inventoryFor([
        {
          ...controlFor("select:nested:0", "Nested parent", 0),
          role: "combobox",
          tagName: "select",
        },
      ]);

      await runChunk({
        source,
        state,
        route,
        root: inventoryFor([controlFor("button:a-open:0", "Open panel", 0)]),
        nested,
        eventSink: events,
        now: () => 0,
        deadlineAt: 10_000,
      });

      expect(
        events.filter(
          (event) =>
            event.startsWith("execute:") || event.startsWith("freeze:"),
        ),
      ).toEqual([
        "execute:button:a-open:0",
        "execute:button:a-open:0",
        "freeze:select:nested:0",
        "execute:select:nested:0",
      ]);
    });
  });
});
