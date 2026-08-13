import { rm } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  appendPreflightShardJournalStarted,
  appendPreflightShardJournalTerminal,
  preflightShardJournalPathFor,
  terminalizeInterruptedPreflightShardState,
} from "./preflight-shard-journal-io.ts";
import { withReceiptFixture } from "./preflight-shard-receipt-test-support.ts";
import { resolvePreflightShardResume } from "./preflight-shard-resume.ts";

describe("preflight shard receipt-authorized resume", () => {
  it("authorizes only the leading revalidated PASS prefix", async () => {
    await withReceiptFixture(async (fixture) => {
      const journalPath = preflightShardJournalPathFor(fixture.context);
      await appendPreflightShardJournalStarted({
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        filePath: journalPath,
        state: fixture.state,
      });
      await appendPreflightShardJournalTerminal({
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        filePath: journalPath,
        status: "PASS",
        receiptPath: fixture.receiptPath,
      });
      const plan = await resolvePreflightShardResume({
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        journalPath,
      });
      expect(plan.authorizedSkipStateIds).toEqual([
        fixture.state.state.stateId,
      ]);
      expect(plan.rerunStateIds[0]).toBe(fixture.nextState.state.stateId);
      expect(
        plan.terminalPasses.get(fixture.state.state.stateId)?.segment.state,
      ).toEqual(fixture.context.source.plan.states[fixture.state.planIndex]);
    });
  });

  it("requires AMBIGUOUS terminalization before whole-state retry", async () => {
    await withReceiptFixture(async (fixture) => {
      const filePath = preflightShardJournalPathFor(fixture.context);
      await appendPreflightShardJournalStarted({
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        filePath,
        state: fixture.state,
      });
      await expect(
        appendPreflightShardJournalStarted({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath,
          state: fixture.state,
        }),
      ).rejects.toThrow(/must be terminalized/u);
      const ambiguous = await terminalizeInterruptedPreflightShardState({
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        filePath,
      });
      expect(ambiguous.status).toBe("AMBIGUOUS");
      const retry = await appendPreflightShardJournalStarted({
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        filePath,
        state: fixture.state,
      });
      expect(retry.attempt).toBe(2);
      await expect(
        appendPreflightShardJournalStarted({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath,
          state: fixture.nextState,
        }),
      ).rejects.toThrow(/resume exact state/u);
    });
  });

  it("does not authorize a PASS when its receipt bytes disappear", async () => {
    await withReceiptFixture(async (fixture) => {
      const journalPath = preflightShardJournalPathFor(fixture.context);
      await appendPreflightShardJournalStarted({
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        filePath: journalPath,
        state: fixture.state,
      });
      await appendPreflightShardJournalTerminal({
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        filePath: journalPath,
        status: "PASS",
        receiptPath: fixture.receiptPath,
      });
      await rm(fixture.receiptPath);
      await expect(
        resolvePreflightShardResume({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          journalPath,
        }),
      ).rejects.toThrow(/unavailable/u);
    });
  });
});
