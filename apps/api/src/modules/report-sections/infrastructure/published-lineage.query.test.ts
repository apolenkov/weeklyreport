import { PublishedSnapshotIntegrityError } from "@customreport/report-persistence";
import {
  type PublishedReportSnapshot,
  publishedReportSnapshotSchema,
  type ReportSectionReadModel,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { publishedSnapshotFixture } from "../../../test-utils/prisma-test-helper.js";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository.js";
import { queryPublishedLineage } from "./published-lineage.query.js";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository.js";

const candidates = {
  reportId: "10000000-0000-4000-8000-000000000001",
  reportSectionId: "10000000-0000-4000-8000-000000000002",
  itemStableIds: ["own-item", "closed-item", "reopened-item", "draft-item"],
  decisionStableIds: [
    "archived-decision",
    "reopened-decision",
    "draft-decision",
  ],
};

type PublishedItem =
  PublishedReportSnapshot["sections"][number]["items"][number];
type PublishedDecision =
  PublishedReportSnapshot["sections"][number]["decisions"][number];

function emptyPublishedSnapshot(reportId: string) {
  return {
    reportId,
    periodStart: "2026-04-07T00:00:00.000Z",
    periodEnd: "2026-04-13T00:00:00.000Z",
    deadline: null,
    status: "published",
    publishedAt: "2026-04-14T10:00:00.000Z",
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "green",
      totals: { green: 0, yellow: 0, red: 0 },
    },
    sections: [],
  };
}

function publishedItem(stableId: string, id: string): PublishedItem {
  return {
    id,
    stableId,
    projectId: "30000000-0000-4000-8000-000000000001",
    activityId: null,
    type: "current",
    text: "Published item",
    tag: "feature",
    workflowStatus: "done",
    carriedOver: false,
    priorityRank: null,
    pausedReason: null,
    nextStepText: null,
    stageNames: ["Development"],
  };
}

function publishedDecision(stableId: string, id: string): PublishedDecision {
  return {
    id,
    stableId,
    text: "Published decision",
    owner: "Test Owner",
    deadline: null,
    impact: "Published impact",
    resolvedAt: null,
    stageNames: ["Development"],
    productId: "30000000-0000-4000-8000-000000000001",
    activityId: null,
  };
}

function createPrisma() {
  const documentFindMany = vi.fn().mockResolvedValue([
    { recordType: "item", stableId: "own-item" },
    { recordType: "item", stableId: "closed-item" },
    { recordType: "item", stableId: "reopened-item" },
    { recordType: "decision", stableId: "archived-decision" },
    { recordType: "decision", stableId: "reopened-decision" },
  ]);
  const reportFindMany = vi.fn().mockResolvedValue([]);
  return {
    prisma: {
      publishedSearchDocument: { findMany: documentFindMany },
      report: { findMany: reportFindMany },
    } as unknown as PrismaService,
    documentFindMany,
    reportFindMany,
  };
}

