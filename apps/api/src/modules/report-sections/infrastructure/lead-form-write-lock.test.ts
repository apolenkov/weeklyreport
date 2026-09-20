import { currentPeriodLifecycleSchema } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { ReportSectionDomainError } from "../application/report-sections.service.js";
import { LeadFormConstraintError } from "../domain/lead-form-shared.js";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository.js";

const REOPENED_REPORT = {
  id: "44444444-4444-4444-8444-444444444444",
  periodState: "open",
  status: "published",
  periodStatus: "reopened",
  archived: false,
  autoPublished: false,
  autoArchived: false,
  publishedAt: new Date("2026-09-04T18:00:00.000Z"),
  publishedById: "77777777-7777-4777-8777-777777777777",
  reopenedAt: new Date("2026-09-04T19:00:00.000Z"),
};

function emptySource() {
  return { items: [], risks: [], decisions: [] };
}

describe("LeadFormPrismaRepository.fillFromSection write lock", () => {
  it("rejects replacement of a cancelled target before deleting child rows", async () => {
    const deleteMany = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "44444444-4444-4444-8444-444444444444",
          periodState: "open",
          status: "draft",
          periodStatus: "open",
          archived: false,
          autoPublished: false,
          autoArchived: false,
          publishedAt: null,
          publishedById: null,
          reopenedAt: null,
        },
      ]),
      reportSection: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      item: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({ id: "cancelled" }),
        deleteMany,
      },
      decision: { findMany: vi.fn().mockResolvedValue([]) },
      activityStatus: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const prisma = {
      reportSection: {
        findUnique: vi.fn().mockResolvedValue(emptySource()),
      },
      $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const repo = new LeadFormPrismaRepository(prisma as never);
    await expect(repo.fillFromSection("target", "source", 1)).rejects.toThrow(
      "Restore cancelled plans",
    );
    expect(tx.item.findFirst).toHaveBeenCalledOnce();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("rejects a published target before the version CAS", async () => {
    const publishedReport = {
      ...REOPENED_REPORT,
      periodState: "published",
      periodStatus: "published",
      reopenedAt: null,
    };
    expect(
      currentPeriodLifecycleSchema.safeParse(publishedReport).success,
    ).toBe(true);
    const updateMany = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([publishedReport]),
      reportSection: { updateMany },
    };
    const prisma = {
      reportSection: {
        findUnique: vi.fn().mockResolvedValue(emptySource()),
      },
      $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const repo = new LeadFormPrismaRepository(prisma as never);

    await expect(
      repo.fillFromSection(
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
        1,
      ),
    ).rejects.toBeInstanceOf(LeadFormConstraintError);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["item", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    ["decision", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
  ] as const)(
    "rejects a reopened fill when the locked transaction sees newly published %s lineage",
    async (recordType, stableId) => {
      const updateMany = vi.fn();
      const deleteMany = vi.fn();
      const lock = vi.fn().mockResolvedValue([REOPENED_REPORT]);
      const itemFindMany = vi
        .fn()
        .mockResolvedValue(recordType === "item" ? [{ stableId }] : []);
      const decisionFindMany = vi
        .fn()
        .mockResolvedValue(recordType === "decision" ? [{ stableId }] : []);
      const documentFindMany = vi
        .fn()
        .mockResolvedValue([{ recordType, stableId }]);
      const tx = {
        $queryRaw: lock,
        report: { findMany: vi.fn().mockResolvedValue([]) },
        publishedSearchDocument: { findMany: documentFindMany },
        reportSection: { updateMany },
        item: {
          findMany: itemFindMany,
          findFirst: vi.fn(),
          deleteMany,
        },
        decision: {
          findMany: decisionFindMany,
          deleteMany,
        },
        risk: { deleteMany },
        activityStatus: { findMany: vi.fn().mockResolvedValue([]) },
      };
      const prisma = {
        reportSection: { findUnique: vi.fn().mockResolvedValue(emptySource()) },
        $transaction: vi.fn(
          (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
        ),
      };
      const repo = new LeadFormPrismaRepository(prisma as never);

      const fill = repo.fillFromSection("target", "source", 1);
      await expect(fill).rejects.toBeInstanceOf(ReportSectionDomainError);
      await expect(fill).rejects.toMatchObject({
        code: "PUBLISHED_RECORD_LOCKED",
      });
      expect(lock).toHaveBeenCalledOnce();
      expect(documentFindMany).toHaveBeenCalledOnce();
      expect(lock.mock.invocationCallOrder[0]).toBeLessThan(
        (recordType === "item" ? itemFindMany : decisionFindMany).mock
          .invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
      );
      expect(updateMany).not.toHaveBeenCalled();
      expect(deleteMany).not.toHaveBeenCalled();
    },
  );

  it("allows a reopened fill to delete target rows with no published lineage", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const itemDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const decisionDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const riskDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const activityStatusFindMany = vi.fn().mockResolvedValue([]);
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([REOPENED_REPORT]),
      report: { findMany: vi.fn().mockResolvedValue([]) },
      publishedSearchDocument: { findMany: vi.fn().mockResolvedValue([]) },
      reportSection: { updateMany },
      item: {
        findMany: vi.fn().mockResolvedValue([{ stableId: "draft-item" }]),
        findFirst: vi.fn().mockResolvedValue(null),
        deleteMany: itemDeleteMany,
      },
      decision: {
        findMany: vi.fn().mockResolvedValue([{ stableId: "draft-decision" }]),
        deleteMany: decisionDeleteMany,
      },
      risk: { deleteMany: riskDeleteMany },
      activityStatus: { findMany: activityStatusFindMany },
    };
    const prisma = {
      reportSection: { findUnique: vi.fn().mockResolvedValue(emptySource()) },
      $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const repo = new LeadFormPrismaRepository(prisma as never);

    await expect(repo.fillFromSection("target", "source", 1)).resolves.toBe(0);
    expect(updateMany).toHaveBeenCalledOnce();
    expect(itemDeleteMany).toHaveBeenCalledOnce();
    expect(decisionDeleteMany).toHaveBeenCalledOnce();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      activityStatusFindMany.mock.invocationCallOrder[0] ??
        Number.POSITIVE_INFINITY,
    );
  });
});
