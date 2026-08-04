import { describe, expect, it, vi } from "vitest";

import {
  type AutoCarryOverDeps,
  type AutoCarryOverOutcome,
  carryOverIntoOpenedPeriod,
  runAutoCarryOverWithRetry,
} from "./auto-carry-over";
import { CarryOverDomainError } from "./carry-over.service";

function makeDeps(overrides: Partial<AutoCarryOverDeps> = {}): {
  deps: AutoCarryOverDeps;
  spies: {
    findPreviousReportId: ReturnType<typeof vi.fn>;
    findExecutionByDedupeKey: ReturnType<typeof vi.fn>;
    executeCarryOver: ReturnType<typeof vi.fn>;
    listActiveSourceAuthorIds: ReturnType<typeof vi.fn>;
    ensureSection: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
} {
  const spies = {
    findPreviousReportId: vi.fn().mockResolvedValue("source-1"),
    findExecutionByDedupeKey: vi.fn().mockResolvedValue(null),
    executeCarryOver: vi.fn().mockResolvedValue({}),
    listActiveSourceAuthorIds: vi.fn().mockResolvedValue(["lead-1", "lead-2"]),
    ensureSection: vi.fn().mockResolvedValue(undefined),
    info: vi.fn(),
    warn: vi.fn(),
  };
  const deps: AutoCarryOverDeps = {
    repository: {
      findPreviousReportId: spies.findPreviousReportId,
      findExecutionByDedupeKey: spies.findExecutionByDedupeKey,
    },
    carryOverService: { executeCarryOver: spies.executeCarryOver },
    listActiveSourceAuthorIds: spies.listActiveSourceAuthorIds,
    ensureSection: spies.ensureSection,
    logger: { info: spies.info, warn: spies.warn },
    ...overrides,
  };
  return { deps, spies };
}

describe("carryOverIntoOpenedPeriod", () => {
  it("materializes each active prior author's section, then executes once", async () => {
    const { deps, spies } = makeDeps();

    const outcome = await carryOverIntoOpenedPeriod(deps, "target-1");

    expect(spies.ensureSection).toHaveBeenCalledTimes(2);
    expect(spies.ensureSection).toHaveBeenCalledWith("target-1", "lead-1");
    expect(spies.ensureSection).toHaveBeenCalledWith("target-1", "lead-2");
    expect(spies.executeCarryOver).toHaveBeenCalledExactlyOnceWith(
      "source-1",
      "target-1",
    );
    expect(spies.info).toHaveBeenCalledExactlyOnceWith(
      "auto carry-over completed",
      {
        sourceReportId: "source-1",
        targetReportId: "target-1",
        authors: 2,
      },
    );
    expect(spies.ensureSection.mock.invocationCallOrder.at(-1)).toBeLessThan(
      spies.executeCarryOver.mock.invocationCallOrder[0] ?? 0,
    );
    expect(outcome).toEqual({
      status: "completed",
      sourceReportId: "source-1",
      targetReportId: "target-1",
      authorCount: 2,
    });
  });

  it("is a no-op when there is no prior period", async () => {
    const { deps, spies } = makeDeps();
    spies.findPreviousReportId.mockResolvedValue(null);

    const outcome = await carryOverIntoOpenedPeriod(deps, "target-1");

    expect(spies.findExecutionByDedupeKey).not.toHaveBeenCalled();
    expect(spies.ensureSection).not.toHaveBeenCalled();
    expect(spies.executeCarryOver).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      status: "skipped",
      targetReportId: "target-1",
      reason: "no-prior-period",
    });
  });

  it("short-circuits on an existing execution before any section work", async () => {
    const { deps, spies } = makeDeps();
    spies.findExecutionByDedupeKey.mockResolvedValue({ id: "exec-1" });

    const outcome = await carryOverIntoOpenedPeriod(deps, "target-1");

    expect(spies.findExecutionByDedupeKey).toHaveBeenCalledExactlyOnceWith(
      "source-1:target-1",
    );
    expect(spies.listActiveSourceAuthorIds).not.toHaveBeenCalled();
    expect(spies.ensureSection).not.toHaveBeenCalled();
    expect(spies.executeCarryOver).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      status: "skipped",
      targetReportId: "target-1",
      reason: "execution-exists",
    });
  });

  it("is a no-op when the prior period has no active authors", async () => {
    const { deps, spies } = makeDeps();
    spies.listActiveSourceAuthorIds.mockResolvedValue([]);

    const outcome = await carryOverIntoOpenedPeriod(deps, "target-1");

    expect(spies.ensureSection).not.toHaveBeenCalled();
    expect(spies.executeCarryOver).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      status: "skipped",
      targetReportId: "target-1",
      reason: "no-active-authors",
    });
  });

  // A failure must be reported by the typed result contract, never resolved
  // as success.
  it("reports a benign domain rejection as a failed outcome", async () => {
    const { deps, spies } = makeDeps();
    spies.executeCarryOver.mockRejectedValue(
      new CarryOverDomainError(
        "Carry-over cannot overwrite a submitted target section.",
      ),
    );

    const outcome = await carryOverIntoOpenedPeriod(deps, "target-1");

    expect(spies.info).toHaveBeenCalledWith(
      "auto carry-over skipped",
      expect.objectContaining({ targetReportId: "target-1" }),
    );
    expect(spies.warn).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      status: "failed",
      targetReportId: "target-1",
      expected: true,
      reason: "Carry-over cannot overwrite a submitted target section.",
    });
  });

  it("reports an unexpected failure as a failed outcome", async () => {
    const { deps, spies } = makeDeps();
    spies.findPreviousReportId.mockRejectedValue(new Error("db down"));

    const outcome = await carryOverIntoOpenedPeriod(deps, "target-1");

    expect(spies.warn).toHaveBeenCalledWith(
      "auto carry-over skipped",
      expect.objectContaining({ reason: "db down" }),
    );
    expect(outcome).toEqual({
      status: "failed",
      targetReportId: "target-1",
      expected: false,
      reason: "db down",
    });
  });
});

describe("runAutoCarryOverWithRetry", () => {
  it("retries one unexpected failure and returns the retry outcome", async () => {
    const failed: AutoCarryOverOutcome = {
      status: "failed",
      targetReportId: "target-1",
      expected: false,
      reason: "db down",
    };
    const completed: AutoCarryOverOutcome = {
      status: "completed",
      sourceReportId: "source-1",
      targetReportId: "target-1",
      authorCount: 2,
    };
    const autoCarryOver = vi
      .fn<(targetReportId: string) => Promise<AutoCarryOverOutcome>>()
      .mockResolvedValueOnce(failed)
      .mockResolvedValueOnce(completed);

    await expect(
      runAutoCarryOverWithRetry(autoCarryOver, "target-1"),
    ).resolves.toEqual(completed);
    expect(autoCarryOver).toHaveBeenCalledTimes(2);
  });

  it("does not retry an expected terminal failure", async () => {
    const failed: AutoCarryOverOutcome = {
      status: "failed",
      targetReportId: "target-1",
      expected: true,
      reason: "target submitted",
    };
    const autoCarryOver = vi
      .fn<(targetReportId: string) => Promise<AutoCarryOverOutcome>>()
      .mockResolvedValue(failed);

    await expect(
      runAutoCarryOverWithRetry(autoCarryOver, "target-1"),
    ).resolves.toEqual(failed);
    expect(autoCarryOver).toHaveBeenCalledTimes(1);
  });
});