describe("queryPublishedLineage", () => {
  it("excludes an archived draft while retaining every published lifecycle", async () => {
    const lifecycleRows = [
      {
        label: "published",
        id: "20000000-0000-4000-8000-000000000001",
        status: "published",
        periodStatus: "published",
        archived: false,
        publishedSnapshot: emptyPublishedSnapshot(
          "20000000-0000-4000-8000-000000000001",
        ),
      },
      {
        label: "reopened",
        id: "20000000-0000-4000-8000-000000000002",
        status: "published",
        periodStatus: "reopened",
        archived: false,
        publishedSnapshot: emptyPublishedSnapshot(
          "20000000-0000-4000-8000-000000000002",
        ),
      },
      {
        label: "archived-published",
        id: "20000000-0000-4000-8000-000000000003",
        status: "published",
        periodStatus: "published",
        archived: true,
        publishedSnapshot: emptyPublishedSnapshot(
          "20000000-0000-4000-8000-000000000003",
        ),
      },
      {
        label: "archived-draft",
        id: "20000000-0000-4000-8000-000000000004",
        status: "draft",
        periodStatus: "open",
        archived: true,
        publishedSnapshot: null,
      },
    ] as const;
    const selectedLabels: string[] = [];
    const reportFindMany = vi.fn((query: { where: { status: string } }) => {
      const selected = lifecycleRows.filter(
        (report) => report.status === query.where.status,
      );
      selectedLabels.push(...selected.map((report) => report.label));
      return Promise.resolve(
        selected.map(({ id, publishedSnapshot }) => ({
          id,
          publishedSnapshot,
        })),
      );
    });
    const prisma = {
      publishedSearchDocument: { findMany: vi.fn().mockResolvedValue([]) },
      report: { findMany: reportFindMany },
    } as unknown as PrismaService;

    await expect(queryPublishedLineage(prisma, candidates)).resolves.toEqual({
      itemStableIds: [],
      decisionStableIds: [],
    });

    expect(reportFindMany).toHaveBeenCalledWith({
      where: { status: "published" },
      select: { id: true, publishedSnapshot: true },
    });
    expect(selectedLabels).toEqual([
      "published",
      "reopened",
      "archived-published",
    ]);
  });

  it("rejects a missing snapshot on a genuine publication", async () => {
    const fixture = createPrisma();
    fixture.reportFindMany.mockResolvedValue([
      {
        id: candidates.reportId,
        status: "published",
        periodStatus: "published",
        archived: true,
        publishedAt: new Date("2026-04-14T10:00:00.000Z"),
        publishedSnapshot: null,
      },
    ]);

    await expect(
      queryPublishedLineage(fixture.prisma, candidates),
    ).rejects.toBeInstanceOf(PublishedSnapshotIntegrityError);
  });

  it("short-circuits without database reads when candidates are empty", async () => {
    const fixture = createPrisma();

    await expect(
      queryPublishedLineage(fixture.prisma, {
        ...candidates,
        itemStableIds: [],
        decisionStableIds: [],
      }),
    ).resolves.toEqual({ itemStableIds: [], decisionStableIds: [] });
    expect(fixture.documentFindMany).not.toHaveBeenCalled();
  });

  it("uses the current snapshot and indexed frozen rows for lineage", async () => {
    const fixture = createPrisma();

    await expect(
      queryPublishedLineage(fixture.prisma, candidates),
    ).resolves.toEqual({
      itemStableIds: ["own-item", "closed-item", "reopened-item"],
      decisionStableIds: ["archived-decision", "reopened-decision"],
    });
    expect(fixture.documentFindMany).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            recordType: "item",
            stableId: { in: candidates.itemStableIds },
          },
          {
            recordType: "decision",
            stableId: { in: candidates.decisionStableIds },
          },
        ],
      },
      select: { recordType: true, stableId: true },
    });
  });

  it("does not query mutable item, decision, or section models", async () => {
    const documentFindMany = vi
      .fn()
      .mockResolvedValue([{ recordType: "item", stableId: "closed-item" }]);
    const mutableRead = vi.fn(() => {
      throw new Error("Mutable published lineage read");
    });
    const prisma = {
      publishedSearchDocument: { findMany: documentFindMany },
      item: { findMany: mutableRead },
      decision: { findMany: mutableRead },
      reportSection: { findMany: mutableRead },
      report: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    await expect(queryPublishedLineage(prisma, candidates)).resolves.toEqual({
      itemStableIds: ["closed-item"],
      decisionStableIds: [],
    });
    expect(mutableRead).not.toHaveBeenCalled();
  });

  it("includes the current report snapshot when the report was reopened", async () => {
    const fixture = createPrisma();
    fixture.reportFindMany.mockResolvedValue([
      {
        id: candidates.reportId,
        publishedSnapshot: {
          reportId: candidates.reportId,
          periodStart: "2026-04-07T00:00:00.000Z",
          periodEnd: "2026-04-13T00:00:00.000Z",
          deadline: null,
          status: "published",
          publishedAt: "2026-04-14T10:00:00.000Z",
          publishedById: null,
          publishedByName: null,
          portfolioOverview: {
            status: "green",
            totals: { green: 0, yellow: 0, red: 0 },
          },
          sections: [
            {
              reportId: candidates.reportId,
              reportSectionId: candidates.reportSectionId,
              authorId: "00000000-0000-4000-8000-000000000001",
              authorName: "Test Lead",
              authorRole: "lead",
              groupId: "00000000-0000-4000-8000-000000000002",
              groupName: "Engineering",
              status: "submitted",
              submittedAt: null,
              version: 1,
              late: false,
              projectStatuses: [],
              stageStatuses: [],
              activityStatuses: [],
              projects: [],
              referencedProjects: [],
              activities: [],
              reviews: [],
              items: [
                {
                  id: "00000000-0000-4000-8000-000000000003",
                  stableId: "10000000-0000-4000-8000-000000000005",
                  projectId: "00000000-0000-4000-8000-000000000004",
                  activityId: null,
                  type: "current",
                  text: "Published item",
                  tag: "feature",
                  workflowStatus: "done",
                  carriedOver: false,
                  priorityRank: null,
                  pausedReason: null,
                  createdAt: "2026-04-07T00:00:00.000Z",
                  updatedAt: "2026-04-07T00:00:00.000Z",
                  stageNames: ["Development"],
                },
              ],
              risks: [],
              decisions: [],
            },
          ],
        },
      },
    ]);

    await expect(
      queryPublishedLineage(fixture.prisma, {
        ...candidates,
        itemStableIds: ["10000000-0000-4000-8000-000000000005"],
        decisionStableIds: [],
      }),
    ).resolves.toEqual({
      itemStableIds: ["10000000-0000-4000-8000-000000000005"],
      decisionStableIds: [],
    });
  });

  it("recovers sibling item and decision lineage when projection rows are missing", async () => {
    const fixture = createPrisma();
    const currentItemStableId = "10000000-0000-4000-8000-000000000010";
    const siblingItemStableId = "10000000-0000-4000-8000-000000000011";
    const currentDecisionStableId = "10000000-0000-4000-8000-000000000020";
    const siblingDecisionStableId = "10000000-0000-4000-8000-000000000021";
    const snapshot = publishedReportSnapshotSchema.parse(
      publishedSnapshotFixture({
        reportId: candidates.reportId,
        periodStart: "2026-04-07",
        periodEnd: "2026-04-13",
        publishedAt: "2026-04-14T10:00:00.000Z",
        sectionOwners: [
          {
            reportSectionId: candidates.reportSectionId,
            authorId: "40000000-0000-4000-8000-000000000001",
            authorName: "Test Lead",
            groupId: "50000000-0000-4000-8000-000000000001",
            groupName: "Engineering",
          },
          {
            reportSectionId: "10000000-0000-4000-8000-000000000003",
            authorId: "40000000-0000-4000-8000-000000000002",
            authorName: "Other Lead",
            groupId: "50000000-0000-4000-8000-000000000002",
            groupName: "Product",
          },
        ],
      }),
    );
    fixture.documentFindMany.mockResolvedValue([]);
    fixture.reportFindMany.mockResolvedValue([
      {
        id: candidates.reportId,
        publishedSnapshot: {
          ...snapshot,
          sections: snapshot.sections.map((section, index) => ({
            ...section,
            items: [
              publishedItem(
                index === 0 ? currentItemStableId : siblingItemStableId,
                `60000000-0000-4000-8000-00000000001${index}`,
              ),
            ],
            decisions: [
              publishedDecision(
                index === 0 ? currentDecisionStableId : siblingDecisionStableId,
                `60000000-0000-4000-8000-00000000002${index}`,
              ),
            ],
          })),
        },
      },
    ]);

    await expect(
      queryPublishedLineage(fixture.prisma, {
        ...candidates,
        itemStableIds: [currentItemStableId, siblingItemStableId],
        decisionStableIds: [currentDecisionStableId, siblingDecisionStableId],
      }),
    ).resolves.toEqual({
      itemStableIds: [currentItemStableId, siblingItemStableId],
      decisionStableIds: [currentDecisionStableId, siblingDecisionStableId],
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
      itemStableIds: ["own-item", "closed-item", "reopened-item"],
      decisionStableIds: ["archived-decision", "reopened-decision"],
    });
  });
});
