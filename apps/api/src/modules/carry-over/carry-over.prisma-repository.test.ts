import type { CarryOverExecution } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { publishedSnapshotFixture } from "../../test-utils/prisma-test-helper.js";
import { baseRow } from "../report-sections/test-seams/index.js";
import { CarryOverPrismaRepository } from "./carry-over.prisma-repository";

const sourceReportId = "22222222-2222-4222-8222-222222222222";
const targetReportId = "55555555-5555-4555-8555-555555555555";

const execution: CarryOverExecution = {
  id: "aaaa0000-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  sourceReportId,
  targetReportId,
  dedupeKey: `${sourceReportId}:${targetReportId}`,
  status: "completed",
  startedAt: new Date("2026-05-04T09:30:00.000Z"),
  completedAt: new Date("2026-05-04T09:30:00.000Z"),
  carriedItemCount: 1,
  carriedDecisionCount: 0,
};

// The pg-adapter P2002 shape (meta.target unset, identity in message + meta).
function pgAdapterP2002(originalMessage: string, message: string): unknown {
  return {
    code: "P2002",
    message,
    meta: {
      driverAdapterError: { cause: { originalMessage } },
    },
  };
}

// The P2002 catch must classify the violated constraint: only the dedupeKey
// index is a concurrent-carry race; any other P2002 is a real write failure
// and must re-throw, never resolve to a winner.
describe("CarryOverPrismaRepository.saveCarryOver — P2002 classification", () => {
  it("re-throws a P2002 that is not the dedupeKey race instead of resolving it", async () => {
    const unrelatedP2002 = pgAdapterP2002(
      'duplicate key value violates unique constraint "CarryOverRecord_pkey"',
      "Unique constraint failed on the fields: (`id`)",
    );
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(unrelatedP2002),
      carryOverExecution: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const repo = new CarryOverPrismaRepository(prisma as never);

    await expect(repo.saveCarryOver(execution, [], [])).rejects.toBe(
      unrelatedP2002,
    );
    // A misclassified race would have read back a winner; the original error
    // must surface untouched.
    expect(prisma.carryOverExecution.findUnique).not.toHaveBeenCalled();
  });

  it("still resolves a genuine dedupeKey P2002 to the winner's execution", async () => {
    const dedupeP2002 = pgAdapterP2002(
      'duplicate key value violates unique constraint "CarryOverExecution_dedupeKey_key"',
      "Unique constraint failed on the fields: (`dedupeKey`)",
    );
    const winnerRow = {
      id: "bbbb0000-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      sourceReportId,
      targetReportId,
      dedupeKey: execution.dedupeKey,
      status: "completed",
      createdAt: new Date("2026-05-04T09:30:00.000Z"),
      updatedAt: new Date("2026-05-04T09:30:00.000Z"),
      records: [],
    };
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(dedupeP2002),
      carryOverExecution: {
        findUnique: vi.fn().mockResolvedValue(winnerRow),
      },
      reportSection: {
        findMany: vi.fn().mockResolvedValue([
          baseRow({
            id: "cccc0000-cccc-4ccc-8ccc-cccccccccccc",
            reportId: targetReportId,
          }),
        ]),
      },
    };
    const repo = new CarryOverPrismaRepository(prisma as never);

    // The loser resolves to the winner's recorded execution: the dedupeKey
    // classification matches, so resolution reads back the winner by key.
    await expect(repo.saveCarryOver(execution, [], [])).resolves.toMatchObject({
      execution: {
        id: winnerRow.id,
        dedupeKey: execution.dedupeKey,
        carriedItemCount: 0,
        carriedDecisionCount: 0,
      },
      records: [],
      targetSection: {
        reportSectionId: "cccc0000-cccc-4ccc-8ccc-cccccccccccc",
        reportId: targetReportId,
      },
    });
    expect(prisma.carryOverExecution.findUnique).toHaveBeenCalledWith({
      where: { dedupeKey: execution.dedupeKey },
      include: { records: true },
    });
  });
});

describe("CarryOverPrismaRepository.getSourceSections", () => {
  it("uses the published snapshot after live source rows are removed", async () => {
    const liveFindMany = vi
      .fn()
      .mockRejectedValue(
        new Error("published source must not read live sections"),
      );
    const prisma = {
      report: {
        findUnique: vi.fn().mockResolvedValue({
          periodStatus: "published",
          publishedSnapshot: publishedSnapshotFixture({
            reportId: sourceReportId,
            periodStart: "2026-04-27",
            periodEnd: "2026-05-01",
            publishedAt: "2026-05-04T09:30:00.000Z",
            sectionOwners: [
              {
                reportSectionId: "33333333-3333-4333-8333-333333333333",
                authorId: "44444444-4444-4444-8444-444444444444",
                authorName: "Published Lead",
                groupId: "66666666-6666-4666-8666-666666666666",
                groupName: "Published Group",
              },
            ],
          }),
        }),
      },
      reportSection: { findMany: liveFindMany },
    };
    const repo = new CarryOverPrismaRepository(prisma as never);

    const sections = await repo.getSourceSections(sourceReportId);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.authorName).toBe("Published Lead");
    expect(liveFindMany).not.toHaveBeenCalled();
  });
});
