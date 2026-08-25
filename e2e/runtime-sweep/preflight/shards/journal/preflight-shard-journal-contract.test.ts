import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../../support/ids.ts";
import {
  parsePreflightShardJournalRecord,
  PreflightShardJournalError,
  preflightShardJournalRecordBody,
} from "./preflight-shard-journal-contract.ts";
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

describe("PREFLIGHT_SHARD_JOURNAL record contract", () => {
  it("creates a deterministic STARTED -> PASS hash chain", async () => {
    await withJournalContext((context, [state]) => {
      const [started, pass] = passAttempt({ context, state });
      expect(started.sequence).toBe(1);
      expect(started.previousRecordDigest).toBeNull();
      expect(pass.sequence).toBe(2);
      expect(pass.previousRecordDigest).toBe(started.recordDigest);
      expect(pass.resourceProofDigest).toBe(context.resourceProof.proofDigest);
      expect(parsePreflightShardJournalRecord(pass)).toEqual(pass);
    });
  });

  it("requires complete receipt references only for PASS", async () => {
    await withJournalContext((context, [state]) => {
      const started = createPreflightShardJournalStarted({
        context,
        state,
        attempt: 1,
      });
      expect(() =>
        createPreflightShardJournalTerminal({
          context,
          started,
          status: "PASS",
        }),
      ).toThrow(PreflightShardJournalError);
      expect(() =>
        createPreflightShardJournalTerminal({
          context,
          started,
          status: "PASS",
          receipt: RECEIPT,
          failureSummary: "impossible mixed result",
        }),
      ).toThrow(PreflightShardJournalError);
    });
  });

  it.each(["FAIL", "AMBIGUOUS"] as const)(
    "%s requires a sanitized failure summary and rejects receipts",
    async (status) => {
      await withJournalContext((context, [state]) => {
        const started = createPreflightShardJournalStarted({
          context,
          state,
          attempt: 1,
        });
        expect(() =>
          createPreflightShardJournalTerminal({ context, started, status }),
        ).toThrow(PreflightShardJournalError);
        expect(() =>
          createPreflightShardJournalTerminal({
            context,
            started,
            status,
            receipt: RECEIPT,
            failureSummary: "bounded failure",
          }),
        ).toThrow(PreflightShardJournalError);
        expect(() =>
          createPreflightShardJournalTerminal({
            context,
            started,
            status,
            failureSummary: "line one\nline two",
          }),
        ).toThrow(PreflightShardJournalError);
      });
    },
  );

  it.each([
    "postgres://admin:supersecret@127.0.0.1/db",
    "Authorization: Bearer abc.def.ghi",
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.jwt-secret",
    "apiKey=example-token",
  ])(
    "redacts factory failure evidence and rejects raw crafted input: %s",
    async (secret) => {
      await withJournalContext((context, [state]) => {
        const started = createPreflightShardJournalStarted({
          context,
          state,
          attempt: 1,
        });
        const failed = createPreflightShardJournalTerminal({
          context,
          started,
          status: "FAIL",
          failureSummary: secret,
        });
        expect(failed.failureSummary).toContain("[REDACTED]");
        expect(JSON.stringify(failed)).not.toContain(secret);

        const craftedBody = {
          ...preflightShardJournalRecordBody(failed),
          failureSummary: secret,
        };
        expect(() =>
          parsePreflightShardJournalRecord({
            ...craftedBody,
            recordDigest: sha256Hex(craftedBody),
          }),
        ).toThrow(/must already be redacted/u);
      });
    },
  );

  it("rejects unexpected fields before a journal can carry secrets", async () => {
    await withJournalContext((context, [state]) => {
      const [started] = passAttempt({ context, state });
      const candidate = withRecordDigest(started, (body) => ({
        ...body,
        databaseUrl: "postgres://secret",
      }));
      expect(() => parsePreflightShardJournalRecord(candidate)).toThrow(
        PreflightShardJournalError,
      );
    });
  });

  it("rejects a recomputed record whose body no longer matches its digest", async () => {
    await withJournalContext((context, [state]) => {
      const [started] = passAttempt({ context, state });
      expect(() =>
        parsePreflightShardJournalRecord({
          ...started,
          attempt: 2,
        }),
      ).toThrow(/digest does not match contents/u);
    });
  });

  it("does not build a terminal record from another terminal record", async () => {
    await withJournalContext((context, [state]) => {
      const [, pass] = passAttempt({ context, state });
      expect(() =>
        createPreflightShardJournalTerminal({
          context,
          started: pass,
          status: "PASS",
          receipt: RECEIPT,
        }),
      ).toThrow(/exact preceding STARTED/u);
    });
  });
});
