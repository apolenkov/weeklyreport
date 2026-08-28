import { describe, expect, it, vi } from "vitest";

import { waitForLoopbackPortsFree } from "./cleanup.ts";
import {
  acceptanceResultFor,
  runAcceptanceSetup,
  sourceIdentityFor,
  type SourceReceipt,
} from "./lifecycle.ts";

const SOURCE = { sha: "a".repeat(40), tree: "b".repeat(40) } as const;

describe("acceptance lifecycle", () => {
  it("records PASS only after database, Redis, and source read-back", async () => {
    const order: string[] = [];
    const receipts: SourceReceipt[] = [];
    const readSource = vi.fn(() => {
      order.push("source");
      return SOURCE;
    });

    const receipt = await runAcceptanceSetup({
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

    expect(order).toEqual(["source", "database", "redis", "source"]);
    expect(receipts.map(({ setupStatus }) => setupStatus)).toEqual([
      "STARTED",
      "PASS",
    ]);
    expect(receipt.setupStatus).toBe("PASS");
  });

  it("retains a setup failure without promoting it", async () => {
    const receipts: SourceReceipt[] = [];
    const failure = new Error("seed failed");

    await expect(
      runAcceptanceSetup({
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
