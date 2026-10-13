import {
  type UserSession,
  weeklyReportGetResponseSchema,
  type WeeklyReportReadModel,
  weeklyReportReadModelSchema,
} from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { createNullLogger } from "../../lib/logger.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  makeProjectReadModel,
  makeReportSectionReadModel,
} from "../../test-utils/report-section-fixtures.js";
import {
  WeeklyReportDomainError,
  type WeeklyReportRepository,
  type WeeklyReportRepositoryResult,
  WeeklyReportService,
} from "./weekly-report.service";

const reportId = "11111111-1111-4111-8111-111111111111";
const activeReportId = "22222222-2222-4222-8222-222222222222";
const sectionId = "33333333-3333-4333-8333-333333333333";
const authorId = "44444444-4444-4444-8444-444444444444";
const projectId = "55555555-5555-4555-8555-555555555555";
const caller: UserSession = {
  userId: authorId,
  email: "lead@example.test",
  name: "Lead A",
  role: "lead",
  reportingGroupId: "77777777-7777-4777-8777-777777777777",
};

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
    totalLeads: 3,
    activeDeadlineReminderRuleId: "a0000000-0000-4000-a000-000000000600",
    portfolioOverview: [
      {
        productId: projectId,
        productName: "Project Alpha",
        worstStatus: "green",
        stageCount: 2,
        leadNames: ["Lead A"],
        leadIds: ["492e3762-5859-556b-a696-a97143cfad26"],
      },
    ],
    leadSections: [
      makeReportSectionReadModel({
        reportSectionId: sectionId,
        reportId,
        authorId,
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
        items: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            projectId,
            type: "current",
            text: "Implemented feature X",
            tag: "dev",
            workflowStatus: "done",
            carriedOver: false,
            stageNames: ["Development"],
          },
        ],
        risks: [],
        decisions: [],
      }),
    ],
    escalations: [],
    ...overrides,
  });
}

function createRepository(
  reports: Map<string, WeeklyReportReadModel>,
  currentEditableId: string | null = null,
): WeeklyReportRepository {
  return {
    getWeeklyReport(id: string): Promise<WeeklyReportRepositoryResult | null> {
      const model = reports.get(id);
      if (!model) return Promise.resolve(null);
      return Promise.resolve({
        readModel: structuredClone(model),
        crossGroup: null,
      });
    },
    getCurrentEditableId() {
      return Promise.resolve(currentEditableId);
    },
    getCurrentEditableIdForSession() {
      return Promise.resolve(currentEditableId);
    },
    getLatestPublishedNonArchivedId() {
      return Promise.resolve(null);
    },
    getCompiledHistory() {
      return Promise.resolve({
        reports: [],
        archiveCount: 0,
        truncated: false,
      });
    },
    getVisibleReportId() {
      return Promise.resolve(null);
    },
    getLatestPublishedVisibleId() {
      return Promise.resolve(null);
    },
  };
}

