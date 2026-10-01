import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { AdminPeriodOverlapError } from "../../admin/index.js";
import { WeeklyReportPrismaRepository } from "../../weekly-report/weekly-report.prisma-repository.js";
import type { PeriodLifecycleExpectation } from "../domain/period-lifecycle-expectation.js";
import { PeriodPrismaRepository } from "./period.prisma-repository.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("PeriodPrismaRepository.publishPeriod", () => {
  it("uses one timestamp and publisher for the CAS and provisional snapshot", async () => {
    const reportId = "f0000000-0000-4000-a000-0000000000d1";
    const userId = "00000000-0000-4000-8000-0000000000d9";
    const publishAt = new Date("2026-08-31T12:34:56.789Z");
    const publisher = { id: userId, name: "Snapshot Head" };
    const candidate = {
      id: reportId,
      periodStart: new Date("2026-08-24T00:00:00.000Z"),
      periodEnd: new Date("2026-08-30T00:00:00.000Z"),
      deadline: new Date("2026-08-28T00:00:00.000Z"),
      status: "draft",
      publishedAt: null,
      publishedById: null,
      publishedBy: null,
      sections: [],
      periodState: "open",
      periodStatus: "open",
      archived: false,
      autoPublished: false,
      autoArchived: false,
      reopenedAt: null,
    };
    const expected = {
      periodStart: candidate.periodStart,
      periodEnd: candidate.periodEnd,
      status: "draft",
      periodState: "open",
      periodStatus: "open",
      archived: false,
      autoPublished: false,
      autoArchived: false,
      publishedAt: candidate.publishedAt,
      publishedById: candidate.publishedById,
      reopenedAt: candidate.reopenedAt,
    } satisfies PeriodLifecycleExpectation;
    const published = {
      ...candidate,
      status: "published",
      publishedAt: publishAt,
      publishedById: userId,
      publishedBy: publisher,
    };
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      report: {
        findUnique: vi.fn().mockResolvedValue(candidate),
        findUniqueOrThrow: vi.fn().mockResolvedValue(published),
        updateMany,
        update: vi.fn().mockResolvedValue(published),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(publisher),
      },
      reminderRule: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      reportSection: {
        count: vi.fn().mockResolvedValue(1),
      },
      publishedSearchDocument: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      publishedSectionScope: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        async (operation: (client: typeof tx) => Promise<unknown>) =>
          operation(tx),
      ),
    } as unknown as PrismaService;
    const repository = new PeriodPrismaRepository(
      prisma,
      new WeeklyReportPrismaRepository(prisma),
    );
    vi.useFakeTimers();
    vi.setSystemTime(publishAt);

    await expect(
      repository.publishPeriod(reportId, userId, expected),
    ).resolves.toEqual({ transitioned: true });

    const casWrite = updateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: {
        status: string;
        publishedAt: Date;
        publishedById: string;
        publishedSnapshot: {
          status: string;
          publishedAt: string;
          publishedById: string;
          publishedByName: string;
        };
      };
    };
    expect(casWrite.where).toEqual({
      id: reportId,
      periodStart: expected.periodStart,
      periodEnd: expected.periodEnd,
      status: expected.status,
      periodState: expected.periodState,
      periodStatus: expected.periodStatus,
      archived: expected.archived,
      autoPublished: expected.autoPublished,
      autoArchived: expected.autoArchived,
      publishedAt: expected.publishedAt,
      publishedById: expected.publishedById,
      reopenedAt: expected.reopenedAt,
    });
    expect(casWrite.data).toMatchObject({
      status: "published",
      publishedAt: publishAt,
      publishedById: userId,
      publishedSnapshot: {
        status: "published",
        publishedAt: publishAt.toISOString(),
        publishedById: userId,
        publishedByName: "Snapshot Head",
      },
    });
    expect(tx.publishedSearchDocument.deleteMany).toHaveBeenCalledWith({
      where: { reportId },
    });
    expect(tx.publishedSectionScope.deleteMany).toHaveBeenCalledWith({
      where: { reportId },
    });
    expect(tx.reminderRule.updateMany).toHaveBeenCalledWith({
      where: { reportId, status: "active" },
      data: { status: "paused" },
    });
  });
});

