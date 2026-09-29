import type { Prisma } from "@prisma/client";

import type { PeriodLifecycleExpectation } from "../domain/period-lifecycle-expectation.js";

// Bind a lifecycle write to the exact state and reporting envelope authorized
// by the caller. Any intervening lifecycle or boundary change drops the CAS.
export function reportLifecycleCasWhere(
  reportId: string,
  expected: PeriodLifecycleExpectation,
): Prisma.ReportWhereInput {
  return {
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
  };
}
