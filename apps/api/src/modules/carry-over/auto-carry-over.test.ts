import { describe, expect, it, vi } from "vitest";

import { publishedSnapshotFixture } from "../../test-utils/prisma-test-helper.js";
import {
  type AutoCarryOverDeps,
  type AutoCarryOverOutcome,
  buildAutoCarryOverDeps,
  carryOverIntoOpenedPeriod,
  runAutoCarryOverWithRetry,
} from "./auto-carry-over";
import { CarryOverDomainError } from "./carry-over.service";

const PUBLISHED_REPORT_ID = "11111111-1111-4111-8111-111111111111";
const ACTIVE_AUTHOR_ID = "22222222-2222-4222-8222-222222222222";
const DEACTIVATED_AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const MISSING_AUTHOR_ID = "44444444-4444-4444-8444-444444444444";

const sectionOwner = (authorId: string, index: number) => ({
  reportSectionId: `55555555-5555-4555-8555-55555555555${String(index)}`,
  authorId,
  authorName: `Published Lead ${String(index)}`,
  groupId: "66666666-6666-4666-8666-666666666666",
  groupName: "Published Group",
});

function publishedSourcePrisma(
  authorIds: readonly string[],
  activeAuthorIds: readonly string[] = [ACTIVE_AUTHOR_ID],
) {
  const findActiveUsers = vi
    .fn()
    .mockResolvedValue(activeAuthorIds.map((id) => ({ id })));
  const findTargetSection = vi
    .fn()
    .mockResolvedValue({ id: "77777777-7777-4777-8777-777777777777" });
  const prisma = {
    report: {
      findUnique: vi.fn().mockResolvedValue({
        periodStatus: "published",
        publishedSnapshot: publishedSnapshotFixture({
          reportId: PUBLISHED_REPORT_ID,
          periodStart: "2026-04-27",
          periodEnd: "2026-05-01",
          publishedAt: "2026-05-04T09:30:00.000Z",
          sectionOwners: authorIds.map(sectionOwner),
        }),
      }),
    },
    user: { findMany: findActiveUsers },
    reportSection: { findMany: vi.fn(), findUnique: findTargetSection },
    $queryRaw: vi.fn().mockResolvedValue([
      {
        id: "88888888-8888-4888-8888-888888888888",
        status: "draft",
        periodState: "open",
        periodStatus: "open",
        archived: false,
        autoPublished: false,
        autoArchived: false,
        publishedAt: null,
        publishedById: null,
        reopenedAt: null,
      },
    ]),
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(
    (callback: (client: typeof prisma) => unknown) =>
      Promise.resolve(callback(prisma)),
  );
  return { prisma, findActiveUsers, findTargetSection };
}

function buildPublishedSourceDeps(prisma: object) {
  const findPreviousReportId = vi.fn().mockResolvedValue(PUBLISHED_REPORT_ID);
  const findExecutionByDedupeKey = vi.fn().mockResolvedValue(null);
  const executeCarryOver = vi.fn().mockResolvedValue({});
  const deps = buildAutoCarryOverDeps({
    prisma: prisma as never,
    repository: {
      findPreviousReportId,
      findExecutionByDedupeKey,
    },
    carryOverService: { executeCarryOver },
    logger: { info: vi.fn(), warn: vi.fn() },
  });
  return { deps, executeCarryOver };
}

describe("buildAutoCarryOverDeps — published source authors", () => {
  it("carries a mixed frozen set only for authors that remain active", async () => {
    const { prisma, findActiveUsers, findTargetSection } =
      publishedSourcePrisma([
        ACTIVE_AUTHOR_ID,
        DEACTIVATED_AUTHOR_ID,
        MISSING_AUTHOR_ID,
      ]);
    const { deps, executeCarryOver } = buildPublishedSourceDeps(prisma);

    await expect(
      carryOverIntoOpenedPeriod(deps, "target-1"),
    ).resolves.toMatchObject({ status: "completed", authorCount: 1 });
    expect(findActiveUsers).toHaveBeenCalledExactlyOnceWith({
      where: {
        id: {
          in: [ACTIVE_AUTHOR_ID, DEACTIVATED_AUTHOR_ID, MISSING_AUTHOR_ID],
        },
        isActive: true,
      },
      select: { id: true },
    });
    expect(findTargetSection).toHaveBeenCalledExactlyOnceWith({
      where: {
        reportId_authorId: {
          reportId: "target-1",
          authorId: ACTIVE_AUTHOR_ID,
        },
      },
      select: { id: true },
    });
    expect(executeCarryOver).toHaveBeenCalledExactlyOnceWith(
      PUBLISHED_REPORT_ID,
      "target-1",
    );
    expect(prisma.reportSection.findMany).not.toHaveBeenCalled();
  });

  it("skips missing and deactivated frozen authors without aborting the carry", async () => {
    const { prisma, findActiveUsers, findTargetSection } =
      publishedSourcePrisma([DEACTIVATED_AUTHOR_ID, MISSING_AUTHOR_ID], []);
    const { deps, executeCarryOver } = buildPublishedSourceDeps(prisma);

    await expect(carryOverIntoOpenedPeriod(deps, "target-1")).resolves.toEqual({
      status: "skipped",
      targetReportId: "target-1",
      reason: "no-active-authors",
    });
    expect(findActiveUsers).toHaveBeenCalledTimes(1);
    expect(findTargetSection).not.toHaveBeenCalled();
    expect(executeCarryOver).not.toHaveBeenCalled();
  });
});

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
