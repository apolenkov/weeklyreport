import { describe, expect, it, vi } from "vitest";

import { waitForLoopbackPortsFree } from "./cleanup.ts";
import {
  acceptanceResultFor,
  runAcceptanceSetup,
  runAcceptanceTeardown,
  sourceIdentityFor,
  type SourceReceipt,
} from "./lifecycle.ts";

const SOURCE = { sha: "a".repeat(40), tree: "b".repeat(40) } as const;
const RUN_ID = "11111111-1111-4111-8111-111111111111";

describe("acceptance lifecycle", () => {
  it("records PASS only after database, Redis, and source read-back", async () => {
    const order: string[] = [];
    const receipts: SourceReceipt[] = [];
    const readSource = vi.fn(() => {
      order.push("source");
      return SOURCE;
    });

    const receipt = await runAcceptanceSetup({
      invalidatePriorRun: () => {
        order.push("invalidate");
        return Promise.resolve();
      },
      newRunId: () => RUN_ID,
      now: () => "2026-08-28T00:00:00.000Z",
      readSource,
      resetDatabase: () => order.push("database"),
      resetRedis: () => {
        order.push("redis");
        return Promise.resolve();
      },
      write: (value) => {
        receipts.push(value);
        return Promise.resolve();
      },
    });

    expect(order).toEqual([
      "source",
      "invalidate",
      "database",
      "redis",
      "source",
    ]);
    expect(receipts.map(({ setupStatus }) => setupStatus)).toEqual([
      "STARTED",
      "PASS",
    ]);
    expect(receipt.setupStatus).toBe("PASS");
    expect(receipt.runId).toBe(RUN_ID);
  });

  it("retains a setup failure without promoting it", async () => {
    const receipts: SourceReceipt[] = [];
    const failure = new Error("seed failed");

    await expect(
      runAcceptanceSetup({
        invalidatePriorRun: () => Promise.resolve(),
        newRunId: () => RUN_ID,
        now: () => "2026-08-28T00:00:00.000Z",
        readSource: () => SOURCE,
        resetDatabase: () => {
          throw failure;
        },
        resetRedis: () => Promise.resolve(),
        write: (value) => {
          receipts.push(value);
          return Promise.resolve();
        },
      }),
    ).rejects.toBe(failure);
    expect(receipts.at(-1)).toMatchObject({
      setupError: "seed failed",
      setupStatus: "FAIL",
    });
  });

  it("invalidates a same-SHA terminal receipt before an aborted rerun", async () => {
    const order: string[] = [];
    await expect(
      runAcceptanceSetup({
        invalidatePriorRun: () => {
          order.push("invalidate-old-result-and-teardown");
          return Promise.resolve();
        },
        newRunId: () => RUN_ID,
        now: () => "2026-08-28T00:00:00.000Z",
        readSource: () => SOURCE,
        resetDatabase: () => {
          order.push("reset-failed");
          throw new Error("aborted rerun");
        },
        resetRedis: () => Promise.resolve(),
        write: (receipt) => {
          order.push(receipt.setupStatus);
          return Promise.resolve();
        },
      }),
    ).rejects.toThrow("aborted rerun");
    expect(order).toEqual([
      "invalidate-old-result-and-teardown",
      "STARTED",
      "reset-failed",
      "FAIL",
    ]);
  });

  it("resets disposable database and Redis state before a PASS teardown receipt", async () => {
    const order: string[] = [];
    const receipts = [] as Awaited<ReturnType<typeof runAcceptanceTeardown>>[];

    const receipt = await runAcceptanceTeardown({
      now: () => "2026-08-28T00:00:00.000Z",
      readSource: () => {
        order.push("source");
        return SOURCE;
      },
      readSourceReceipt: () =>
        Promise.resolve({
          ...SOURCE,
          recordedAt: "2026-08-28T00:00:00.000Z",
          runId: RUN_ID,
          setupStatus: "PASS",
        }),
      resetDatabase: () => order.push("database"),
      resetRedis: () => {
        order.push("redis");
        return Promise.resolve();
      },
      verifyRuntimeStopped: () => {
        order.push("listeners");
        return Promise.resolve(true);
      },
      write: (value) => {
        receipts.push(value);
        return Promise.resolve();
      },
    });

    expect(order).toEqual(["listeners", "database", "redis", "source"]);
    expect(receipt).toMatchObject({
      cleanupStatus: "PASS",
      clients: "TRANSIENT_CLIENTS_CLOSED",
      containers: "NONE_CREATED",
      databaseState: "DETERMINISTIC_FULL_SEED",
      listenersFree: true,
      redisState: "RESERVED_DB_15_EMPTY",
      runId: RUN_ID,
      sourceUnchanged: true,
      volumes: "NONE_CREATED",
    });
    expect(receipts).toEqual([receipt]);
  });

  it("records a failed teardown without promoting partial cleanup", async () => {
    const receipts = [] as Awaited<ReturnType<typeof runAcceptanceTeardown>>[];
    const failure = new Error("Redis cleanup failed");

    await expect(
      runAcceptanceTeardown({
        now: () => "2026-08-28T00:00:00.000Z",
        readSource: () => SOURCE,
        readSourceReceipt: () =>
          Promise.resolve({
            ...SOURCE,
            recordedAt: "2026-08-28T00:00:00.000Z",
            runId: RUN_ID,
            setupStatus: "PASS",
          }),
        resetDatabase: () => undefined,
        resetRedis: () => Promise.reject(failure),
        verifyRuntimeStopped: () => Promise.resolve(true),
        write: (value) => {
          receipts.push(value);
          return Promise.resolve();
        },
      }),
    ).rejects.toBe(failure);
    expect(receipts.at(-1)).toMatchObject({
      cleanupError: "Redis cleanup failed",
      cleanupStatus: "FAIL",
      databaseState: "NOT_PROVEN",
      listenersFree: false,
      redisState: "NOT_PROVEN",
      sourceUnchanged: false,
    });
  });

  it("does not reset state while owned runtime listeners remain open", async () => {
    const resetDatabase = vi.fn();
    const resetRedis = vi.fn(() => Promise.resolve());
    await expect(
      runAcceptanceTeardown({
        now: () => "2026-08-28T00:00:00.000Z",
        readSource: () => SOURCE,
        readSourceReceipt: () =>
          Promise.resolve({
            ...SOURCE,
            recordedAt: "2026-08-28T00:00:00.000Z",
            runId: RUN_ID,
            setupStatus: "PASS",
          }),
        resetDatabase,
        resetRedis,
        verifyRuntimeStopped: () => Promise.resolve(false),
        write: () => Promise.resolve(),
      }),
    ).rejects.toThrow(/stopped runtime listeners/u);
    expect(resetDatabase).not.toHaveBeenCalled();
    expect(resetRedis).not.toHaveBeenCalled();
  });

  it("rejects dirty or changing source identity", () => {
    expect(() =>
      sourceIdentityFor("/repo", (args) =>
        args[0] === "status" ? " M apps/web/page.tsx" : "a".repeat(40),
      ),
    ).toThrow(/clean source worktree/u);
  });

  it.each(["failed", "timedout", "interrupted"] as const)(
    "keeps cleanup proven while %s test execution remains failed",
    (playwrightStatus) => {
      expect(
        acceptanceResultFor({
          budgetValid: true,
          listenersFree: true,
          ownedFilesRemoved: true,
          playwrightStatus,
          setupStatus: "PASS",
          teardownValid: true,
        }),
      ).toEqual({
        cleanupStatus: "PASS",
        overallStatus: "FAIL_NOT_PROVEN",
        playwrightStatus,
      });
    },
  );

  it("fails closed when setup or listener cleanup is missing", () => {
    expect(
      acceptanceResultFor({
        budgetValid: true,
        listenersFree: false,
        ownedFilesRemoved: false,
        playwrightStatus: "passed",
        setupStatus: "MISSING",
        teardownValid: false,
      }),
    ).toMatchObject({
      cleanupStatus: "FAIL_NOT_PROVEN",
      overallStatus: "FAIL_NOT_PROVEN",
    });
  });

  it("passes only when setup, tests, teardown, and listeners all pass", () => {
    expect(
      acceptanceResultFor({
        budgetValid: true,
        listenersFree: true,
        ownedFilesRemoved: true,
        playwrightStatus: "passed",
        setupStatus: "PASS",
        teardownValid: true,
      }),
    ).toEqual({
      cleanupStatus: "PASS",
      overallStatus: "PASS",
      playwrightStatus: "passed",
    });
  });

  it("does not promote a passing Playwright run with a failed budget", () => {
    expect(
      acceptanceResultFor({
        budgetValid: false,
        listenersFree: true,
        ownedFilesRemoved: true,
        playwrightStatus: "passed",
        setupStatus: "PASS",
        teardownValid: true,
      }),
    ).toEqual({
      cleanupStatus: "PASS",
      overallStatus: "FAIL_NOT_PROVEN",
      playwrightStatus: "passed",
    });
  });
});

describe("listener cleanup", () => {
  it("passes when every owned port is free", async () => {
    await expect(
      waitForLoopbackPortsFree([3122, 3125], {
        isOpen: () => Promise.resolve(false),
        timeoutMs: 1,
      }),
    ).resolves.toBe(true);
  });

  it("fails within its bound while an owned port stays occupied", async () => {
    vi.useFakeTimers();
    const result = waitForLoopbackPortsFree([3122], {
      isOpen: () => Promise.resolve(true),
      timeoutMs: 200,
    });
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe(false);
    vi.useRealTimers();
  });
});
