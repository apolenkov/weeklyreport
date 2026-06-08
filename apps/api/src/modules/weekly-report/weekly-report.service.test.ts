import {
  type WeeklyReportReadModel,
  weeklyReportReadModelSchema,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  WeeklyReportDomainError,
  type WeeklyReportRepository,
  WeeklyReportService,
} from "./weekly-report.service";

/* ------------------------------------------------------------------ */
/*  Fixed test UUIDs                                                   */
/* ------------------------------------------------------------------ */

const reportId = "11111111-1111-4111-8111-111111111111";
const activeReportId = "22222222-2222-4222-8222-222222222222";
const sectionId = "33333333-3333-4333-8333-333333333333";
const authorId = "44444444-4444-4444-8444-444444444444";
const projectId = "55555555-5555-4555-8555-555555555555";

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
    submissionCount: 1,
    totalLeads: 3,
    hasActiveReminderRule: true,
    portfolioOverview: [
      {
        productId: projectId,
        productName: "Project Alpha",
        worstStatus: "green",
        stageCount: 2,
        leadNames: ["Lead A"],
      },
    ],
    leadSections: [
      {
        reportSectionId: sectionId,
        reportId,
        authorId,
        authorName: "Lead A",
        status: "submitted",
        submittedAt: new Date("2026-04-16T10:00:00.000Z"),
        projects: [
          { projectId, projectName: "Project Alpha", trafficLight: "green" },
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
          },
        ],
        risks: [],
        decisions: [],
        priorities: [
          {
            id: "77777777-7777-4777-8777-777777777777",
            rank: 1,
            text: "Finish feature X",
          },
        ],
      },
    ],
    escalations: [],
    ...overrides,
  });
}

/* ------------------------------------------------------------------ */
/*  Spy repository                                                     */
/* ------------------------------------------------------------------ */

function createSpyRepository(
  reports: Map<string, WeeklyReportReadModel>,
  activeId: string | null = null,
): WeeklyReportRepository & {
  getWeeklyReport: ReturnType<typeof vi.fn>;
  getActiveReportId: ReturnType<typeof vi.fn>;
} {
  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async WeeklyReportRepository contract (no awaitable work in the stub)
    getWeeklyReport: vi.fn(async (id: string) =>
      structuredClone(reports.get(id) ?? null),
    ),
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async WeeklyReportRepository contract (no awaitable work in the stub)
    getActiveReportId: vi.fn(async () => activeId),
  };
}

/* ------------------------------------------------------------------ */
/*  Service-level unit tests                                           */
/* ------------------------------------------------------------------ */

describe("WeeklyReportService — unit tests", () => {
  it("calls getWeeklyReport with the provided reportId", async () => {
    const report = makeWeeklyReport();
    const reports = new Map([[reportId, report]]);
    const repo = createSpyRepository(reports);
    const service = new WeeklyReportService(repo);

    await service.getWeeklyReport(reportId);

    expect(repo.getWeeklyReport).toHaveBeenCalledOnce();
    expect(repo.getWeeklyReport).toHaveBeenCalledWith(reportId, undefined);
    // Should NOT call getActiveReportId when explicit ID is provided
    expect(repo.getActiveReportId).not.toHaveBeenCalled();
  });

  it("falls back to getActiveReportId when no ID is provided", async () => {
    const report = makeWeeklyReport({ reportId: activeReportId });
    const reports = new Map([[activeReportId, report]]);
    const repo = createSpyRepository(reports, activeReportId);
    const service = new WeeklyReportService(repo);

    await service.getWeeklyReport();

    expect(repo.getActiveReportId).toHaveBeenCalledOnce();
    expect(repo.getWeeklyReport).toHaveBeenCalledWith(
      activeReportId,
      undefined,
    );
  });

  it("throws WeeklyReportDomainError (not generic Error) for missing report", async () => {
    const repo = createSpyRepository(new Map());
    const service = new WeeklyReportService(repo);

    const error = await service
      .getWeeklyReport(reportId)
      .catch((error_: unknown) => error_);

    expect(error).toBeInstanceOf(WeeklyReportDomainError);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(reportId);
  });

  it("returns no-period sentinel when no active and no explicit ID", async () => {
    // R3a: replaces the old "throws WeeklyReportDomainError" contract.
    // 200 response with { status: 'no-period' } prevents React Query retry storm.
    const repo = createSpyRepository(new Map(), null);
    const service = new WeeklyReportService(repo);

    const result = await service.getWeeklyReport();

    expect(result).toEqual({ status: "no-period", report: null });
    // Should not have called getWeeklyReport at all
    expect(repo.getWeeklyReport).not.toHaveBeenCalled();
  });

  it("returns published period data unchanged", async () => {
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
    expect(result.totalLeads).toBe(6);
  });
});

/* ------------------------------------------------------------------ */
/*  AUTH-04 viewer scoping (Phase 28-01)                                */
/* ------------------------------------------------------------------ */

describe("WeeklyReportService — AUTH-04 viewer scoping", () => {
  it("viewer cannot read a draft (open) period", async () => {
    const draft = makeWeeklyReport({ periodStatus: "open" });
    const reports = new Map([[reportId, draft]]);
    const service = new WeeklyReportService(createSpyRepository(reports));

    await expect(
      service.getWeeklyReport(reportId, "viewer"),
    ).rejects.toBeInstanceOf(WeeklyReportDomainError);
  });

  it("viewer can read a published period", async () => {
    const published = makeWeeklyReport({ periodStatus: "published" });
    const reports = new Map([[reportId, published]]);
    const service = new WeeklyReportService(createSpyRepository(reports));

    const result = await service.getWeeklyReport(reportId, "viewer");

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.periodStatus).toBe("published");
    expect(result.reportId).toBe(reportId);
  });

  it("head role reads draft (open) period without filter", async () => {
    const draft = makeWeeklyReport({ periodStatus: "open" });
    const reports = new Map([[reportId, draft]]);
    const service = new WeeklyReportService(createSpyRepository(reports));

    const result = await service.getWeeklyReport(reportId, "head");

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.periodStatus).toBe("open");
  });

  it("lead and admin roles also read drafts (no scoping)", async () => {
    const draft = makeWeeklyReport({ periodStatus: "open" });
    const reports = new Map([[reportId, draft]]);
    const service = new WeeklyReportService(createSpyRepository(reports));

    await expect(
      service.getWeeklyReport(reportId, "lead"),
    ).resolves.toMatchObject({
      status: "active",
      periodStatus: "open",
    });
    await expect(
      service.getWeeklyReport(reportId, "admin"),
    ).resolves.toMatchObject({
      status: "active",
      periodStatus: "open",
    });
  });

  it("undefined role keeps legacy contract (no scoping; preserves pre-AUTH-04 callers)", async () => {
    const draft = makeWeeklyReport({ periodStatus: "open" });
    const reports = new Map([[reportId, draft]]);
    const service = new WeeklyReportService(createSpyRepository(reports));

    const result = await service.getWeeklyReport(reportId, undefined);
    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.periodStatus).toBe("open");
  });
});
