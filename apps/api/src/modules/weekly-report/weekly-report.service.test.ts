import {
  assembledReportSchema,
  type UserSession,
  type WeeklyReportReadModel,
  weeklyReportReadModelSchema,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  makeProjectReadModel,
  makeReportSectionReadModel,
} from "../../test-utils/report-section-fixtures.js";
import { buildCompiledHistoryEntries } from "./compiled-history.js";
import { queryCompiledHistory } from "./compiled-history.prisma-query.js";
import {
  WeeklyReportDomainError,
  type WeeklyReportRepository,
  type WeeklyReportRepositoryResult,
  WeeklyReportService,
} from "./weekly-report.service";

const reportId = "11111111-1111-4111-8111-111111111111";
const currentReportId = "22222222-2222-4222-8222-222222222222";
const groupId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";
const projectId = "55555555-5555-4555-8555-555555555555";
const historySectionId = "77777777-7777-4777-8777-777777777777";
const reopenedSectionId = "88888888-8888-4888-8888-888888888888";

function historySnapshot() {
  return assembledReportSchema.parse({
    reportId,
    periodStart: new Date("2026-04-06T00:00:00.000Z"),
    periodEnd: new Date("2026-04-12T23:59:59.999Z"),
    deadline: new Date("2026-04-10T15:00:00.000Z"),
    status: "published",
    publishedAt: new Date("2026-04-12T18:00:00.000Z"),
    publishedById: userId,
    publishedByName: "Head User",
    portfolioOverview: {
      status: "red",
      totals: { green: 1, yellow: 0, red: 1 },
    },
    sections: [
      makeReportSectionReadModel({
        reportSectionId: historySectionId,
        reportId,
        authorId: userId,
        authorName: "Lead A",
        status: "submitted",
        projects: [
          makeProjectReadModel({
            projectId,
            projectName: "Project Alpha",
            trafficLight: "green",
          }),
          makeProjectReadModel({
            projectId: currentReportId,
            projectName: "Project Beta",
            trafficLight: "red",
          }),
        ],
        groupId,
        groupName: "Weekly Group",
      }),
    ],
  });
}

function session(role: UserSession["role"] = "head"): UserSession {
  return {
    userId,
    email: "weekly-report@example.test",
    name: "Weekly Report User",
    role,
    reportingGroupId: role === "admin" ? undefined : groupId,
    viewerGroupAccess: role === "viewer" ? [groupId] : undefined,
  };
}

function makeWeeklyReport(
  overrides: Partial<WeeklyReportReadModel> = {},
): WeeklyReportReadModel {
  return weeklyReportReadModelSchema.parse({
    reportId,
    periodStart: new Date("2026-04-14"),
    periodEnd: new Date("2026-04-18"),
    deadline: new Date("2026-04-17T15:00:00.000Z"),
    periodState: "open",
    periodStatus: "open",
    archived: false,
    weekLabel: "W16-2026",
    submissionCount: 1,
    totalLeads: 1,
    activeDeadlineReminderRuleId: "a0000000-0000-4000-a000-000000000600",
    portfolioOverview: [
      {
        productId: projectId,
        productName: "Project Alpha",
        worstStatus: "green",
        stageCount: 1,
        leadNames: ["Lead A"],
        leadIds: [userId],
      },
    ],
    leadSections: [
      makeReportSectionReadModel({
        reportSectionId: "66666666-6666-4666-8666-666666666666",
        reportId,
        authorId: userId,
        authorName: "Lead A",
        authorRole: "lead",
        version: 1,
        status: "submitted",
        submittedAt: new Date("2026-04-16T10:00:00.000Z"),
        late: false,
        projects: [
          makeProjectReadModel({
            projectId,
            projectName: "Project Alpha",
            trafficLight: "green",
          }),
        ],
        items: [],
        risks: [],
        decisions: [],
      }),
    ],
    escalations: [],
    ...overrides,
  });
}

