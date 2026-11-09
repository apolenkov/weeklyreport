import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import {
  AUTHOR_ID,
  baseRow,
  fullRisk,
  OWNED_PROJECT,
  SECTION_ID,
} from "./__tests__/report-sections-prisma-harness";
import { queryRetainedSource } from "./retained-incomplete-records.query.js";

// The harness rows belong to this report.
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST = {
  actorId: AUTHOR_ID,
  reportId: REPORT_ID,
  reportSectionId: SECTION_ID,
};
const REPORT = {
  periodStart: new Date("2026-10-26T00:00:00.000Z"),
  periodEnd: new Date("2026-11-01T00:00:00.000Z"),
  status: "published",
  periodStatus: "published",
  archived: false,
};
const DRAFT_RISK = {
  ...fullRisk({
    projectId: OWNED_PROJECT,
    project: { name: "Owned Project" },
    stageNames: ["Development"],
  }),
  impact: null,
};

// The double exposes reads only: any write or provisioning call would throw.
function setup(row: object | null, currentReportId: string | null = null) {
  const sectionFindFirst = vi.fn().mockResolvedValue(row);
  const reportFindFirst = vi
    .fn()
    .mockResolvedValue(currentReportId ? { id: currentReportId } : null);
  const prisma = {
    reportSection: { findFirst: sectionFindFirst },
    report: { findFirst: reportFindFirst },
  } as unknown as PrismaService;
  return { prisma, reportFindFirst, sectionFindFirst };
}

describe("queryRetainedSource", () => {
  it("selects the section only for its active, authoring-role author", async () => {
    const { prisma, reportFindFirst, sectionFindFirst } = setup(null);

    await expect(queryRetainedSource(prisma, REQUEST)).resolves.toBeNull();

    expect(sectionFindFirst).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        where: {
          id: SECTION_ID,
          reportId: REPORT_ID,
          authorId: AUTHOR_ID,
          author: {
            isActive: true,
            role: { in: ["lead", "head", "admin"] },
          },
        },
      }),
    );
    // Nothing matched, so no second read can reveal that the source exists.
    expect(reportFindFirst).not.toHaveBeenCalled();
  });

  it("returns the author's own records with the source period and lifecycle", async () => {
    const { prisma } = setup({
      ...baseRow({ risks: [DRAFT_RISK] }),
      report: REPORT,
    });

    await expect(queryRetainedSource(prisma, REQUEST)).resolves.toMatchObject({
      reportId: REPORT_ID,
      reportSectionId: SECTION_ID,
      periodStart: REPORT.periodStart,
      periodEnd: REPORT.periodEnd,
      lifecycle: {
        status: "published",
        periodStatus: "published",
        archived: false,
      },
      onCurrentForm: false,
      risks: [{ stableId: DRAFT_RISK.stableId, impact: null }],
      decisions: [],
    });
  });

  it("keeps the text readable after the author lost the Product stage", async () => {
    const row = baseRow({ risks: [DRAFT_RISK] });
    const { prisma } = setup({
      ...row,
      author: { ...row.author, stageAssignments: [] },
      report: REPORT,
    });

    await expect(queryRetainedSource(prisma, REQUEST)).resolves.toMatchObject({
      risks: [{ stableId: DRAFT_RISK.stableId, risk: "Risk" }],
    });
  });

  it("marks the source the lead form is currently editing", async () => {
    const { prisma, reportFindFirst } = setup(
      { ...baseRow({ risks: [DRAFT_RISK] }), report: REPORT },
      REPORT_ID,
    );

    await expect(queryRetainedSource(prisma, REQUEST)).resolves.toMatchObject({
      onCurrentForm: true,
    });
    expect(reportFindFirst).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        orderBy: [{ periodStart: "desc" }, { id: "desc" }],
      }),
    );
  });
});
