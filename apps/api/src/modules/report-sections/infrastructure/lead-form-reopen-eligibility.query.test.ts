import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { getSectionForPeriod } from "./lead-form-reopen-eligibility.query.js";

const REPORT_ID = "a0000000-0000-4000-8000-000000000001";
const AUTHOR_ID = "a0000000-0000-4000-8000-000000000002";

function sectionRow(
  report: { periodStatus: string; archived: boolean },
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "a0000000-0000-4000-8000-000000000010",
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    version: 1,
    status: "draft",
    submittedAt: null,
    late: false,
    author: {
      id: AUTHOR_ID,
      name: "Lead A",
      role: "lead",
      reportingGroupId: "group-a",
      stageAssignments: [],
    },
    projectStatuses: [],
    stageStatuses: [],
    activityStatuses: [],
    items: [],
    risks: [],
    decisions: [],
    sectionReviews: [],
    itemOutcomeEvents: [],
    report,
    reopenRequests: [],
    ...overrides,
  };
}

function readerFor(row: unknown): Prisma.TransactionClient {
  return {
    reportSection: { findUnique: vi.fn().mockResolvedValue(row) },
  } as unknown as Prisma.TransactionClient;
}

describe("getSectionForPeriod readOnly", () => {
  it("returns readOnly=true for an archived report whose periodStatus stayed open", async () => {
    const result = await getSectionForPeriod(
      readerFor(sectionRow({ periodStatus: "open", archived: true })),
      REPORT_ID,
      AUTHOR_ID,
    );

    expect(result?.readOnly).toBe(true);
  });

  it("returns readOnly=false for a live open period", async () => {
    const result = await getSectionForPeriod(
      readerFor(sectionRow({ periodStatus: "open", archived: false })),
      REPORT_ID,
      AUTHOR_ID,
    );

    expect(result?.readOnly).toBe(false);
  });
});