function makeResult(
  readModel: WeeklyReportReadModel,
  crossGroup: WeeklyReportRepositoryResult["crossGroup"] = null,
): WeeklyReportRepositoryResult {
  return { readModel, crossGroup };
}

function createRepository(
  reports: ReadonlyMap<string, WeeklyReportReadModel>,
  currentEditableId: string | null = null,
  latestPublishedVisibleId: string | null = null,
): WeeklyReportRepository & {
  readonly getWeeklyReport: ReturnType<typeof vi.fn>;
  readonly getCurrentEditableIdForSession: ReturnType<typeof vi.fn>;
} {
  return {
    getWeeklyReport: vi.fn((id: string) => {
      const report = reports.get(id);
      return Promise.resolve(
        report ? makeResult(structuredClone(report)) : null,
      );
    }),
    getCurrentEditableId: vi.fn(() => Promise.resolve(currentEditableId)),
    getCurrentEditableIdForSession: vi.fn(() =>
      Promise.resolve(currentEditableId),
    ),
    getLatestPublishedNonArchivedId: vi.fn(() => Promise.resolve(null)),
    getCompiledHistory: vi.fn(() =>
      Promise.resolve({ reports: [], archiveCount: 0 }),
    ),
    getVisibleReportId: vi.fn(() => Promise.resolve(currentEditableId)),
    getLatestPublishedVisibleId: vi.fn(() =>
      Promise.resolve(latestPublishedVisibleId),
    ),
  };
}

