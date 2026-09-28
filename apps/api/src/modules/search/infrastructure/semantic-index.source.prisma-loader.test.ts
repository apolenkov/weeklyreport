import type { ReportSectionReadModel } from "@customreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const parsePublishedSnapshot = mocks.parsePublishedSnapshot;

const section = (): ReportSectionReadModel => ({
  reportSectionId: "section-1",
  reportId: "report-1",
  authorId: "author-1",
  authorName: "Lead One",
  authorRole: "lead",
  version: 1,
  status: "submitted",
  submittedAt: null,
  late: false,
  projects: [
    {
      projectId: "product-1",
      projectName: "CRM Portal",
      trafficLight: "green",
      ownedStages: [],
      stageSet: [],
      ownerGroupId: null,
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
      stageNames: [],
    },
  ],
  risks: [],
  decisions: [],
  activities: [],
  reviews: [],
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
  beforeEach(() => {
    mocks.mapPrismaToReportSection
      .mockReset()
      .mockImplementation((value: unknown) => value as ReportSectionReadModel);
    parsePublishedSnapshot.mockReset();
  });

  it("reloads a current editable live section", async () => {
    const harness = prismaHarness();
    const liveSection = section();
    harness.findReport.mockResolvedValue({
      id: "report-1",
      periodStart: new Date("2026-08-03T00:00:00.000Z"),
      status: "draft",
      periodStatus: "open",
      periodState: "open",
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
      status: "published",
      periodStatus: "published",
      periodState: "published",
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
      status: "published",
      periodStatus: "published",
      periodState: "published",
      weekLabel: null,
      archived: false,
      publishedSnapshot: null,
    });

    await expect(harness.loader.load(locator("live"))).resolves.toBeNull();
    expect(harness.findSection).not.toHaveBeenCalled();
  });

  it("reloads an archived published snapshot", async () => {
    const harness = prismaHarness();
    const snapshotSection = section();
    const snapshot = { frozen: true };
    harness.findReport.mockResolvedValue({
      id: "report-1",
      periodStart: new Date("2026-08-03T00:00:00.000Z"),
      status: "published",
      periodStatus: "published",
      periodState: "archived",
      weekLabel: "Week 31",
      archived: true,
      publishedSnapshot: snapshot,
    });
    parsePublishedSnapshot.mockReturnValue({
      reportId: "report-1",
      sections: [snapshotSection],
    });

    await expect(
      harness.loader.load(locator("snapshot")),
    ).resolves.toMatchObject({
      kind: "item",
      context: { source: "snapshot", reportId: "report-1" },
    });
  });

  it.each([
    [
      "archived live",
      {
        status: "draft",
        periodStatus: "open",
        periodState: "archived",
        archived: true,
      },
    ],
    [
      "contradictory published",
      {
        status: "published",
        periodStatus: "published",
        periodState: "published",
        archived: true,
      },
    ],
  ])("rejects %s lifecycle", async (_name, lifecycle) => {
    const harness = prismaHarness();
    harness.findReport.mockResolvedValue({
      id: "report-1",
      periodStart: new Date("2026-08-03T00:00:00.000Z"),
      weekLabel: null,
      publishedSnapshot: { frozen: true },
      ...lifecycle,
    });

    await expect(harness.loader.load(locator("live"))).resolves.toBeNull();
    await expect(harness.loader.load(locator("snapshot"))).resolves.toBeNull();
    expect(harness.findSection).not.toHaveBeenCalled();
  });

  it("reloads a reopened live section but rejects its snapshot source", async () => {
    const harness = prismaHarness();
    harness.findReport.mockResolvedValue({
      id: "report-1",
      periodStart: new Date("2026-08-03T00:00:00.000Z"),
      status: "published",
      periodStatus: "reopened",
      periodState: "open",
      weekLabel: null,
      archived: false,
      publishedSnapshot: { frozen: true },
    });
    harness.findSection.mockResolvedValue(section());

    await expect(harness.loader.load(locator("live"))).resolves.toMatchObject({
      kind: "item",
      context: { source: "live" },
    });
    await expect(harness.loader.load(locator("snapshot"))).resolves.toBeNull();
  });

  it("rejects a snapshot that cannot be parsed", async () => {
    const harness = prismaHarness();
    harness.findReport.mockResolvedValue({
      id: "report-1",
      periodStart: new Date("2026-08-03T00:00:00.000Z"),
      status: "published",
      periodStatus: "published",
      periodState: "archived",
      weekLabel: null,
      archived: true,
      publishedSnapshot: { malformed: true },
    });
    parsePublishedSnapshot.mockImplementation(() => {
      throw new Error("invalid snapshot");
    });

    await expect(harness.loader.load(locator("snapshot"))).resolves.toBeNull();
  });

  it.each([
    [
      "changed publishedSnapshot bytes",
      {
        status: "published",
        periodStatus: "published",
        periodState: "published",
        archived: false,
        publishedSnapshot: { frozen: "v2" },
      },
    ],
    [
      "an invalid published lifecycle",
      {
        status: "published",
        periodStatus: "reopened",
        periodState: "open",
        archived: false,
        publishedSnapshot: { frozen: true },
      },
    ],
  ])("rejects a snapshot reread returning %s", async (_name, secondRead) => {
    const harness = prismaHarness();
    harness.findReport
      .mockResolvedValueOnce({
        id: "report-1",
        periodStart: new Date("2026-08-03T00:00:00.000Z"),
        status: "published",
        periodStatus: "published",
        periodState: "published",
        weekLabel: "Week 31",
        archived: false,
        publishedSnapshot: { frozen: true },
      })
      .mockResolvedValueOnce({
        id: "report-1",
        periodStart: new Date("2026-08-03T00:00:00.000Z"),
        weekLabel: "Week 31",
        ...secondRead,
      });
    parsePublishedSnapshot.mockReturnValue({
      reportId: "report-1",
      sections: [section()],
    });

    await expect(harness.loader.load(locator("snapshot"))).resolves.toBeNull();
    expect(harness.findReport).toHaveBeenCalledTimes(2);
    expect(harness.findSection).not.toHaveBeenCalled();
  });

  it("rejects a lifecycle race while loading a live section", async () => {
    const harness = prismaHarness();
    harness.findReport
      .mockResolvedValueOnce({
        id: "report-1",
        periodStart: new Date("2026-08-03T00:00:00.000Z"),
        status: "draft",
        periodStatus: "open",
        periodState: "open",
        weekLabel: null,
        archived: false,
        publishedSnapshot: null,
      })
      .mockResolvedValueOnce({
        id: "report-1",
        periodStart: new Date("2026-08-03T00:00:00.000Z"),
        status: "published",
        periodStatus: "published",
        periodState: "published",
        weekLabel: null,
        archived: false,
        publishedSnapshot: { frozen: true },
      });
    harness.findSection.mockResolvedValue(section());

    await expect(harness.loader.load(locator("live"))).resolves.toBeNull();
  });
});
