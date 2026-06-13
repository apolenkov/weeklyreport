import {
  type WeeklyReportReadModel,
  weeklyReportReadModelSchema,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  WeeklyReportDomainError,
  type WeeklyReportRepository,
  type WeeklyReportRepositoryResult,
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

function makeRepoResult(
  readModel: WeeklyReportReadModel,
  crossGroup: WeeklyReportRepositoryResult["crossGroup"] = null,
): WeeklyReportRepositoryResult {
  return { readModel, crossGroup };
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
    getWeeklyReport: vi.fn(async (id: string) => {
      const model = reports.get(id);
      return model ? makeRepoResult(structuredClone(model)) : null;
    }),
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

    // crossGroup is an internal audit signal; always null on the no-period path.
    expect(result).toEqual({
      status: "no-period",
      report: null,
      crossGroup: null,
    });
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

/* ------------------------------------------------------------------ */
/*  Task 4 — cross-group audit signal threading                        */
/* ------------------------------------------------------------------ */

const crossProductId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const crossGroupId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Repository that lets each test control the crossGroup signal. */
function createCrossGroupRepository(
  readModel: WeeklyReportReadModel,
  crossGroup: WeeklyReportRepositoryResult["crossGroup"],
): WeeklyReportRepository {
  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async WeeklyReportRepository contract
    async getWeeklyReport(_id: string) {
      return makeRepoResult(structuredClone(readModel), crossGroup);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async WeeklyReportRepository contract
    async getActiveReportId() {
      return null;
    },
  };
}

describe("WeeklyReportService — cross-group audit signal (task 4)", () => {
  // 4.1 — non-admin read surfaces cross-group products: crossGroup is forwarded
  it("forwards crossGroup signal when non-admin read surfaces a cross-group product", async () => {
    const report = makeWeeklyReport();
    const signal = {
      productIds: [crossProductId],
      groupIds: [crossGroupId],
    };
    const service = new WeeklyReportService(
      createCrossGroupRepository(report, signal),
    );

    const result = await service.getWeeklyReport(reportId, "lead");

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.crossGroup).toEqual(signal);
  });

  it("forwards crossGroup with two products — still one signal object (per-request dedupe)", async () => {
    const report = makeWeeklyReport();
    const twoProducts = {
      productIds: [crossProductId, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
      groupIds: [crossGroupId],
    };
    const service = new WeeklyReportService(
      createCrossGroupRepository(report, twoProducts),
    );

    const result = await service.getWeeklyReport(reportId, "head");

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    // Single signal object — not one per product. The router-level
    // exactly-one-emit rule is covered by scope-accessed-emit.test.ts.
    expect(result.crossGroup).toEqual(twoProducts);
  });

  // 4.2 — negative tests: no cross-group signal in own-group or admin reads
  it("passes crossGroup null when repository signals no cross-group products", async () => {
    const report = makeWeeklyReport();
    const service = new WeeklyReportService(
      createCrossGroupRepository(report, null),
    );

    const result = await service.getWeeklyReport(reportId, "lead");

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.crossGroup).toBeNull();
  });

  it("passes crossGroup through unchanged for admin read (router owns the admin guard)", async () => {
    const report = makeWeeklyReport();
    // Repository may return a signal even for admin (it doesn't know the role);
    // the router guards on role — but the service passes it through transparently.
    // This test confirms the service does NOT suppress the signal for admin
    // (the suppression is the router's responsibility).
    const signal = { productIds: [crossProductId], groupIds: [crossGroupId] };
    const service = new WeeklyReportService(
      createCrossGroupRepository(report, signal),
    );

    const result = await service.getWeeklyReport(reportId, "admin");

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    // Service passes signal through; router is responsible for the admin guard.
    expect(result.crossGroup).toEqual(signal);
  });

  // 4.3 — invariance: read model fields are identical regardless of crossGroup value
  it("read model fields are identical whether crossGroup is present or null", async () => {
    const report = makeWeeklyReport();
    const signal = { productIds: [crossProductId], groupIds: [crossGroupId] };

    const withSignal = new WeeklyReportService(
      createCrossGroupRepository(report, signal),
    );
    const withNull = new WeeklyReportService(
      createCrossGroupRepository(report, null),
    );

    const resultWith = await withSignal.getWeeklyReport(reportId, "lead");
    const resultNull = await withNull.getWeeklyReport(reportId, "lead");

    expect(resultWith.status).toBe("active");
    expect(resultNull.status).toBe("active");
    if (resultWith.status !== "active") throw new Error("expected active");
    if (resultNull.status !== "active") throw new Error("expected active");

    // Strip the crossGroup signal before comparing; the read model must be the same.
    const { crossGroup: _w, ...modelWith } = resultWith;
    const { crossGroup: _n, ...modelNull } = resultNull;
    expect(modelWith).toEqual(modelNull);
  });
});