// Reopen moves a Report into periodState='open'. If another live period
// overlaps, the exclusion constraint rejects the transaction; the repository
// translates it to AdminPeriodOverlapError (→ BAD_REQUEST).
describe("PeriodPrismaRepository.reopenPeriod — overlap translation", () => {
  const publishedExpectation = (): PeriodLifecycleExpectation => ({
    periodStart: new Date("2026-08-24T00:00:00.000Z"),
    periodEnd: new Date("2026-08-30T00:00:00.000Z"),
    status: "published",
    periodState: "published",
    periodStatus: "published",
    archived: false,
    autoPublished: false,
    autoArchived: false,
    publishedAt: new Date("2026-08-31T12:34:56.789Z"),
    publishedById: "00000000-0000-4000-8000-0000000000d9",
    reopenedAt: null,
  });

  function periodOverlapP2039(): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError(
      'Database error. Code: `23P01`. Message: `conflicting key value violates exclusion constraint "Report_no_live_period_overlap"`',
      {
        code: "P2039",
        clientVersion: "test",
        meta: {
          driverAdapterError: {
            cause: {
              kind: "postgres",
              originalCode: "23P01",
              originalMessage:
                'conflicting key value violates exclusion constraint "Report_no_live_period_overlap"',
            },
          },
        },
      },
    );
  }

  it("translates the range exclusion into AdminPeriodOverlapError", async () => {
    const prisma = {
      $transaction: vi.fn(() => Promise.reject(periodOverlapP2039())),
    } as unknown as PrismaService;
    const repo = new PeriodPrismaRepository(
      prisma,
      new WeeklyReportPrismaRepository(prisma),
    );

    await expect(
      repo.reopenPeriod("report-1", publishedExpectation()),
    ).rejects.toBeInstanceOf(AdminPeriodOverlapError);
  });

  it("reconciles the current policy schedule in the reopen transaction", async () => {
    const reportId = "f0000000-0000-4000-a000-0000000000d1";
    const deadline = new Date("2026-09-02T18:00:00.000Z");
    const policy = {
      id: "policy-1",
      kind: "deadline",
      offsetMinutes: -180,
      timezone: "Europe/Moscow",
      audience: "LEAD_WITH_DRAFT",
      active: true,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const reminderRule = {
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "rule-v1" }),
    };
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([policy])
        .mockResolvedValueOnce([
          {
            id: reportId,
            deadline,
            periodState: "open",
            status: "published",
            periodStatus: "reopened",
            archived: false,
          },
        ]),
      report: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn(),
      },
      reportSection: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      reopenRequest: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      reminderRule,
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const repo = new PeriodPrismaRepository(
      prisma,
      new WeeklyReportPrismaRepository(prisma),
    );
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00.000Z"));

    await expect(
      repo.reopenPeriod(reportId, publishedExpectation()),
    ).resolves.toBeUndefined();

    expect(tx.reopenRequest.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { status: "pending", reportSection: { reportId } },
      data: { status: "rejected" },
    });
    const createArgs = reminderRule.create.mock.calls[0]?.[0] as unknown as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).toMatchObject({
      reportId,
      policyId: policy.id,
      deadline,
      status: "active",
    });
  });

  it("re-throws an unrelated error unchanged", async () => {
    const prisma = {
      $transaction: vi.fn(() => Promise.reject(new Error("deadlock detected"))),
    } as unknown as PrismaService;
    const repo = new PeriodPrismaRepository(
      prisma,
      new WeeklyReportPrismaRepository(prisma),
    );

    await expect(
      repo.reopenPeriod("report-1", publishedExpectation()),
    ).rejects.toThrow("deadlock detected");
  });
});