describe("compiled history immutable snapshots", () => {
  it("derives health and product counts from the frozen snapshot", () => {
    const entries = buildCompiledHistoryEntries([
      { archived: true, snapshot: historySnapshot() },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      reportId,
      archived: true,
      publishedByName: "Head User",
      trafficLights: { green: 1, yellow: 0, red: 1 },
      sectionCount: 1,
      productCount: 2,
    });
  });

  function queryFixture(periodStatus: "published" | "reopened") {
    const report = {
      id: reportId,
      archived: false,
      periodStatus,
      publishedSnapshot: JSON.parse(JSON.stringify(historySnapshot())) as never,
      sections: [{ id: historySectionId }, { id: reopenedSectionId }],
    };
    const findMany = vi.fn().mockResolvedValue([report]);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = {
      report: {
        findMany,
        count,
      },
    } as never;
    return { prisma, findMany, count };
  }

  it("reads a closed publication without intersecting mutable live section ids", async () => {
    const fixture = queryFixture("published");
    const result = await queryCompiledHistory(
      fixture.prisma,
      session("admin"),
      true,
    );

    expect(result.reports[0]?.snapshot.sections).toHaveLength(1);
    expect(result.reports[0]?.snapshot.sections[0]?.reportSectionId).toBe(
      historySectionId,
    );
    expect(fixture.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("ignores a new live section while the report is reopened", async () => {
    const fixture = queryFixture("reopened");
    const result = await queryCompiledHistory(
      fixture.prisma,
      session("admin"),
      true,
    );

    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]?.snapshot.sections).toHaveLength(1);
    expect(result.reports[0]?.snapshot.sections[0]?.reportSectionId).toBe(
      historySectionId,
    );
  });

  it("bounds viewer history and archive count with the indexed frozen scope", async () => {
    const fixture = queryFixture("published");
    const viewer = session("viewer");

    await queryCompiledHistory(fixture.prisma, viewer, true);

    const scope: Prisma.ReportWhereInput = {
      publishedSectionScopes: {
        some: { groupId: { in: [groupId] } },
      },
    };
    const listQuery = fixture.findMany.mock.calls[0]?.[0] as
      Prisma.ReportFindManyArgs | undefined;
    expect(listQuery).toEqual({
      where: {
        status: "published",
        periodStatus: "published",
        ...scope,
      },
      orderBy: [
        { periodStart: "desc" },
        { publishedAt: "desc" },
        { id: "desc" },
      ],
      take: 100,
      select: {
        id: true,
        archived: true,
        publishedSnapshot: true,
      },
    });
    const countQuery = fixture.count.mock.calls[0]?.[0] as
      Prisma.ReportCountArgs | undefined;
    expect(countQuery).toEqual({
      where: {
        status: "published",
        archived: true,
        periodStatus: "published",
        ...scope,
      },
    });
  });
});

describe("WeeklyReportService", () => {
  it("forwards the authenticated session to an explicit read", async () => {
    const report = makeWeeklyReport();
    const repository = createRepository(new Map([[reportId, report]]));
    const service = new WeeklyReportService(repository);
    const caller = session("head");

    await expect(
      service.getWeeklyReport(reportId, caller),
    ).resolves.toMatchObject({
      status: "active",
      reportId,
    });

    expect(repository.getWeeklyReport).toHaveBeenCalledWith(reportId, caller);
  });

  it("defaults only to the current editable report", async () => {
    const report = makeWeeklyReport({ reportId: currentReportId });
    const repository = createRepository(
      new Map([[currentReportId, report]]),
      currentReportId,
    );
    const service = new WeeklyReportService(repository);
    const caller = session("lead");

    await expect(
      service.getWeeklyReport(undefined, caller),
    ).resolves.toMatchObject({
      status: "active",
      reportId: currentReportId,
    });
    expect(repository.getCurrentEditableIdForSession).toHaveBeenCalledWith(
      caller,
    );
  });

  it("returns no-period instead of defaulting to published history", async () => {
    const repository = createRepository(new Map(), null);
    const service = new WeeklyReportService(repository);

    await expect(
      service.getWeeklyReport(undefined, session("admin")),
    ).resolves.toEqual({
      status: "no-period",
      report: null,
      crossGroup: null,
    });
    expect(repository.getWeeklyReport).not.toHaveBeenCalled();
    expect(repository.getLatestPublishedNonArchivedId).not.toHaveBeenCalled();
  });

  it("rejects a viewer's non-current editable period", async () => {
    const report = makeWeeklyReport({ periodStatus: "open" });
    const service = new WeeklyReportService(
      createRepository(new Map([[reportId, report]]), currentReportId),
    );

    await expect(
      service.getWeeklyReport(reportId, session("viewer")),
    ).rejects.toBeInstanceOf(WeeklyReportDomainError);
  });

  it("allows a viewer's current editable and explicitly requested published reports", async () => {
    const viewer = session("viewer");
    const current = makeWeeklyReport({ periodStatus: "reopened" });
    const currentService = new WeeklyReportService(
      createRepository(new Map([[reportId, current]]), reportId),
    );
    await expect(
      currentService.getWeeklyReport(reportId, viewer),
    ).resolves.toMatchObject({
      status: "active",
      periodStatus: "reopened",
    });

    const published = makeWeeklyReport({
      periodState: "published",
      periodStatus: "published",
    });
    const publishedService = new WeeklyReportService(
      createRepository(new Map([[reportId, published]])),
    );
    await expect(
      publishedService.getWeeklyReport(reportId, viewer),
    ).resolves.toMatchObject({ status: "active", periodStatus: "published" });
  });

  it("keeps the cross-group signal for the router to audit", async () => {
    const signal = {
      productIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      groupIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
    };
    const repository = createRepository(
      new Map([[reportId, makeWeeklyReport()]]),
    );
    repository.getWeeklyReport.mockResolvedValue(
      makeResult(makeWeeklyReport(), signal),
    );
    const service = new WeeklyReportService(repository);

    const result = await service.getWeeklyReport(reportId, session("head"));

    expect(result).toMatchObject({ status: "active", crossGroup: signal });
  });

  it("resolves viewer navigation through the scoped current-then-published path", async () => {
    const viewer = session("viewer");
    const repository = createRepository(new Map(), currentReportId, reportId);
    const service = new WeeklyReportService(repository);

    await expect(service.latestForViewer(viewer)).resolves.toEqual({
      reportId: currentReportId,
    });
    expect(repository.getVisibleReportId).toHaveBeenCalledWith(
      currentReportId,
      viewer,
    );
  });
});
