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
        version: 1,
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
  currentEditableId: string | null = null,
  latestPublishedId: string | null = null,
  latestPublishedNonArchivedId: string | null = null,
): WeeklyReportRepository & {
  getWeeklyReport: ReturnType<typeof vi.fn>;
  getActiveReportId: ReturnType<typeof vi.fn>;
  getCurrentEditableId: ReturnType<typeof vi.fn>;
  getLatestPublishedId: ReturnType<typeof vi.fn>;
  getLatestPublishedNonArchivedId: ReturnType<typeof vi.fn>;
} {
  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async WeeklyReportRepository contract (no awaitable work in the stub)
    getWeeklyReport: vi.fn(async (id: string) => {
      const model = reports.get(id);
      return model ? makeRepoResult(structuredClone(model)) : null;
    }),
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async WeeklyReportRepository contract (no awaitable work in the stub)
    getActiveReportId: vi.fn(async () => activeId),
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async WeeklyReportRepository contract (no awaitable work in the stub)
    getCurrentEditableId: vi.fn(async () => currentEditableId),
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async WeeklyReportRepository contract (no awaitable work in the stub)
    getLatestPublishedId: vi.fn(async () => latestPublishedId),
    getLatestPublishedNonArchivedId: vi.fn(() =>
      Promise.resolve(latestPublishedNonArchivedId),
    ),
    getCompiledHistory: vi.fn(() =>
      Promise.resolve({ reports: [], archiveCount: 0 }),
    ),
    getVisibleReportId: vi.fn(() => Promise.resolve(null)),
    getLatestPublishedVisibleId: vi.fn(() => Promise.resolve(null)),
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
/*  viewer scoping                                                     */
/* ------------------------------------------------------------------ */

describe("WeeklyReportService — viewer-live-status published-or-current gate (task 2.3)", () => {
  // viewer + current open draft → visible
  it("viewer reads the CURRENT open period (drafts included)", async () => {
    const open = makeWeeklyReport({ periodStatus: "open" });
    const reports = new Map([[reportId, open]]);
    // currentEditableId === the fetched id → the gate admits it
    const service = new WeeklyReportService(
      createSpyRepository(reports, null, reportId),
    );

    const result = await service.getWeeklyReport(reportId, "viewer");

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.periodStatus).toBe("open");
    expect(result.reportId).toBe(reportId);
  });

  // viewer + submitted section in the current open period → visible
  it("viewer reads a submitted section in the current open period", async () => {
    const open = makeWeeklyReport({ periodStatus: "open" });
    // makeWeeklyReport's lead section defaults to status "submitted"
    expect(open.leadSections[0]?.status).toBe("submitted");
    const reports = new Map([[reportId, open]]);
    const service = new WeeklyReportService(
      createSpyRepository(reports, null, reportId),
    );

    const result = await service.getWeeklyReport(reportId, "viewer");

    expect(result.status).toBe("active");
  });

  // viewer + current reopened → live content (Decision 4: no snapshot-sticky)
  it("viewer reads the CURRENT reopened period live", async () => {
    const reopened = makeWeeklyReport({ periodStatus: "reopened" });
    const reports = new Map([[reportId, reopened]]);
    const service = new WeeklyReportService(
      createSpyRepository(reports, null, reportId),
    );

    const result = await service.getWeeklyReport(reportId, "viewer");

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.periodStatus).toBe("reopened");
  });

  // viewer + explicit NON-current open id → rejected. This test is also the
  // mutation sentinel for the gate's id check: drop `resolvedId !==
  // currentEditableId` and a non-current/future/stale period would leak.
  it("viewer is REJECTED on a non-current open period (id check teeth)", async () => {
    const open = makeWeeklyReport({ periodStatus: "open" });
    const reports = new Map([[reportId, open]]);
    // the current editable period is a DIFFERENT id
    const service = new WeeklyReportService(
      createSpyRepository(reports, null, activeReportId),
    );

    await expect(
      service.getWeeklyReport(reportId, "viewer"),
    ).rejects.toBeInstanceOf(WeeklyReportDomainError);
  });

  // viewer + archived-open id → rejected (the helper excludes archived, so it
  // is never the current editable id → null here)
  it("viewer is REJECTED on an archived-open period", async () => {
    const archivedOpen = makeWeeklyReport({ periodStatus: "open" });
    const reports = new Map([[reportId, archivedOpen]]);
    const service = new WeeklyReportService(
      createSpyRepository(reports, null, null),
    );

    await expect(
      service.getWeeklyReport(reportId, "viewer"),
    ).rejects.toBeInstanceOf(WeeklyReportDomainError);
  });

  // viewer + scheduled-future open id → rejected (a future period is excluded
  // from currentEditableId by the periodStart<=now filter → not current)
  it("viewer is REJECTED on a scheduled-future open period", async () => {
    const future = makeWeeklyReport({ periodStatus: "open" });
    const reports = new Map([[reportId, future]]);
    const service = new WeeklyReportService(
      createSpyRepository(reports, null, null),
    );

    await expect(
      service.getWeeklyReport(reportId, "viewer"),
    ).rejects.toBeInstanceOf(WeeklyReportDomainError);
  });

  // viewer + past published id → snapshot (published is always readable)
  it("viewer reads a past published period", async () => {
    const published = makeWeeklyReport({ periodStatus: "published" });
    const reports = new Map([[reportId, published]]);
    // no current editable period at all
    const service = new WeeklyReportService(
      createSpyRepository(reports, null, null),
    );

    const result = await service.getWeeklyReport(reportId, "viewer");

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.periodStatus).toBe("published");
    expect(result.reportId).toBe(reportId);
  });

  // viewer + open→published race → rejected on the stale-open fetch, then the
  // published snapshot on re-fetch (Decision 1 fail-closed ordering)
  it("viewer race open→published is rejected, then reads the snapshot on re-fetch", async () => {
    const open = makeWeeklyReport({ periodStatus: "open" });
    const published = makeWeeklyReport({ periodStatus: "published" });
    // the period was published mid-request, so there is no current editable id
    const repo = createSpyRepository(new Map(), null, null);
    repo.getWeeklyReport
      .mockResolvedValueOnce(makeRepoResult(open)) // stale-open read
      .mockResolvedValueOnce(makeRepoResult(published)); // after the flip
    const service = new WeeklyReportService(repo);

    await expect(
      service.getWeeklyReport(reportId, "viewer"),
    ).rejects.toBeInstanceOf(WeeklyReportDomainError);

    const recovered = await service.getWeeklyReport(reportId, "viewer");
    expect(recovered.status).toBe("active");
    if (recovered.status !== "active") throw new Error("expected active");
    expect(recovered.periodStatus).toBe("published");
  });

  // viewer + no group access → empty content (zero-row scope), no leak. The gate
  // admits the period; the empty section scope yields no content.
  it("viewer with no access reads an empty current period (no leak)", async () => {
    const emptyOpen = makeWeeklyReport({
      periodStatus: "open",
      leadSections: [],
      portfolioOverview: [],
      escalations: [],
    });
    const reports = new Map([[reportId, emptyOpen]]);
    const service = new WeeklyReportService(
      createSpyRepository(reports, null, reportId),
    );

    const result = await service.getWeeklyReport(reportId, "viewer");

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.leadSections).toHaveLength(0);
  });

  // viewer + NO reportId: the default MUST resolve via the SAME source as the
  // gate (getCurrentEditableId), never getActiveReportId — otherwise a tie or an
  // archived-open period would make the resolved default a period the gate then
  // 404s. This is the teeth: getActiveReportId returns a DIFFERENT (stale) id;
  // if the code used it, the gate would reject and the call would 404.
  it("viewer no-reportId resolves via the current editable id, not getActiveReportId", async () => {
    const current = makeWeeklyReport({ reportId, periodStatus: "open" });
    const stale = makeWeeklyReport({
      reportId: activeReportId,
      periodStatus: "open",
    });
    const reports = new Map([
      [reportId, current],
      [activeReportId, stale],
    ]);
    const service = new WeeklyReportService(
      // getActiveReportId → activeReportId (stale); getCurrentEditableId → reportId
      createSpyRepository(reports, activeReportId, reportId),
    );

    const result = await service.getWeeklyReport(undefined, "viewer");

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.reportId).toBe(reportId);
  });

  // viewer + NO reportId + no current editable period → falls back to the newest
  // published (a gate-accepted period), NOT getActiveReportId's editable query.
  it("viewer no-reportId falls back to the latest published when no current editable", async () => {
    const published = makeWeeklyReport({ periodStatus: "published" });
    const reports = new Map([[reportId, published]]);
    const service = new WeeklyReportService(
      // no current editable; latest published → reportId
      createSpyRepository(reports, null, null, reportId),
    );

    const result = await service.getWeeklyReport(undefined, "viewer");

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.periodStatus).toBe("published");
    expect(result.reportId).toBe(reportId);
  });

  // viewer + NO reportId + nothing to show → no-period sentinel (never a 404).
  it("viewer no-reportId with neither current nor published returns no-period", async () => {
    const service = new WeeklyReportService(
      createSpyRepository(new Map(), null, null, null),
    );

    const result = await service.getWeeklyReport(undefined, "viewer");

    expect(result.status).toBe("no-period");
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

  it("undefined role keeps legacy contract (no scoping; preserves callers predating role-based scoping)", async () => {
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
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async WeeklyReportRepository contract
    async getCurrentEditableId() {
      return null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async WeeklyReportRepository contract
    async getLatestPublishedId() {
      return null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async WeeklyReportRepository contract
    async getLatestPublishedNonArchivedId() {
      return null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async WeeklyReportRepository contract
    async getCompiledHistory() {
      return { reports: [], archiveCount: 0 };
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async WeeklyReportRepository contract
    async getVisibleReportId() {
      return null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async WeeklyReportRepository contract
    async getLatestPublishedVisibleId() {
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

/* ------------------------------------------------------------------ */
/*  Head default convergence onto the lifecycle resolvers (task 4.5)   */
/* ------------------------------------------------------------------ */

describe("WeeklyReportService — head default resolution", () => {
  const olderPublishedId = "66666666-6666-4666-8666-666666666666";

  it("resolves the head default via getCurrentEditableId, not getActiveReportId", async () => {
    const report = makeWeeklyReport({ reportId });
    const reports = new Map([[reportId, report]]);
    // getActiveReportId points elsewhere; the head default MUST track the
    // lifecycle resolver so its reportId equals the publish authz target.
    const repo = createSpyRepository(
      reports,
      activeReportId,
      reportId,
      null,
      null,
    );
    const service = new WeeklyReportService(repo);

    await service.getWeeklyReport(undefined, "head");

    expect(repo.getCurrentEditableId).toHaveBeenCalledOnce();
    expect(repo.getActiveReportId).not.toHaveBeenCalled();
    expect(repo.getWeeklyReport).toHaveBeenCalledWith(reportId, undefined);
  });

  it("falls back to getLatestPublishedNonArchivedId (skipping an archived newest published) when no current editable period", async () => {
    const report = makeWeeklyReport({ reportId: olderPublishedId });
    const reports = new Map([[olderPublishedId, report]]);
    // No current editable; the newest published is archived, so the head
    // default lands on the older NON-archived published id — the same target
    // period.reopen authz resolves. The archived-inclusive getLatestPublishedId
    // (viewer fallback) must NOT be used for a head.
    const repo = createSpyRepository(
      reports,
      activeReportId,
      null,
      null,
      olderPublishedId,
    );
    const service = new WeeklyReportService(repo);

    await service.getWeeklyReport(undefined, "head");

    expect(repo.getCurrentEditableId).toHaveBeenCalledOnce();
    expect(repo.getLatestPublishedNonArchivedId).toHaveBeenCalledOnce();
    expect(repo.getLatestPublishedId).not.toHaveBeenCalled();
    expect(repo.getActiveReportId).not.toHaveBeenCalled();
    expect(repo.getWeeklyReport).toHaveBeenCalledWith(
      olderPublishedId,
      undefined,
    );
  });

  it("keeps the lead default on getActiveReportId (unchanged)", async () => {
    const report = makeWeeklyReport({ reportId: activeReportId });
    const reports = new Map([[activeReportId, report]]);
    const repo = createSpyRepository(reports, activeReportId, null, null, null);
    const service = new WeeklyReportService(repo);

    await service.getWeeklyReport(undefined, "lead");

    expect(repo.getActiveReportId).toHaveBeenCalledOnce();
    expect(repo.getCurrentEditableId).not.toHaveBeenCalled();
    expect(repo.getLatestPublishedNonArchivedId).not.toHaveBeenCalled();
    expect(repo.getWeeklyReport).toHaveBeenCalledWith(
      activeReportId,
      undefined,
    );
  });
});
