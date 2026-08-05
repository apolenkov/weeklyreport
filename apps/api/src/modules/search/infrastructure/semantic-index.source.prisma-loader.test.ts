import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import type { SemanticIndexLocator } from "../application/semantic-index.source-loader.js";
import { SemanticIndexPrismaSourceLoader } from "./semantic-index.source.prisma-loader.js";

const mocks = vi.hoisted(() => ({
  mapPrismaToReportSection: vi.fn(),
  parsePublishedSnapshot: vi.fn(),
}));

vi.mock("../../report-sections/index.js", () => ({
  mapPrismaToReportSection: mocks.mapPrismaToReportSection,
  reportSectionFullInclude: {},
}));
vi.mock("../../publication/index.js", () => ({
  parsePublishedSnapshot: mocks.parsePublishedSnapshot,
}));

mocks.mapPrismaToReportSection.mockImplementation(
  (value: unknown) => value as ReportSectionReadModel,
);
const parsePublishedSnapshot = mocks.parsePublishedSnapshot;

const section = (): ReportSectionReadModel => ({
  reportSectionId: "section-1",
  reportId: "report-1",
  authorId: "author-1",
  authorName: "Lead One",
  version: 1,
  status: "submitted",
  submittedAt: null,
  projects: [
    {
      projectId: "product-1",
      projectName: "CRM Portal",
      trafficLight: "green",
    },
  ],
  referencedProjects: [],
  items: [
    {
      projectId: "product-1",
      type: "current",
      text: "Ship the release",
      tag: "release",
      workflowStatus: "in_progress",
      carriedOver: false,
      priorityRank: null,
      stageIds: [],
    },
  ],
  risks: [],
  decisions: [],
  activities: [],
});

const locator = (
  source: SemanticIndexLocator["source"],
): SemanticIndexLocator => ({
  source,
  reportId: "report-1",
  sectionId: "section-1",
  occurrenceId: "report-1:section-1:item:current:Ship the release",
  recordKind: "item",
  recordId: "current:Ship the release",
  expectedContentHash: "hash-1",
});

const prismaHarness = () => {
  const findReport = vi.fn();
  const findSection = vi.fn();
  const prisma = {
    report: { findUnique: findReport },
    reportSection: { findUnique: findSection },
  } as unknown as PrismaService;
  return {
    findReport,
    findSection,
    loader: new SemanticIndexPrismaSourceLoader(prisma),
  };
};

describe("SemanticIndexPrismaSourceLoader", () => {
  it("reloads a current editable live section", async () => {
    const harness = prismaHarness();
    const liveSection = section();
    harness.findReport.mockResolvedValue({
      id: "report-1",
      periodStart: new Date("2026-08-03T00:00:00.000Z"),
      periodStatus: "open",
      weekLabel: "Week 31",
      archived: false,
      publishedSnapshot: null,
    });
    harness.findSection.mockResolvedValue(liveSection);

    const result = await harness.loader.load(locator("live"));

    expect(result).toMatchObject({
      kind: "item",
      context: { source: "live", reportId: "report-1", sectionId: "section-1" },
    });
    expect(harness.findSection).toHaveBeenCalledWith({
      where: { id: "section-1" },
      include: {},
    });
  });

  it("reloads the immutable published snapshot without reading live rows", async () => {
    const harness = prismaHarness();
    const snapshotSection = section();
    harness.findReport.mockResolvedValue({
      id: "report-1",
      periodStart: new Date("2026-08-03T00:00:00.000Z"),
      periodStatus: "published",
      weekLabel: "Week 31",
      archived: false,
      publishedSnapshot: { frozen: true },
    });
    parsePublishedSnapshot.mockReturnValue({
      reportId: "report-1",
      sections: [snapshotSection],
    });

    const result = await harness.loader.load(locator("snapshot"));

    expect(result).toMatchObject({
      kind: "item",
      context: {
        source: "snapshot",
        reportId: "report-1",
        sectionId: "section-1",
      },
    });
    expect(harness.findSection).not.toHaveBeenCalled();
  });

  it("does not reload a live source after publication", async () => {
    const harness = prismaHarness();
    harness.findReport.mockResolvedValue({
      id: "report-1",
      periodStart: new Date("2026-08-03T00:00:00.000Z"),
      periodStatus: "published",
      weekLabel: null,
      archived: false,
      publishedSnapshot: null,
    });

    await expect(harness.loader.load(locator("live"))).resolves.toBeNull();
    expect(harness.findSection).not.toHaveBeenCalled();
  });
});
