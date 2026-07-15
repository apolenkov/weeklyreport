import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository.js";
import { queryPublishedLineage } from "./published-lineage.query.js";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository.js";

const candidates = {
  reportId: "report-1",
  reportSectionId: "section-1",
  itemStableIds: ["own-item", "published-item", "reopened-item", "draft-item"],
  decisionStableIds: [
    "archived-decision",
    "reopened-decision",
    "draft-decision",
  ],
};

function createPrisma() {
  const reportFindUnique = vi.fn().mockResolvedValue({
    publishedSnapshot: {
      sections: [
        {
          reportSectionId: candidates.reportSectionId,
          items: [{ stableId: "own-item" }],
          decisions: [],
        },
      ],
    },
  });
  const reportFindMany = vi.fn().mockResolvedValue([
    {
      publishedSnapshot: {
        sections: [
          {
            reportSectionId: "source-section",
            items: [{ stableId: "reopened-item" }],
            decisions: [{ stableId: "reopened-decision" }],
          },
        ],
      },
    },
  ]);
  const itemFindMany = vi
    .fn()
    .mockResolvedValue([{ stableId: "published-item" }]);
  const decisionFindMany = vi
    .fn()
    .mockResolvedValue([{ stableId: "archived-decision" }]);
  return {
    prisma: {
      report: { findUnique: reportFindUnique, findMany: reportFindMany },
      item: { findMany: itemFindMany },
      decision: { findMany: decisionFindMany },
    } as unknown as PrismaService,
    reportFindUnique,
    reportFindMany,
    itemFindMany,
    decisionFindMany,
  };
}

describe("queryPublishedLineage", () => {
  it("short-circuits without database reads when candidates are empty", async () => {
    const fixture = createPrisma();

    await expect(
      queryPublishedLineage(fixture.prisma, {
        ...candidates,
        itemStableIds: [],
        decisionStableIds: [],
      }),
    ).resolves.toEqual({ itemStableIds: [], decisionStableIds: [] });
    expect(fixture.reportFindUnique).not.toHaveBeenCalled();
    expect(fixture.reportFindMany).not.toHaveBeenCalled();
    expect(fixture.itemFindMany).not.toHaveBeenCalled();
    expect(fixture.decisionFindMany).not.toHaveBeenCalled();
  });

  it("reads frozen sources and returns only published candidates", async () => {
    const fixture = createPrisma();

    await expect(
      queryPublishedLineage(fixture.prisma, candidates),
    ).resolves.toEqual({
      itemStableIds: ["own-item", "published-item", "reopened-item"],
      decisionStableIds: ["archived-decision", "reopened-decision"],
    });
    expect(fixture.itemFindMany).toHaveBeenCalledWith({
      where: {
        stableId: { in: candidates.itemStableIds },
        reportSectionId: { not: candidates.reportSectionId },
        reportSection: {
          report: {
            OR: [{ periodStatus: "published" }, { archived: true }],
          },
        },
      },
      select: { stableId: true },
    });
    expect(fixture.reportFindMany).toHaveBeenCalledWith({
      where: {
        id: { not: candidates.reportId },
        periodStatus: "reopened",
      },
      select: { publishedSnapshot: true },
    });
  });

  it("keeps lead-form and report-sections repository results identical", async () => {
    const fixture = createPrisma();
    const section = {
      reportId: candidates.reportId,
      reportSectionId: candidates.reportSectionId,
      items: candidates.itemStableIds.map((stableId) => ({ stableId })),
      decisions: candidates.decisionStableIds.map((stableId) => ({ stableId })),
    } as unknown as ReportSectionReadModel;
    const leadFormRepository = new LeadFormPrismaRepository(fixture.prisma);
    const reportSectionsRepository = new ReportSectionsPrismaRepository(
      fixture.prisma,
    );

    const leadFormLineage =
      await leadFormRepository.getPublishedLineage(section);
    const reportSectionsLineage =
      await reportSectionsRepository.getPublishedLineage(section);

    expect(leadFormLineage).toEqual(reportSectionsLineage);
    expect(reportSectionsLineage).toEqual({
      itemStableIds: ["own-item", "published-item", "reopened-item"],
      decisionStableIds: ["archived-decision", "reopened-decision"],
    });
  });
});
