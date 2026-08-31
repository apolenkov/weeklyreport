import { describe, expect, it, vi } from "vitest";

import {
  getCrossAuthorContentRead,
  getCrossAuthorsRead,
} from "./lead-form-cross-author.reads.js";

const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

describe("lead-form cross-author atomic reads", () => {
  it("denies a lead with no own section before loading foreign data", async () => {
    const reportSectionFindUnique = vi.fn().mockResolvedValue(null);
    const stageAssignmentFindMany = vi.fn().mockResolvedValue([]);
    const { prisma, transactionOptions } = prismaReader({
      reportSectionFindUnique,
      stageAssignmentFindMany,
    });

    const rows = await getCrossAuthorsRead(prisma, REPORT_ID, USER_ID, "lead");

    expect(rows).toEqual([]);
    expect(reportSectionFindUnique).toHaveBeenCalledWith({
      where: { reportId_authorId: { reportId: REPORT_ID, authorId: USER_ID } },
      select: { id: true },
    });
    expect(stageAssignmentFindMany).not.toHaveBeenCalled();
    expect(transactionOptions()).toEqual({ isolationLevel: "RepeatableRead" });
  });

  it("does not grant a head content access without co-ownership", async () => {
    const reportSectionFindUnique = vi
      .fn()
      .mockResolvedValue({ id: "section" });
    const stageAssignmentFindMany = vi.fn().mockResolvedValue([]);
    const { prisma, transactionOptions } = prismaReader({
      reportSectionFindUnique,
      stageAssignmentFindMany,
    });

    const result = await getCrossAuthorContentRead(prisma, REPORT_ID, USER_ID);

    expect(result).toEqual({ coOwnsShared: false, rows: [] });
    expect(reportSectionFindUnique).toHaveBeenCalledWith({
      where: { reportId_authorId: { reportId: REPORT_ID, authorId: USER_ID } },
      select: { id: true },
    });
    expect(stageAssignmentFindMany).toHaveBeenCalledTimes(1);
    expect(transactionOptions()).toEqual({ isolationLevel: "RepeatableRead" });
  });
});

function prismaReader(overrides: {
  reportSectionFindUnique: ReturnType<typeof vi.fn>;
  stageAssignmentFindMany: ReturnType<typeof vi.fn>;
}) {
  const reportFindUnique = vi.fn().mockResolvedValue({
    periodStatus: "open",
    publishedSnapshot: null,
  });
  let transactionOptions: unknown;
  const tx = {
    report: { findUnique: reportFindUnique },
    reportSection: { findUnique: overrides.reportSectionFindUnique },
    stageAssignment: { findMany: overrides.stageAssignmentFindMany },
  };
  const prisma = {
    $transaction: async (
      operation: (client: typeof tx) => Promise<unknown>,
      options: unknown,
    ) => {
      transactionOptions = options;
      return operation(tx);
    },
  } as never;
  return { prisma, transactionOptions: () => transactionOptions };
}
