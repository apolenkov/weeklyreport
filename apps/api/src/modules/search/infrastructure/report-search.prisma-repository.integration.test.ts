import { Prisma } from "@prisma/client";
import { toPublishedSnapshotJson } from "@weeklyreport/report-persistence";
import {
  reportSectionReadModelSchema,
  type SearchPlan,
} from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper.js";
import { buildTransition } from "../../period/domain/period-transition.js";
import { authorizeReportOccurrences } from "../application/authorized-report-retrieval.js";
import { projectSectionCandidates } from "../domain/candidate-projector.js";
import { selectPeriodSources } from "../domain/period-source-selection.js";
import { ReportSearchPrismaRepository } from "./report-search.prisma-repository.js";

const GROUP_ID = "c0000000-0000-4000-a000-000000000001";
const LEAD_ID = "c0000000-0000-4000-a000-000000000002";
const PROJECT_ID = "c0000000-0000-4000-a000-000000000003";
const CURRENT_REPORT_ID = "c0000000-0000-4000-a000-000000000010";
const FUTURE_REPORT_ID = "c0000000-0000-4000-a000-000000000016";
const PUBLISHED_REPORT_IDS = [
  "c0000000-0000-4000-a000-000000000011",
  "c0000000-0000-4000-a000-000000000012",
  "c0000000-0000-4000-a000-000000000013",
  "c0000000-0000-4000-a000-000000000014",
  "c0000000-0000-4000-a000-000000000015",
] as const;
const CURRENT_SECTION_ID = "c0000000-0000-4000-a000-000000000020";
const PUBLISHED_SECTION_IDS = PUBLISHED_REPORT_IDS.map(
  (_, index) => `c0000000-0000-4000-a000-00000000002${index + 1}`,
);
const CURRENT_ITEM_ID = "c0000000-0000-4000-a000-000000000030";
const PUBLISHED_ITEM_IDS = PUBLISHED_REPORT_IDS.map(
  (_, index) => `c0000000-0000-4000-a000-00000000003${index + 1}`,
);
const FIXTURE_NOW = new Date("2026-08-04T00:00:00.000Z");

function requirePublishedItemId(index: number): string {
  const itemId = PUBLISHED_ITEM_IDS[index];
  if (itemId === undefined) {
    throw new Error(`Published item fixture is missing at index ${index}.`);
  }
  return itemId;
}

type PeriodIntent = Pick<SearchPlan, "periods">;

const prisma = createTestPrisma();
const repository = new ReportSearchPrismaRepository(prisma as never);

function periodIntent(
  includeCurrent: boolean,
  mode: "none" | "latest" | "all" | "named",
  count: number | null,
): PeriodIntent {
  return {
    periods: {
      includeCurrent,
      published: { mode, count, references: [] },
    },
  };
}

function snapshotJson(
  reportId: string,
  periodStart: string,
  sectionId: string,
  itemId: string,
  text: string,
): Prisma.InputJsonValue {
  const section = reportSectionReadModelSchema.parse({
    reportSectionId: sectionId,
    reportId,
    authorId: LEAD_ID,
    authorName: "Integration Lead",
    authorRole: "lead",
    groupId: GROUP_ID,
    groupName: "Search Integration Group",
    version: 1,
    status: "submitted",
    submittedAt: new Date(`${periodStart}T12:00:00.000Z`),
    projects: [],
    referencedProjects: [
      { projectId: PROJECT_ID, projectName: "Integration Product" },
    ],
    items: [
      {
        id: itemId,
        stableId: itemId,
        projectId: PROJECT_ID,
        type: "current",
        text,
        tag: "integration",
        workflowStatus: "in_progress",
        carriedOver: false,
        priorityRank: null,
        stageNames: ["Development"],
      },
    ],
    risks: [],
    decisions: [],
    activities: [],
  });

  return toPublishedSnapshotJson({
    reportId,
    periodStart: new Date(`${periodStart}T00:00:00.000Z`),
    periodEnd: new Date(`${periodStart}T23:59:59.999Z`),
    deadline: new Date(`${periodStart}T18:00:00.000Z`),
    status: "published",
    publishedAt: new Date(`${periodStart}T19:00:00.000Z`),
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "green",
      totals: { green: 0, yellow: 0, red: 0 },
    },
    sections: [section],
  });
}

