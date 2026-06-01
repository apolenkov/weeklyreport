import {
  type WeeklyReportReadModel,
  weeklyReportReadModelSchema,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  type WeeklyReportRepository,
  WeeklyReportService,
} from "./weekly-report.service";

/* ------------------------------------------------------------------ */
/*  Fixed test UUIDs                                                   */
/* ------------------------------------------------------------------ */

const reportId = "aaa11111-1111-4111-8111-111111111111";
const sectionId1 = "bbb22222-2222-4222-8222-222222222222";
const authorId1 = "ddd44444-4444-4444-8444-444444444444";
const projectId1 = "fff66666-6666-4666-8666-666666666666";
const projectId2 = "11166666-6666-4666-8666-666666666666";

/* ------------------------------------------------------------------ */
/*  Fixture helpers                                                    */
/* ------------------------------------------------------------------ */

function makeWeeklyReport(
  overrides: Partial<WeeklyReportReadModel> = {},
): WeeklyReportReadModel {
  return weeklyReportReadModelSchema.parse({
    reportId,
    periodStart: new Date("2026-04-14"),
    periodEnd: new Date("2026-04-18"),
    deadline: new Date("2026-04-17T15:00:00.000Z"),
    periodStatus: "open",
    weekLabel: "W16-2026",
    submissionCount: 2,
    totalLeads: 6,
    hasActiveReminderRule: true,
    portfolioOverview: [
      {
        productId: projectId1,
        productName: "CRM Platform",
        worstStatus: "green",
        stageCount: 2,
        leadNames: ["Lead A"],
      },
    ],
    leadSections: [
      {
        reportSectionId: sectionId1,
        reportId,
        authorId: authorId1,
        authorName: "Lead A",
        status: "submitted",
        submittedAt: new Date("2026-04-16T10:00:00.000Z"),
        projects: [
          {
            projectId: projectId1,
            projectName: "CRM Platform",
            trafficLight: "green",
          },
        ],
        items: [
          {
            id: "77777777-7777-4777-8777-777777777777",
            projectId: projectId1,
            type: "current",
            text: "OAuth2 integration",
            tag: "feature",
            workflowStatus: "in_progress",
            carriedOver: false,
          },
        ],
        risks: [],
        decisions: [],
      },
    ],
    escalations: [],
    ...overrides,
  });
}

function createSpyRepository(
  reports: Map<string, WeeklyReportReadModel>,
  activeId: string | null = null,
): WeeklyReportRepository {
  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async WeeklyReportRepository contract (no awaitable work in the stub)
    getWeeklyReport: vi.fn(async (id: string) =>
      structuredClone(reports.get(id) ?? null),
    ),
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async WeeklyReportRepository contract (no awaitable work in the stub)
    getActiveReportId: vi.fn(async () => activeId),
  };
}

/* ------------------------------------------------------------------ */
/*  Integration tests — complementary to weekly-report.service.test.ts */
/* ------------------------------------------------------------------ */

describe("WeeklyReportService — integration (data shape)", () => {
  it("active period returns compiled report with all submitted sections", async () => {
    const report = makeWeeklyReport({ submissionCount: 2, totalLeads: 6 });
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(
      createSpyRepository(reports, reportId),
    );

    const result = await service.getWeeklyReport();

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.reportId).toBe(reportId);
    expect(result.submissionCount).toBe(2);
    expect(result.totalLeads).toBe(6);
    expect(result.leadSections).toHaveLength(1);
    expect(expectDefined(result.leadSections[0]).status).toBe("submitted");
  });

  it("portfolio overview carries worst-case aggregation", async () => {
    const report = makeWeeklyReport({
      portfolioOverview: [
        {
          productId: projectId1,
          productName: "CRM Platform",
          worstStatus: "red",
          stageCount: 3,
          leadNames: ["Lead A", "Lead B"],
        },
        {
          productId: projectId2,
          productName: "Mobile App",
          worstStatus: "green",
          stageCount: 1,
          leadNames: ["Lead C"],
        },
      ],
    });
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(createSpyRepository(reports));

    const result = await service.getWeeklyReport(reportId);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.portfolioOverview).toHaveLength(2);
    expect(expectDefined(result.portfolioOverview[0]).worstStatus).toBe("red");
    expect(expectDefined(result.portfolioOverview[1]).worstStatus).toBe(
      "green",
    );
  });

  it("escalations contain blocked items", async () => {
    const report = makeWeeklyReport({
      escalations: [
        {
          type: "blocked",
          productName: "Data Analytics",
          stageName: "Dev",
          leadName: "Maria K.",
          description: "ETL memory leak OOM",
        },
        {
          type: "at_risk",
          productName: "CRM",
          stageName: "Dev",
          leadName: "Lead A",
          description: "OAuth2 partner API limits",
        },
      ],
    });
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(createSpyRepository(reports));

    const result = await service.getWeeklyReport(reportId);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.escalations).toHaveLength(2);
    expect(expectDefined(result.escalations[0]).type).toBe("blocked");
    expect(expectDefined(result.escalations[1]).type).toBe("at_risk");
  });

  it("empty report returns empty sections", async () => {
    const report = makeWeeklyReport({
      submissionCount: 0,
      totalLeads: 6,
      portfolioOverview: [],
      leadSections: [],
      escalations: [],
    });
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(createSpyRepository(reports));

    const result = await service.getWeeklyReport(reportId);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.leadSections).toHaveLength(0);
    expect(result.portfolioOverview).toHaveLength(0);
    expect(result.escalations).toHaveLength(0);
    expect(result.submissionCount).toBe(0);
  });

  it("historical period returns published data unchanged", async () => {
    const report = makeWeeklyReport({
      periodStatus: "published",
      submissionCount: 6,
      totalLeads: 6,
    });
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(createSpyRepository(reports));

    const result = await service.getWeeklyReport(reportId);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.periodStatus).toBe("published");
    expect(result.submissionCount).toBe(6);
  });

  it("lead sections include items, risks, and decisions", async () => {
    const report = makeWeeklyReport({
      leadSections: [
        {
          reportSectionId: sectionId1,
          reportId,
          authorId: authorId1,
          authorName: "Lead A",
          status: "submitted",
          submittedAt: new Date("2026-04-16T10:00:00.000Z"),
          projects: [
            {
              projectId: projectId1,
              projectName: "CRM",
              trafficLight: "yellow",
            },
          ],
          items: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              projectId: projectId1,
              type: "current",
              text: "Feature X",
              tag: "dev",
              workflowStatus: "done",
              carriedOver: false,
            },
          ],
          risks: [
            {
              id: "99999999-9999-4999-8999-999999999999",
              projectId: projectId1,
              risk: "Deadline slip",
              impact: "Revenue",
              mitigation: "Hire contractor",
            },
          ],
          decisions: [
            {
              id: "aaaa9999-9999-4999-8999-999999999999",
              text: "Upgrade to PG16",
              owner: "Alice",
              impact: "Performance",
            },
          ],
        },
      ],
    });
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(createSpyRepository(reports));

    const result = await service.getWeeklyReport(reportId);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    const section = expectDefined(result.leadSections[0]);

    expect(section.items).toHaveLength(1);
    expect(section.risks).toHaveLength(1);
    expect(section.decisions).toHaveLength(1);
  });
});
