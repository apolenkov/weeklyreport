import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import type { SelectableReportSource } from "../domain/period-source-selection.js";
import { ReportSearchPrismaRepository } from "./report-search.prisma-repository.js";

const REPORT_ID = "659b2767-0f86-41e2-b025-49730ca010e4";
const SECTION_ID = "2a223d8b-c4b2-473c-8a7b-15ecc52195c7";
const AUTHOR_ID = "6f99661a-cac6-4d06-bf08-2a14cced554d";
const ACTOR_ID = "4ff69d14-ec8c-4f1c-b62b-73bee530fc7d";
const SHARED_PRODUCT_ID = "eeb16c80-2f85-48a0-b838-d8096981ddba";

function createRepository() {
  const findMany = vi.fn();
  const findUnique = vi.fn();
  const findSection = vi.fn();
  const findAssignments = vi.fn();
  const prisma = {
    report: { findMany, findUnique },
    reportSection: { findUnique: findSection },
    stageAssignment: { findMany: findAssignments },
  } as unknown as PrismaService;
  return {
    repository: new ReportSearchPrismaRepository(prisma),
    findMany,
    findUnique,
    findSection,
    findAssignments,
  };
}

function snapshotSection() {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Alice Lead",
    version: 1,
    status: "submitted" as const,
    submittedAt: null,
    projects: [],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
  };
}

function snapshot() {
  return {
    reportId: REPORT_ID,
    periodStart: "2026-08-01",
    periodEnd: "2026-08-07",
    deadline: "2026-08-07",
    status: "published" as const,
    publishedAt: "2026-08-07T12:00:00.000Z",
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "green" as const,
      totals: { green: 0, yellow: 0, red: 0 },
    },
    sections: [snapshotSection()],
  };
}

const source = (overrides: Partial<SelectableReportSource> = {}) => ({
  reportId: REPORT_ID,
  periodId: REPORT_ID,
  periodLabel: "W32",
  periodStart: new Date("2026-08-01T00:00:00.000Z"),
  periodStatus: "published" as const,
  source: "snapshot" as const,
  ...overrides,
});

describe("ReportSearchPrismaRepository", () => {
  it("lists only editable live reports and published reports with snapshots", async () => {
    const { repository, findMany } = createRepository();
    findMany.mockResolvedValue([
      {
        id: REPORT_ID,
        periodStart: new Date("2026-08-01"),
        periodStatus: "open",
        weekLabel: "W32",
        archived: false,
        publishedSnapshot: null,
      },
      {
        id: "2a223d8b-c4b2-473c-8a7b-15ecc52195c7",
        periodStart: new Date("2026-07-25"),
        periodStatus: "published",
        weekLabel: null,
        archived: true,
        publishedSnapshot: snapshot(),
      },
      {
        id: "4ff69d14-ec8c-4f1c-b62b-73bee530fc7d",
        periodStart: new Date("2026-07-18"),
        periodStatus: "published",
        weekLabel: "W30",
        archived: false,
        publishedSnapshot: null,
      },
      {
        id: "eeb16c80-2f85-48a0-b838-d8096981ddba",
        periodStart: new Date("2026-07-11"),
        periodStatus: "reopened",
        weekLabel: "W29",
        archived: false,
        publishedSnapshot: snapshot(),
      },
    ]);

    await expect(repository.listSources()).resolves.toEqual([
      expect.objectContaining({ reportId: REPORT_ID, source: "live" }),
      expect.objectContaining({
        reportId: "2a223d8b-c4b2-473c-8a7b-15ecc52195c7",
        source: "snapshot",
        periodLabel: "2026-07-25",
      }),
      expect.objectContaining({
        reportId: "eeb16c80-2f85-48a0-b838-d8096981ddba",
        source: "live",
      }),
    ]);
  });

  it("loads live sections with the canonical report-section include", async () => {
    const { repository, findUnique } = createRepository();
    findUnique.mockResolvedValue({ sections: [] });
    const live = source({
      source: "live",
      periodStatus: "open",
    });

    await expect(repository.loadOccurrences([live])).resolves.toEqual([
      {
        reportId: live.reportId,
        periodId: live.periodId,
        periodLabel: live.periodLabel,
        periodStart: live.periodStart,
        source: "live",
        sections: [],
      },
    ]);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: REPORT_ID,
          periodStatus: "open",
          archived: false,
        },
      }),
    );
  });

  it("parses the immutable snapshot and never reads its live sections", async () => {
    const { repository, findUnique } = createRepository();
    findUnique.mockResolvedValue({
      id: REPORT_ID,
      publishedSnapshot: snapshot(),
    });

    await expect(repository.loadOccurrences([source()])).resolves.toEqual([
      expect.objectContaining({
        reportId: REPORT_ID,
        source: "snapshot",
        sections: [expect.objectContaining({ reportSectionId: SECTION_ID })],
      }),
    ]);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: REPORT_ID, periodStatus: "published" },
      select: { id: true, publishedSnapshot: true },
    });
  });

  it("proves an actor's own section with the report-author compound key", async () => {
    const { repository, findSection } = createRepository();
    findSection.mockResolvedValue({ id: SECTION_ID });

    await expect(repository.hasOwnSection(REPORT_ID, ACTOR_ID)).resolves.toBe(
      true,
    );
    expect(findSection).toHaveBeenCalledWith({
      where: { reportId_authorId: { reportId: REPORT_ID, authorId: ACTOR_ID } },
      select: { id: true },
    });
  });

  it("scopes foreign access to current non-archived shared products", async () => {
    const { repository, findAssignments } = createRepository();
    findAssignments.mockResolvedValue([
      { projectId: SHARED_PRODUCT_ID },
      { projectId: SHARED_PRODUCT_ID },
    ]);

    await expect(
      repository.getSharedNonArchivedProductIds(ACTOR_ID, AUTHOR_ID),
    ).resolves.toEqual([SHARED_PRODUCT_ID]);
    expect(findAssignments).toHaveBeenCalledWith({
      where: {
        userId: AUTHOR_ID,
        project: {
          archived: false,
          stageAssignments: { some: { userId: ACTOR_ID } },
        },
      },
      select: { projectId: true },
    });
  });
});