describe("WeeklyReportService — contract tests", () => {
  it("returns compiled weekly report data for a given reportId", async () => {
    const report = makeWeeklyReport();
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(
      createRepository(reports),
      createNullLogger(),
    );

    const result = await service.getWeeklyReport(reportId, caller);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");

    expect(result.reportId).toBe(reportId);
    expect(result.periodState).toBe("open");
    expect(result.periodStatus).toBe("open");
    expect(result.weekLabel).toBe("W16-2026");
    expect(result.submissionCount).toBe(1);
    expect(result.totalLeads).toBe(3);
    expect(result.portfolioOverview).toHaveLength(1);
    expect(expectDefined(result.portfolioOverview[0]).productName).toBe(
      "Project Alpha",
    );
    expect(result.leadSections).toHaveLength(1);
    expect(expectDefined(result.leadSections[0]).authorName).toBe("Lead A");
    expect(result.escalations).toEqual([]);

    // crossGroup is an internal audit signal stripped by the router before
    // the response is sent; exclude it from the schema round-trip check.
    const { crossGroup: _cg, ...publicResult } = result;
    const parsed = weeklyReportGetResponseSchema.parse(publicResult);
    expect(parsed).toEqual(publicResult);
  });

  it("throws WeeklyReportDomainError when report is not found", async () => {
    const reports = new Map<string, WeeklyReportReadModel>();
    const service = new WeeklyReportService(
      createRepository(reports),
      createNullLogger(),
    );

    await expect(
      service.getWeeklyReport("99999999-9999-4999-8999-999999999999", caller),
    ).rejects.toThrow(WeeklyReportDomainError);

    await expect(
      service.getWeeklyReport("99999999-9999-4999-8999-999999999999", caller),
    ).rejects.toThrow("not found");
  });

  it("uses active report when no ID is given", async () => {
    const report = makeWeeklyReport({ reportId: activeReportId });
    const reports = new Map([[activeReportId, report]]);
    const service = new WeeklyReportService(
      createRepository(reports, activeReportId),
      createNullLogger(),
    );

    const result = await service.getWeeklyReport(undefined, caller);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.reportId).toBe(activeReportId);
  });

  it("returns no-period sentinel when no active report exists and no ID given", async () => {
    // no-period → HTTP 200; React Query does not retry 3× as it would on throw.
    const service = new WeeklyReportService(
      createRepository(new Map(), null),
      createNullLogger(),
    );

    const result = await service.getWeeklyReport(undefined, caller);

    // crossGroup is an internal signal always null on the no-period path.
    expect(result).toEqual({
      status: "no-period",
      report: null,
      crossGroup: null,
    });
  });

  it("returns repository-provided escalations", async () => {
    const report = makeWeeklyReport({
      escalations: [
        {
          type: "blocked",
          productId: projectId,
          productName: "Project Alpha",
          stageName: "Development",
          authorId,
          leadName: "Lead A",
          description: "Blocked by external dependency",
        },
        {
          type: "at_risk",
          productId: projectId,
          productName: "Project Alpha",
          stageName: "Development",
          authorId,
          leadName: "Lead A",
          description: "Project Project Alpha is flagged red.",
        },
        {
          type: "unresolved_risk",
          productId: projectId,
          productName: "Project Alpha",
          stageName: "Development",
          authorId,
          leadName: "Lead A",
          description: "Key developer may leave",
        },
      ],
    });
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(
      createRepository(reports),
      createNullLogger(),
    );

    const result = await service.getWeeklyReport(reportId, caller);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.escalations).toHaveLength(3);
    expect(result.escalations.map((e) => e.type)).toEqual([
      "blocked",
      "at_risk",
      "unresolved_risk",
    ]);
  });

  it("returns repository-provided portfolio products and statuses", async () => {
    const secondProjectId = "88888888-8888-4888-8888-888888888888";
    const report = makeWeeklyReport({
      portfolioOverview: [
        {
          productId: projectId,
          productName: "Project Alpha",
          worstStatus: "red",
          stageCount: 2,
          leadNames: ["Lead A"],
          leadIds: ["492e3762-5859-556b-a696-a97143cfad26"],
        },
        {
          productId: secondProjectId,
          productName: "Project Beta",
          worstStatus: "yellow",
          stageCount: 1,
          leadNames: ["Lead B"],
          leadIds: ["e47c2b37-829f-5f29-870b-c9fe668493db"],
        },
      ],
    });
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(
      createRepository(reports),
      createNullLogger(),
    );

    const result = await service.getWeeklyReport(reportId, caller);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.portfolioOverview).toHaveLength(2);
    expect(expectDefined(result.portfolioOverview[0]).worstStatus).toBe("red");
    expect(expectDefined(result.portfolioOverview[1]).worstStatus).toBe(
      "yellow",
    );
  });

  it("returns report with zero submissions", async () => {
    const report = makeWeeklyReport({
      submissionCount: 0,
      leadSections: [],
    });
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(
      createRepository(reports),
      createNullLogger(),
    );

    const result = await service.getWeeklyReport(reportId, caller);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.submissionCount).toBe(0);
    expect(result.leadSections).toEqual([]);
  });

  it("result conforms to Zod response schema", async () => {
    const report = makeWeeklyReport();
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(
      createRepository(reports),
      createNullLogger(),
    );

    const result = await service.getWeeklyReport(reportId, caller);

    const parsed = weeklyReportGetResponseSchema.parse(result);
    expect(parsed.status).toBe("active");
    if (parsed.status !== "active") throw new Error("expected active");
    expect(parsed.reportId).toBe(reportId);
    expect(parsed.leadSections).toHaveLength(1);
  });

  it("preserves a scheduled canonical state in the public response", async () => {
    const report = makeWeeklyReport({
      periodState: "scheduled",
      periodStatus: "open",
    });
    const service = new WeeklyReportService(
      createRepository(new Map([[reportId, report]])),
      createNullLogger(),
    );

    const result = await service.getWeeklyReport(reportId, caller);

    expect(result).toMatchObject({
      status: "active",
      periodState: "scheduled",
      periodStatus: "open",
    });
  });
});