async function createReportFixture(input: {
  reportId: string;
  sectionId: string;
  itemId: string;
  periodStart: string;
  weekLabel: string;
  periodStatus: "open" | "published";
  text: string;
}): Promise<void> {
  const isPublished = input.periodStatus === "published";
  const periodStart = new Date(`${input.periodStart}T00:00:00.000Z`);
  const publishedAt = new Date(`${input.periodStart}T19:00:00.000Z`);
  const lifecycle = isPublished
    ? buildTransition("publish", { now: publishedAt, userId: LEAD_ID })
    : buildTransition("create", { periodStart, now: FIXTURE_NOW });
  await prisma.report.create({
    data: {
      id: input.reportId,
      periodStart,
      periodEnd: new Date(`${input.periodStart}T23:59:59.999Z`),
      deadline: new Date(`${input.periodStart}T18:00:00.000Z`),
      ...lifecycle,
      weekLabel: input.weekLabel,
      publishedSnapshot: isPublished
        ? snapshotJson(
            input.reportId,
            input.periodStart,
            input.sectionId,
            input.itemId,
            input.text,
          )
        : Prisma.DbNull,
    },
  });
  await prisma.reportSection.create({
    data: {
      id: input.sectionId,
      reportId: input.reportId,
      authorId: LEAD_ID,
      status: "submitted",
    },
  });
  await prisma.item.create({
    data: {
      id: input.itemId,
      reportSectionId: input.sectionId,
      projectId: PROJECT_ID,
      type: "current",
      text: input.text,
      tag: "integration",
      workflowStatus: "in_progress",
      stageNames: ["Development"],
    },
  });
}

async function seedReports(): Promise<void> {
  await prisma.reportingGroup.create({
    data: { id: GROUP_ID, name: "Search Integration Group" },
  });
  await prisma.user.create({
    data: {
      id: LEAD_ID,
      email: "report-search-integration@test.local",
      name: "Integration Lead",
      lastName: "Integration",
      firstName: "Lead",
      role: "lead",
      samlId: "report-search-integration-lead",
      reportingGroupId: GROUP_ID,
    },
  });
  await prisma.project.create({
    data: {
      id: PROJECT_ID,
      name: "Integration Product",
      leadId: LEAD_ID,
    },
  });
  await createReportFixture({
    reportId: CURRENT_REPORT_ID,
    sectionId: CURRENT_SECTION_ID,
    itemId: CURRENT_ITEM_ID,
    periodStart: "2026-08-01",
    weekLabel: "Current",
    periodStatus: "open",
    text: "Current draft content",
  });
  await createReportFixture({
    reportId: FUTURE_REPORT_ID,
    sectionId: "c0000000-0000-4000-a000-000000000026",
    itemId: "c0000000-0000-4000-a000-000000000036",
    periodStart: "2026-08-08",
    weekLabel: "Future",
    periodStatus: "open",
    text: "Future preview content",
  });
  const starts = [
    "2026-07-27",
    "2026-07-20",
    "2026-07-13",
    "2026-07-06",
    "2026-06-29",
  ];
  await Promise.all(
    PUBLISHED_REPORT_IDS.map((reportId, index) =>
      createReportFixture({
        reportId,
        sectionId: PUBLISHED_SECTION_IDS[index] ?? CURRENT_SECTION_ID,
        itemId: PUBLISHED_ITEM_IDS[index] ?? CURRENT_ITEM_ID,
        periodStart: starts[index] ?? "2026-06-29",
        weekLabel: `W${index + 1}`,
        periodStatus: "published",
        text: `Frozen content ${index + 1}`,
      }),
    ),
  );
}

beforeEach(async () => {
  await cleanDatabase();
  await seedReports();
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectTestPrisma();
});

