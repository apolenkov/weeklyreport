import { describe, expect, it, vi } from "vitest";

import {
  type AutoCarryOverDeps,
  carryOverIntoOpenedPeriod,
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

    await carryOverIntoOpenedPeriod(deps, "target-1");

    expect(spies.ensureSection).toHaveBeenCalledTimes(2);
    expect(spies.ensureSection).toHaveBeenCalledWith("target-1", "lead-1");
    expect(spies.ensureSection).toHaveBeenCalledWith("target-1", "lead-2");
    expect(spies.executeCarryOver).toHaveBeenCalledExactlyOnceWith(
      "source-1",
      "target-1",
    );
  });

  it("is a no-op when there is no prior period", async () => {
    const { deps, spies } = makeDeps();
    spies.findPreviousReportId.mockResolvedValue(null);

    await carryOverIntoOpenedPeriod(deps, "target-1");

    expect(spies.findExecutionByDedupeKey).not.toHaveBeenCalled();
    expect(spies.ensureSection).not.toHaveBeenCalled();
    expect(spies.executeCarryOver).not.toHaveBeenCalled();
  });

  it("short-circuits on an existing execution before any section work", async () => {
    const { deps, spies } = makeDeps();
    spies.findExecutionByDedupeKey.mockResolvedValue({ id: "exec-1" });

    await carryOverIntoOpenedPeriod(deps, "target-1");

    expect(spies.findExecutionByDedupeKey).toHaveBeenCalledExactlyOnceWith(
      "source-1:target-1",
    );
    expect(spies.listActiveSourceAuthorIds).not.toHaveBeenCalled();
    expect(spies.ensureSection).not.toHaveBeenCalled();
    expect(spies.executeCarryOver).not.toHaveBeenCalled();
  });

  it("is a no-op when the prior period has no active authors", async () => {
    const { deps, spies } = makeDeps();
    spies.listActiveSourceAuthorIds.mockResolvedValue([]);

    await carryOverIntoOpenedPeriod(deps, "target-1");

    expect(spies.ensureSection).not.toHaveBeenCalled();
    expect(spies.executeCarryOver).not.toHaveBeenCalled();
  });

  it("swallows a benign domain rejection and logs at info", async () => {
    const { deps, spies } = makeDeps();
    spies.executeCarryOver.mockRejectedValue(
      new CarryOverDomainError(
        "Carry-over cannot overwrite a submitted target section.",
      ),
    );

    await expect(
      carryOverIntoOpenedPeriod(deps, "target-1"),
    ).resolves.toBeUndefined();

    expect(spies.info).toHaveBeenCalledWith(
      "auto carry-over skipped",
      expect.objectContaining({ targetReportId: "target-1" }),
    );
    expect(spies.warn).not.toHaveBeenCalled();
  });

  it("swallows an unexpected failure and logs at warn", async () => {
    const { deps, spies } = makeDeps();
    spies.findPreviousReportId.mockRejectedValue(new Error("db down"));

    await expect(
      carryOverIntoOpenedPeriod(deps, "target-1"),
    ).resolves.toBeUndefined();

    expect(spies.warn).toHaveBeenCalledWith(
      "auto carry-over skipped",
      expect.objectContaining({ reason: "db down" }),
    );
  });
});
