import { describe, expect, it } from "vitest";

import type { PreflightShardJournalRecord } from "./preflight-shard-journal-contract.ts";
import { PreflightShardJournalValidationError } from "./preflight-shard-journal-contract.ts";
import {
  createPreflightShardJournalStarted,
  createPreflightShardJournalTerminal,
} from "./preflight-shard-journal-record.ts";
import {
  passAttempt,
  RECEIPT,
  withJournalContext,
  withRecordDigest,
} from "./preflight-shard-journal-test-support.ts";
import {
  resolvePreflightShardJournalCandidates,
  validatePreflightShardJournal,
} from "./preflight-shard-journal-validation.ts";

describe("PREFLIGHT_SHARD_JOURNAL validation", () => {
  it("exposes PASS records as candidates, never as validated skips", async () => {
    await withJournalContext((context, [first, second]) => {
      const firstRecords = passAttempt({ context, state: first });
      const result = resolvePreflightShardJournalCandidates({
        context,
        records: firstRecords,
      });
      expect(result).toEqual({
        candidatePassStateIds: [first.state.stateId],
        rerunStateIds: context.shard.states
          .slice(1)
          .map(({ state }) => state.stateId),
        interruptedStateId: null,
      });
      expect(result.candidatePassStateIds).not.toContain(second.state.stateId);
    });
  });

  it("reruns an interrupted state and every later assigned state", async () => {
    await withJournalContext((context, [first]) => {
      const started = createPreflightShardJournalStarted({
        context,
        state: first,
        attempt: 1,
      });
      const result = resolvePreflightShardJournalCandidates({
        context,
        records: [started],
      });
      expect(result.candidatePassStateIds).toEqual([]);
      expect(result.interruptedStateId).toBe(first.state.stateId);
      expect(result.rerunStateIds).toHaveLength(context.shard.states.length);
    });
  });

  it.each(["FAIL", "AMBIGUOUS"] as const)(
    "allows exact-state retry after %s but rejects advancing",
    async (status) => {
      await withJournalContext((context, [first, second]) => {
        const started = createPreflightShardJournalStarted({
          context,
          state: first,
          attempt: 1,
        });
        const failed = createPreflightShardJournalTerminal({
          context,
          started,
          status,
          failureSummary: `${status.toLowerCase()} state`,
        });
        const advanced = createPreflightShardJournalStarted({
          context,
          state: second,
          attempt: 1,
          previousRecord: failed,
        });
        expect(() =>
          validatePreflightShardJournal({
            context,
            records: [started, failed, advanced],
          }),
        ).toThrow(/advances past an incomplete state/u);

        const retried = createPreflightShardJournalStarted({
          context,
          state: first,
          attempt: 2,
          previousRecord: failed,
        });
        const pass = createPreflightShardJournalTerminal({
          context,
          started: retried,
          status: "PASS",
          receipt: RECEIPT,
        });
        expect(
          validatePreflightShardJournal({
            context,
            records: [started, failed, retried, pass],
          }).attemptsByState.get(first.state.stateId)?.status,
        ).toBe("PASS");
      });
    },
  );

  it.each([
    ["sourceSha", "f".repeat(40)],
    ["sourceTree", "e".repeat(40)],
    ["treeDigest", "1".repeat(64)],
    ["sourceDigest", "2".repeat(64)],
    ["planDigest", "3".repeat(64)],
    ["assignmentDigest", "4".repeat(64)],
    ["logicalShardId", "foreign-shard"],
    ["shardIndex", 15],
    ["shardCount", 15],
    ["shardDigest", "5".repeat(64)],
    ["donorId", "Air"],
    ["shardAttemptId", "foreign-attempt"],
    ["resourceProofDigest", "6".repeat(64)],
  ] as const)("rejects recomputed %s identity drift", async (field, value) => {
    await withJournalContext((context, [first]) => {
      const [started] = passAttempt({ context, state: first });
      const changed = withRecordDigest(started, (body) => ({
        ...body,
        [field]: value,
      }));
      expect(() =>
        validatePreflightShardJournal({ context, records: [changed] }),
      ).toThrow(new RegExp(`mismatched ${field}`, "u"));
    });
  });

  it.each([
    ["planIndex", 999_999],
    ["stateDigest", "7".repeat(64)],
    ["role", "foreign-role"],
    ["catalogRoute", "foreign-route"],
    ["resolvedRoute", "/foreign"],
    ["groupKey", "foreign-group"],
  ] as const)("rejects recomputed %s state drift", async (field, value) => {
    await withJournalContext((context, [first]) => {
      const [started] = passAttempt({ context, state: first });
      const changed = withRecordDigest(started, (body) => ({
        ...body,
        [field]: value,
      }));
      expect(() =>
        validatePreflightShardJournal({ context, records: [changed] }),
      ).toThrow(PreflightShardJournalValidationError);
    });
  });

  it("rejects a foreign state body even with a recomputed record digest", async () => {
    await withJournalContext((context, [first, second]) => {
      const [started] = passAttempt({ context, state: first });
      const changed = withRecordDigest(started, (body) => ({
        ...body,
        state: { ...second.state, stateId: first.state.stateId },
      }));
      expect(() =>
        validatePreflightShardJournal({ context, records: [changed] }),
      ).toThrow(/mismatched state body/u);
    });
  });

  it.each([
    ["sequence", 3],
    ["previousRecordDigest", "8".repeat(64)],
  ] as const)("rejects a broken %s chain field", async (field, value) => {
    await withJournalContext((context, [first]) => {
      const [started] = passAttempt({ context, state: first });
      const changed = withRecordDigest(started, (body) => ({
        ...body,
        [field]: value,
      }));
      expect(() =>
        validatePreflightShardJournal({ context, records: [changed] }),
      ).toThrow(PreflightShardJournalValidationError);
    });
  });

  it("rejects skipped, reordered, duplicate, and mismatched attempts", async () => {
    await withJournalContext((context, [first, second]) => {
      const skipped = createPreflightShardJournalStarted({
        context,
        state: second,
        attempt: 1,
      });
      expect(() =>
        validatePreflightShardJournal({ context, records: [skipped] }),
      ).toThrow(/skips an assigned state/u);

      const [started, pass] = passAttempt({ context, state: first });
      const duplicate = createPreflightShardJournalStarted({
        context,
        state: first,
        attempt: 2,
        previousRecord: pass,
      });
      expect(() =>
        validatePreflightShardJournal({
          context,
          records: [started, pass, duplicate],
        }),
      ).toThrow(/starts after PASS/u);

      const wrongAttempt = withRecordDigest(pass, (body) => ({
        ...body,
        attempt: 2,
      })) as PreflightShardJournalRecord;
      expect(() =>
        validatePreflightShardJournal({
          context,
          records: [started, wrongAttempt],
        }),
      ).toThrow(/mismatched attempt/u);
    });
  });
});