describe("ReportSearchPrismaRepository source authority (integration)", () => {
  it.each([
    {
      name: "none",
      options: { publishedMode: "none" as const },
      expectedPublished: [],
    },
    {
      name: "latest with zero count",
      options: { publishedMode: "latest" as const, publishedCount: 0 },
      expectedPublished: [],
    },
    {
      name: "latest with default count",
      options: { publishedMode: "latest" as const, publishedCount: 3 },
      expectedPublished: [0, 1, 2],
    },
    {
      name: "latest with maximum count",
      options: { publishedMode: "latest" as const, publishedCount: 50 },
      expectedPublished: [0, 1, 2, 3, 4],
    },
    {
      name: "named labels",
      options: {
        publishedMode: "named" as const,
        publishedLabels: ["W2", "W4"],
      },
      expectedPublished: [1, 3],
    },
    {
      name: "all",
      options: { publishedMode: "all" as const },
      expectedPublished: [0, 1, 2, 3, 4],
    },
  ])(
    "returns the exact published range for $name",
    async ({ options, expectedPublished }) => {
      const sources = await repository.listSources(options);

      expect(
        sources
          .filter((source) => source.source === "snapshot")
          .map((source) => source.reportId),
      ).toEqual(expectedPublished.map((index) => PUBLISHED_REPORT_IDS[index]));
      expect(
        sources
          .filter((source) => source.source === "live")
          .map((source) => source.reportId),
      ).toEqual([CURRENT_REPORT_ID]);
    },
  );

  it("uses canonical lifecycle tuples as source authority", async () => {
    await prisma.report.update({
      where: { id: CURRENT_REPORT_ID },
      data: buildTransition("archive", {}),
    });
    await prisma.report.update({
      where: { id: PUBLISHED_REPORT_IDS[0] },
      data: buildTransition("reopen", { now: FIXTURE_NOW }),
    });
    await prisma.report.update({
      where: { id: PUBLISHED_REPORT_IDS[1] },
      data: buildTransition("archive", {}),
    });

    const sources = await repository.listSources({ publishedMode: "all" });
    const byId = new Map(sources.map((source) => [source.reportId, source]));

    expect(byId.has(FUTURE_REPORT_ID)).toBe(false);
    expect(byId.get(PUBLISHED_REPORT_IDS[0])).toEqual(
      expect.objectContaining({ source: "live", periodStatus: "reopened" }),
    );
    expect(byId.has(CURRENT_REPORT_ID)).toBe(false);
    expect(byId.get(PUBLISHED_REPORT_IDS[1])).toEqual(
      expect.objectContaining({
        source: "snapshot",
        periodStatus: "published",
      }),
    );
  });

  it("includes current draft content and ignores drift in published live rows", async () => {
    const sources = await repository.listSources();
    const current = sources.find(
      (source) => source.reportId === CURRENT_REPORT_ID,
    );
    const published = sources.find(
      (source) => source.reportId === PUBLISHED_REPORT_IDS[0],
    );

    if (!current || !published)
      throw new Error("Integration source fixture missing.");
    expect(current.source).toBe("live");
    expect(published.source).toBe("snapshot");
    const beforeDrift = await repository.loadOccurrences([current, published]);
    expect(
      beforeDrift.flatMap((occurrence) =>
        occurrence.sections.flatMap((section) =>
          section.items.map((item) => item.text),
        ),
      ),
    ).toEqual(["Current draft content", "Frozen content 1"]);

    await prisma.item.update({
      where: { id: requirePublishedItemId(0) },
      data: { text: "Live row drift" },
    });
    const afterDrift = await repository.loadOccurrences([published]);
    expect(afterDrift[0]?.sections[0]?.items[0]?.text).toBe("Frozen content 1");
  });

  it("selects default and explicit ranges and keeps one source per report", async () => {
    const sources = await repository.listSources();
    expect(
      sources.filter((source) => source.reportId === PUBLISHED_REPORT_IDS[0]),
    ).toHaveLength(1);
    const fourPublishedSources = await repository.listSources({
      publishedMode: "latest",
      publishedCount: 4,
    });
    expect(
      selectPeriodSources(
        sources,
        periodIntent(true, "latest", 3),
        new Date("2026-08-04T00:00:00.000Z"),
      ).map((source) => source.reportId),
    ).toEqual([
      CURRENT_REPORT_ID,
      PUBLISHED_REPORT_IDS[0],
      PUBLISHED_REPORT_IDS[1],
      PUBLISHED_REPORT_IDS[2],
    ]);
    expect(
      selectPeriodSources(
        fourPublishedSources,
        periodIntent(false, "latest", 4),
        new Date("2026-08-04T00:00:00.000Z"),
      ).map((source) => source.reportId),
    ).toEqual(PUBLISHED_REPORT_IDS.slice(0, 4));
  });

  it("switches a report with a snapshot to live-only when reopened", async () => {
    const reportId = PUBLISHED_REPORT_IDS[0];
    await prisma.report.update({
      where: { id: reportId },
      data: buildTransition("reopen", { now: FIXTURE_NOW }),
    });

    const sources = await repository.listSources();
    const reportSources = sources.filter(
      (source) => source.reportId === reportId,
    );
    expect(reportSources).toHaveLength(1);
    expect(reportSources[0]?.source).toBe("live");
    const occurrence = await repository.loadOccurrences(reportSources);
    expect(occurrence[0]?.sections[0]?.items[0]?.text).toBe("Frozen content 1");
  });

  it("advances current retrieval after the scheduler opens the next period and freezes published drift", async () => {
    const sources = await repository.listSources();
    const current = selectPeriodSources(
      sources,
      periodIntent(true, "none", null),
      new Date("2026-08-04T00:00:00.000Z"),
    );
    await prisma.report.update({
      where: { id: FUTURE_REPORT_ID },
      data: buildTransition("open", {}),
    });
    const advancedSources = await repository.listSources();
    const aged = selectPeriodSources(
      advancedSources,
      periodIntent(true, "none", null),
      new Date("2026-08-08T00:00:00.000Z"),
    );
    expect(current[0]?.reportId).toBe(CURRENT_REPORT_ID);
    expect(aged[0]?.reportId).toBe(FUTURE_REPORT_ID);

    const futureOccurrences = await repository.loadOccurrences(aged);
    const authorized = await authorizeReportOccurrences(
      repository,
      LEAD_ID,
      futureOccurrences,
    );
    const futureCandidates = authorized.sectionScopes.flatMap((scope) => {
      const occurrence = authorized.occurrences.find(
        (candidate) => candidate.reportId === scope.reportId,
      );
      if (!occurrence) throw new Error("Future occurrence missing.");
      return projectSectionCandidates(occurrence, scope);
    });
    expect(futureCandidates).not.toHaveLength(0);

    const published = sources.find(
      (source) => source.reportId === PUBLISHED_REPORT_IDS[0],
    );
    if (!published) throw new Error("Published integration source missing.");
    await prisma.item.update({
      where: { id: requirePublishedItemId(0) },
      data: { text: "Live row drift after finalization" },
    });
    const frozen = await repository.loadOccurrences([published]);
    expect(frozen[0]?.sections[0]?.items[0]?.text).toBe("Frozen content 1");
  });
});
