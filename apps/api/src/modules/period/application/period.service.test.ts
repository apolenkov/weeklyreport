import type {
  PeriodStatus,
  ReportStatus,
  UserSession,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  customreportPeriodStateTransitionsTotal,
  customreportReportsSubmittedTotal,
} from "../../../infrastructure/metrics/metrics.registry.js";
import { PeriodPrometheusTelemetry } from "../infrastructure/period-prometheus-telemetry.adapter.js";
import {
  type AnalyticsCacheInvalidator,
  PeriodAccessError,
  PeriodNotFoundError,
  type PeriodRepository,
  PeriodScopeError,
  PeriodService,
  type ReopenPolicyReader,
} from "./period.service";

const noopInvalidate: AnalyticsCacheInvalidator = () => Promise.resolve();
const noGatingReopenPolicy: ReopenPolicyReader = () =>
  Promise.resolve({ allowReopenAfterPublish: true, reopenWindowHours: 0 });

/* ------------------------------------------------------------------ */
/*  Fixed test UUIDs                                                   */
/* ------------------------------------------------------------------ */

const reportId = "22222222-2222-4222-8222-222222222222";
const otherReportId = "33333333-3333-4333-8333-333333333333";

const headSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "head@customreport.local",
  name: "Department Head",
  role: "head",
  activeReportId: reportId,
  activeReportSectionId: null,
};

const adminSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000009",
  email: "admin@customreport.local",
  name: "Administrator",
  role: "admin",
  activeReportId: null,
  activeReportSectionId: null,
};

const archivedReportId = "44444444-4444-4444-8444-444444444444";

/* ------------------------------------------------------------------ */
/*  Mock repository with spies                                         */
/* ------------------------------------------------------------------ */

interface SpyReport {
  id: string;
  status: ReportStatus;
  periodStatus: PeriodStatus;
  publishedAt: Date | null;
  /** Defaults to false in `getReportById` when a fixture omits it. */
  archived?: boolean;
}

function createSpyRepository(
  reports: Map<string, SpyReport>,
): PeriodRepository & {
  publishPeriod: ReturnType<typeof vi.fn>;
  reopenPeriod: ReturnType<typeof vi.fn>;
} {
  // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn wrapping an async stub; async required so the spy satisfies the PeriodRepository.publishPeriod typed slot (must return Promise<PublishPeriodOutcome>)
  const publishFn = vi.fn(async (id: string) => {
    const r = reports.get(id);
    // Mirror the guarded compare-and-set: only a not-yet-published,
    // non-archived row transitions. A zero-row match splits into "raced" (an
    // already-published row — idempotent no-op) vs "archived" (archived inside
    // the window — a domain error).
    if (!r || r.periodStatus === "published" || r.archived) {
      const reason: "raced" | "archived" =
        r?.periodStatus === "published" ? "raced" : "archived";
      return { transitioned: false as const, reason };
    }
    r.periodStatus = "published";
    r.publishedAt = new Date();
    return { transitioned: true as const };
  });

  // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn wrapping an async stub; async required so the spy satisfies the PeriodRepository.reopenPeriod typed slot (must return Promise<void>)
  const reopenFn = vi.fn(async (id: string) => {
    const r = reports.get(id);
    if (r) {
      r.periodStatus = "reopened";
    }
  });

  // Resolve the lifecycle targets from the LIVE map on every call (like the real
  // resolvers) so the publish→reopen→republish cycle stays self-consistent.
  const resolveFirstId = (match: (r: SpyReport) => boolean): string | null =>
    [...reports.values()].find(match)?.id ?? null;

  return {
    listSectionIds: () => Promise.resolve([]),
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PeriodRepository contract (no awaitable work in the stub)
    async getReportById(id: string) {
      const r = reports.get(id);
      return r
        ? { ...structuredClone(r), archived: r.archived ?? false }
        : null;
    },
    getCurrentEditableId: () =>
      Promise.resolve(
        resolveFirstId(
          (r) =>
            (r.periodStatus === "open" || r.periodStatus === "reopened") &&
            !r.archived,
        ),
      ),
    getLatestPublishedNonArchivedId: () =>
      Promise.resolve(
        resolveFirstId((r) => r.periodStatus === "published" && !r.archived),
      ),
    getReopenedNonArchivedId: () =>
      Promise.resolve(
        resolveFirstId((r) => r.periodStatus === "reopened" && !r.archived),
      ),
    publishPeriod: publishFn,
    reopenPeriod: reopenFn,
  };
}

/* ------------------------------------------------------------------ */
/*  publishPeriod — service-level unit tests                           */
/* ------------------------------------------------------------------ */

describe("PeriodService — publishPeriod (unit)", () => {
  it("calls repository.publishPeriod with correct args", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "draft",
          periodStatus: "open",
          publishedAt: null,
        },
      ],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await service.publishPeriod(reportId, headSession);

    expect(repo.publishPeriod).toHaveBeenCalledOnce();
    expect(repo.publishPeriod).toHaveBeenCalledWith(
      reportId,
      headSession.userId,
    );
  });

  it("returns the reportId in the success result", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "draft",
          periodStatus: "open",
          publishedAt: null,
        },
      ],
    ]);
    const service = new PeriodService(
      createSpyRepository(reports),
      noopInvalidate,
      noGatingReopenPolicy,
    );

    const result = await service.publishPeriod(reportId, headSession);

    expect(result.reportId).toBe(reportId);
    expect(result.success).toBe(true);
  });

  it("throws plain Error (not PeriodAccessError) when report is missing", async () => {
    const service = new PeriodService(
      createSpyRepository(new Map()),
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(service.publishPeriod(reportId, headSession)).rejects.toThrow(
      Error,
    );

    // Verify it's NOT a PeriodAccessError
    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.not.toBeInstanceOf(PeriodAccessError);
  });

  it("does not call repository when period is already published", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "published",
          periodStatus: "published",
          publishedAt: new Date(),
        },
      ],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.toThrow();
    expect(repo.publishPeriod).not.toHaveBeenCalled();
  });

  it("publish-then-reopen-then-publish cycle works", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "draft",
          periodStatus: "open",
          publishedAt: null,
        },
      ],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    // 1. Publish
    await service.publishPeriod(reportId, headSession);
    expect(repo.publishPeriod).toHaveBeenCalledOnce();

    // 2. Reopen
    await service.reopenPeriod(reportId, headSession);
    expect(repo.reopenPeriod).toHaveBeenCalledOnce();

    // 3. Re-publish (reopened -> published is allowed)
    await service.publishPeriod(reportId, headSession);
    expect(repo.publishPeriod).toHaveBeenCalledTimes(2);
  });

  it("invalidates analytics cache on successful publish", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "draft",
          periodStatus: "open",
          publishedAt: null,
        },
      ],
    ]);
    // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn wrapping an async stub; async required so the spy satisfies the AnalyticsCacheInvalidator typed slot (must return Promise<void>)
    const invalidate = vi.fn(async () => undefined);
    const service = new PeriodService(
      createSpyRepository(reports),
      invalidate,
      noGatingReopenPolicy,
    );

    await service.publishPeriod(reportId, headSession);

    expect(invalidate).toHaveBeenCalledOnce();
  });

  it("does NOT invalidate analytics cache when publish fails", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "published",
          periodStatus: "published",
          publishedAt: new Date(),
        },
      ],
    ]);
    // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn wrapping an async stub; async required so the spy satisfies the AnalyticsCacheInvalidator typed slot (must return Promise<void>)
    const invalidate = vi.fn(async () => undefined);
    const service = new PeriodService(
      createSpyRepository(reports),
      invalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.toThrow();

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("different reports are independent", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "draft",
          periodStatus: "open",
          publishedAt: null,
        },
      ],
      [
        otherReportId,
        {
          id: otherReportId,
          status: "published",
          periodStatus: "published",
          publishedAt: new Date(),
        },
      ],
    ]);
    const service = new PeriodService(
      createSpyRepository(reports),
      noopInvalidate,
      noGatingReopenPolicy,
    );

    // First report can be published
    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      {
        success: true,
        reportId,
      },
    );

    // Second is already published — should fail
    await expect(
      service.publishPeriod(otherReportId, headSession),
    ).rejects.toBeInstanceOf(PeriodAccessError);
  });
});

/* ------------------------------------------------------------------ */
/*  reopenPeriod — service-level unit tests                            */
/* ------------------------------------------------------------------ */

describe("PeriodService — reopenPeriod (unit)", () => {
  it("calls repository.reopenPeriod with correct reportId", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "published",
          periodStatus: "published",
          publishedAt: new Date(),
        },
      ],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await service.reopenPeriod(reportId, headSession);

    expect(repo.reopenPeriod).toHaveBeenCalledOnce();
    expect(repo.reopenPeriod).toHaveBeenCalledWith(reportId);
  });

  it("does not call repository when period is not published", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "draft",
          periodStatus: "open",
          publishedAt: null,
        },
      ],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(service.reopenPeriod(reportId, headSession)).rejects.toThrow();
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("invalidates analytics cache on successful reopen", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "published",
          periodStatus: "published",
          publishedAt: new Date(),
        },
      ],
    ]);
    // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn wrapping an async stub; async required so the spy satisfies the AnalyticsCacheInvalidator typed slot (must return Promise<void>)
    const invalidate = vi.fn(async () => undefined);
    const service = new PeriodService(
      createSpyRepository(reports),
      invalidate,
      noGatingReopenPolicy,
    );

    await service.reopenPeriod(reportId, headSession);

    expect(invalidate).toHaveBeenCalledOnce();
  });

  it("double reopen of a reopened period fails", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "published",
          periodStatus: "published",
          publishedAt: new Date(),
        },
      ],
    ]);
    const service = new PeriodService(
      createSpyRepository(reports),
      noopInvalidate,
      noGatingReopenPolicy,
    );

    // First reopen works
    await service.reopenPeriod(reportId, headSession);

    // Second reopen fails (now status is 'reopened', not 'published')
    await expect(
      service.reopenPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodAccessError);
  });
});

/* ------------------------------------------------------------------ */
/*  reopen-policy gate                                                 */
/* ------------------------------------------------------------------ */

describe("PeriodService — reopen policy gate", () => {
  it("throws PeriodAccessError when allowReopenAfterPublish=false", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "published",
          periodStatus: "published",
          publishedAt: new Date(),
        },
      ],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(
      repo,
      // eslint-disable-next-line @typescript-eslint/require-await -- async stub satisfies the AnalyticsCacheInvalidator typed slot (must return Promise<void>)
      async () => undefined,
      // eslint-disable-next-line @typescript-eslint/require-await -- async stub satisfies the ReopenPolicyReader typed slot (must return Promise<...>)
      async () => ({ allowReopenAfterPublish: false, reopenWindowHours: 72 }),
    );

    await expect(
      service.reopenPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodAccessError);
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("throws PeriodAccessError when reopen window has expired", async () => {
    const publishedAt = new Date(Date.now() - 100 * 3_600_000); // 100h ago
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "published",
          periodStatus: "published",
          publishedAt,
        },
      ],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(
      repo,
      // eslint-disable-next-line @typescript-eslint/require-await -- async stub satisfies the AnalyticsCacheInvalidator typed slot (must return Promise<void>)
      async () => undefined,
      // eslint-disable-next-line @typescript-eslint/require-await -- async stub satisfies the ReopenPolicyReader typed slot (must return Promise<...>)
      async () => ({ allowReopenAfterPublish: true, reopenWindowHours: 72 }),
    );

    await expect(
      service.reopenPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodAccessError);
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("allows reopen within the window", async () => {
    const publishedAt = new Date(Date.now() - 2 * 3_600_000); // 2h ago
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "published",
          periodStatus: "published",
          publishedAt,
        },
      ],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(
      repo,
      // eslint-disable-next-line @typescript-eslint/require-await -- async stub satisfies the AnalyticsCacheInvalidator typed slot (must return Promise<void>)
      async () => undefined,
      // eslint-disable-next-line @typescript-eslint/require-await -- async stub satisfies the ReopenPolicyReader typed slot (must return Promise<...>)
      async () => ({ allowReopenAfterPublish: true, reopenWindowHours: 72 }),
    );

    await service.reopenPeriod(reportId, headSession);
    expect(repo.reopenPeriod).toHaveBeenCalledOnce();
  });

  it("a permissive policy (allow + zero window) permits reopen", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "published",
          periodStatus: "published",
          publishedAt: new Date(0),
        },
      ],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await service.reopenPeriod(reportId, headSession);
    expect(repo.reopenPeriod).toHaveBeenCalledOnce();
  });
});

/* ------------------------------------------------------------------ */
/*  Manual-publish telemetry (remove-dead-modules spec)               */
/* ------------------------------------------------------------------ */

/**
 * Mirror of the same helper in publication.service.test.ts — introspects
 * a prom-client Counter without leaking registry internals into assertions.
 */
async function getCounterValue(
  counter: {
    get(): Promise<{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prom-client label record
      values: { value: number; labels: Record<string, any> }[];
    }>;
  },
  labels: Record<string, string>,
): Promise<number> {
  const snapshot = await counter.get();
  const match = snapshot.values.find((entry) =>
    Object.entries(labels).every(([k, v]) => String(entry.labels[k]) === v),
  );
  return match?.value ?? 0;
}

describe("PeriodService — manual-publish telemetry", () => {
  it("increments reportsSubmittedTotal once on successful publish of an open period", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "draft",
          periodStatus: "open",
          publishedAt: null,
        },
      ],
    ]);
    const service = new PeriodService(
      createSpyRepository(reports),
      noopInvalidate,
      noGatingReopenPolicy,
      undefined,
      new PeriodPrometheusTelemetry(),
    );
    const before = await getCounterValue(customreportReportsSubmittedTotal, {
      state: "published",
    });

    await service.publishPeriod(reportId, headSession);

    expect(
      await getCounterValue(customreportReportsSubmittedTotal, {
        state: "published",
      }),
    ).toBe(before + 1);
  });

  it("increments periodStateTransitionsTotal with from:open on successful publish", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "draft",
          periodStatus: "open",
          publishedAt: null,
        },
      ],
    ]);
    const service = new PeriodService(
      createSpyRepository(reports),
      noopInvalidate,
      noGatingReopenPolicy,
      undefined,
      new PeriodPrometheusTelemetry(),
    );
    const before = await getCounterValue(
      customreportPeriodStateTransitionsTotal,
      { from: "open", to: "published" },
    );

    await service.publishPeriod(reportId, headSession);

    expect(
      await getCounterValue(customreportPeriodStateTransitionsTotal, {
        from: "open",
        to: "published",
      }),
    ).toBe(before + 1);
  });

  it("increments periodStateTransitionsTotal with from:reopened when re-publishing a reopened period", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "draft",
          periodStatus: "reopened",
          publishedAt: null,
        },
      ],
    ]);
    const service = new PeriodService(
      createSpyRepository(reports),
      noopInvalidate,
      noGatingReopenPolicy,
      undefined,
      new PeriodPrometheusTelemetry(),
    );
    const before = await getCounterValue(
      customreportPeriodStateTransitionsTotal,
      { from: "reopened", to: "published" },
    );

    await service.publishPeriod(reportId, headSession);

    expect(
      await getCounterValue(customreportPeriodStateTransitionsTotal, {
        from: "reopened",
        to: "published",
      }),
    ).toBe(before + 1);
  });

  it("increments NO counters when repository.publishPeriod throws", async () => {
    const repo: PeriodRepository & {
      publishPeriod: ReturnType<typeof vi.fn>;
    } = {
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PeriodRepository contract
      async getReportById(id: string) {
        if (id === reportId) {
          return {
            id: reportId,
            status: "draft",
            periodStatus: "open",
            publishedAt: null,
            archived: false,
          };
        }
        return null;
      },
      getCurrentEditableId: () => Promise.resolve(reportId),
      getLatestPublishedNonArchivedId: () => Promise.resolve(null),
      getReopenedNonArchivedId: () => Promise.resolve(null),
      // eslint-disable-next-line @typescript-eslint/require-await -- async stub satisfies the PeriodRepository typed slot; throw is synchronous
      publishPeriod: vi.fn(async () => {
        throw new Error("DB write failed");
      }),
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PeriodRepository contract
      reopenPeriod: vi.fn(async () => undefined),
      listSectionIds: () => Promise.resolve([]),
    };
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    const submittedBefore = await getCounterValue(
      customreportReportsSubmittedTotal,
      { state: "published" },
    );
    const transitionsBefore = await getCounterValue(
      customreportPeriodStateTransitionsTotal,
      { from: "open", to: "published" },
    );

    await expect(service.publishPeriod(reportId, headSession)).rejects.toThrow(
      "DB write failed",
    );

    expect(
      await getCounterValue(customreportReportsSubmittedTotal, {
        state: "published",
      }),
    ).toBe(submittedBefore);
    expect(
      await getCounterValue(customreportPeriodStateTransitionsTotal, {
        from: "open",
        to: "published",
      }),
    ).toBe(transitionsBefore);
  });

  it("emits no counters and runs no ingestion when the compare-and-set did not transition", async () => {
    // A concurrent publish already transitioned the period: getReportById still
    // reads "open" (it raced ahead of the winner's commit), the service clears
    // its fast-path, but the guarded write reports transitioned:false.
    const ingestion = vi.fn(() => Promise.resolve());
    const repo: PeriodRepository = {
      getReportById: () =>
        Promise.resolve({
          id: reportId,
          status: "draft",
          periodStatus: "open",
          publishedAt: null,
          archived: false,
        }),
      getCurrentEditableId: () => Promise.resolve(reportId),
      getLatestPublishedNonArchivedId: () => Promise.resolve(null),
      getReopenedNonArchivedId: () => Promise.resolve(null),
      publishPeriod: () =>
        Promise.resolve({ transitioned: false, reason: "raced" }),
      reopenPeriod: () => Promise.resolve(),
      listSectionIds: () => Promise.resolve(["s1"]),
    };
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
      ingestion,
    );

    const submittedBefore = await getCounterValue(
      customreportReportsSubmittedTotal,
      { state: "published" },
    );
    const transitionsBefore = await getCounterValue(
      customreportPeriodStateTransitionsTotal,
      { from: "open", to: "published" },
    );

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      { success: true, reportId },
    );

    expect(ingestion).not.toHaveBeenCalled();
    expect(
      await getCounterValue(customreportReportsSubmittedTotal, {
        state: "published",
      }),
    ).toBe(submittedBefore);
    expect(
      await getCounterValue(customreportPeriodStateTransitionsTotal, {
        from: "open",
        to: "published",
      }),
    ).toBe(transitionsBefore);
  });
});

/* ------------------------------------------------------------------ */
/*  Lifecycle target scope authorization (period-lifecycle-authz)     */
/* ------------------------------------------------------------------ */

function openReport(id: string, archived = false): SpyReport {
  return {
    id,
    status: "draft",
    periodStatus: "open",
    publishedAt: null,
    archived,
  };
}

function publishedReport(id: string, archived = false): SpyReport {
  return {
    id,
    status: "published",
    periodStatus: "published",
    publishedAt: new Date(),
    archived,
  };
}

// A reopened period keeps the legacy tuple (status='published') but flips
// periodStatus to 'reopened' — the marker the single-active-reopen guard reads.
function reopenedReport(id: string, archived = false): SpyReport {
  return {
    id,
    status: "published",
    periodStatus: "reopened",
    publishedAt: new Date(),
    archived,
  };
}

describe("PeriodService — publish target scope", () => {
  it("head publishes the active editable period", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([[reportId, openReport(reportId)]]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      {
        success: true,
        reportId,
      },
    );
    expect(repo.publishPeriod).toHaveBeenCalledWith(
      reportId,
      headSession.userId,
    );
  });

  it("rejects a head publishing a stale/foreign editable id (not the active period)", async () => {
    // reportId is the resolved active editable id (inserted first); otherReportId
    // is an older editable period the head must not be able to target.
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [reportId, openReport(reportId)],
        [otherReportId, openReport(otherReportId)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(otherReportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    expect(repo.publishPeriod).not.toHaveBeenCalled();
  });

  it("lets an admin publish an arbitrary non-archived editable id", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [reportId, openReport(reportId)],
        [otherReportId, openReport(otherReportId)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    // reportId is the resolved active id; an admin still publishes the OTHER one.
    await expect(
      service.publishPeriod(otherReportId, adminSession),
    ).resolves.toEqual({ success: true, reportId: otherReportId });
    expect(repo.publishPeriod).toHaveBeenCalledWith(
      otherReportId,
      adminSession.userId,
    );
  });

  it("rejects an archived target for a head", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [archivedReportId, openReport(archivedReportId, true)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(archivedReportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    expect(repo.publishPeriod).not.toHaveBeenCalled();
  });

  it("rejects an archived target for an admin", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [archivedReportId, openReport(archivedReportId, true)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(archivedReportId, adminSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    expect(repo.publishPeriod).not.toHaveBeenCalled();
  });

  it("maps a missing report to PeriodNotFoundError, not a bare Error", async () => {
    const service = new PeriodService(
      createSpyRepository(new Map()),
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodNotFoundError);
  });

  it("rejects a head publish when no active editable period exists (no write, no telemetry)", async () => {
    // Fail-closed: the target clears the not-found/archived/already-published
    // gates but the server resolves NO active editable period (e.g. a future
    // scheduled target excluded by periodStart<=now). The mock decouples
    // getReportById from the resolver to model that state directly.
    const target = openReport(reportId);
    const publishPeriod = vi.fn(() =>
      Promise.resolve({ transitioned: true as const }),
    );
    const repo: PeriodRepository = {
      getReportById: () => Promise.resolve({ ...target, archived: false }),
      getCurrentEditableId: () => Promise.resolve(null),
      getLatestPublishedNonArchivedId: () => Promise.resolve(null),
      getReopenedNonArchivedId: () => Promise.resolve(null),
      publishPeriod,
      reopenPeriod: vi.fn(() => Promise.resolve()),
      listSectionIds: () => Promise.resolve([]),
    };
    const before = await getCounterValue(customreportReportsSubmittedTotal, {
      state: "published",
    });
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    expect(publishPeriod).not.toHaveBeenCalled();
    expect(
      await getCounterValue(customreportReportsSubmittedTotal, {
        state: "published",
      }),
    ).toBe(before);
  });
});

describe("PeriodService — reopen target scope", () => {
  it("head reopens the latest published non-archived period", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([[reportId, publishedReport(reportId)]]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(service.reopenPeriod(reportId, headSession)).resolves.toEqual({
      success: true,
      reportId,
    });
    expect(repo.reopenPeriod).toHaveBeenCalledWith(reportId);
  });

  it("rejects a head reopening a stale published id (not the latest)", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [reportId, publishedReport(reportId)],
        [otherReportId, publishedReport(otherReportId)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    // reportId is the resolved latest published id; otherReportId is stale.
    await expect(
      service.reopenPeriod(otherReportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("lets an admin reopen an arbitrary non-archived published id", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [reportId, publishedReport(reportId)],
        [otherReportId, publishedReport(otherReportId)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.reopenPeriod(otherReportId, adminSession),
    ).resolves.toEqual({ success: true, reportId: otherReportId });
    expect(repo.reopenPeriod).toHaveBeenCalledWith(otherReportId);
  });

  it("rejects an archived published target for a head", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [archivedReportId, publishedReport(archivedReportId, true)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.reopenPeriod(archivedReportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("rejects an archived published target for an admin", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [archivedReportId, publishedReport(archivedReportId, true)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.reopenPeriod(archivedReportId, adminSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("resolves the latest published NON-archived id when the newest published row is archived", async () => {
    // The newest published row (reportId) is archived; an older published row
    // (otherReportId) is non-archived. The reopen resolver must skip the
    // archived newest and return the older non-archived id, and a head reopening
    // THAT id succeeds — proving the resolver diverges from getLatestPublishedId
    // and the archived guard does not block the older non-archived period.
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [reportId, publishedReport(reportId, true)],
        [otherReportId, publishedReport(otherReportId, false)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.reopenPeriod(otherReportId, headSession),
    ).resolves.toEqual({ success: true, reportId: otherReportId });
    expect(repo.reopenPeriod).toHaveBeenCalledWith(otherReportId);

    // The archived newest is itself rejected by the archived guard.
    await expect(
      service.reopenPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
  });

  it("maps a missing report to PeriodNotFoundError", async () => {
    const service = new PeriodService(
      createSpyRepository(new Map()),
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.reopenPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodNotFoundError);
  });

  it("rejects a head reopen when no latest published target exists (no write, no cache invalidation)", async () => {
    // Fail-closed: the target clears the not-found/archived/published gates but
    // the server resolves NO latest published non-archived target. Decoupled mock.
    const target = publishedReport(reportId);
    const reopenPeriod = vi.fn(() => Promise.resolve());
    const invalidate = vi.fn(() => Promise.resolve(undefined));
    const repo: PeriodRepository = {
      getReportById: () => Promise.resolve({ ...target, archived: false }),
      getCurrentEditableId: () => Promise.resolve(null),
      getLatestPublishedNonArchivedId: () => Promise.resolve(null),
      getReopenedNonArchivedId: () => Promise.resolve(null),
      publishPeriod: vi.fn(() =>
        Promise.resolve({ transitioned: true as const }),
      ),
      reopenPeriod,
      listSectionIds: () => Promise.resolve([]),
    };
    const service = new PeriodService(repo, invalidate, noGatingReopenPolicy);

    await expect(
      service.reopenPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    expect(reopenPeriod).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("PeriodService — reopen → republish & single-active-reopen guard", () => {
  it("lets a head republish a reopened period even when a newer open period is the current editable", async () => {
    // Steady state: week N (reportId) is published; week N+1 (otherReportId) is
    // open and — inserted first — is what getCurrentEditableId resolves. A head
    // reopens N and must be able to republish it; a strict equality check against
    // the current editable (N+1) would brick this legitimate reopen→republish flow.
    const reports = new Map<string, SpyReport>([
      [otherReportId, openReport(otherReportId)],
      [reportId, publishedReport(reportId)],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await service.reopenPeriod(reportId, headSession);
    expect(repo.reopenPeriod).toHaveBeenCalledWith(reportId);

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      {
        success: true,
        reportId,
      },
    );
    expect(repo.publishPeriod).toHaveBeenCalledWith(
      reportId,
      headSession.userId,
    );
  });

  it("rejects a head reopening a second period while another is already reopened (walk-back guard)", async () => {
    // otherReportId is already reopened; reportId is the latest published
    // non-archived target. Allowing this reopen would let a head walk back
    // through history and republish each older period — forbidden for a non-admin.
    const reports = new Map<string, SpyReport>([
      [otherReportId, reopenedReport(otherReportId)],
      [reportId, publishedReport(reportId)],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.reopenPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("lets an admin reopen a second period while another is reopened (recovery path)", async () => {
    const reports = new Map<string, SpyReport>([
      [otherReportId, reopenedReport(otherReportId)],
      [reportId, publishedReport(reportId)],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(service.reopenPeriod(reportId, adminSession)).resolves.toEqual(
      { success: true, reportId },
    );
    expect(repo.reopenPeriod).toHaveBeenCalledWith(reportId);
  });
});

/* ------------------------------------------------------------------ */
/*  Reopened publish-target scope (close the reopened bypass, D3)      */
/* ------------------------------------------------------------------ */

describe("PeriodService — publish reopened-target scope", () => {
  it("lets a head publish the single active reopened period (its own)", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([[reportId, reopenedReport(reportId)]]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      { success: true, reportId },
    );
    expect(repo.publishPeriod).toHaveBeenCalledWith(
      reportId,
      headSession.userId,
    );
  });

  it("rejects a head publishing a reopened target that is not the single active reopened period", async () => {
    // reportId (inserted first) is the single active reopened period
    // getReopenedNonArchivedId resolves; otherReportId is a SECOND reopened row
    // — only reachable via an admin reopen of a historical period. A head must
    // not be able to publish it (the closed bypass).
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [reportId, reopenedReport(reportId)],
        [otherReportId, reopenedReport(otherReportId)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(otherReportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    expect(repo.publishPeriod).not.toHaveBeenCalled();
  });

  it("lets an admin publish any reopened target (reopen→fix→republish preserved)", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [reportId, reopenedReport(reportId)],
        [otherReportId, reopenedReport(otherReportId)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(otherReportId, adminSession),
    ).resolves.toEqual({ success: true, reportId: otherReportId });
    expect(repo.publishPeriod).toHaveBeenCalledWith(
      otherReportId,
      adminSession.userId,
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Archive landing inside the publish read→write window (D2)          */
/* ------------------------------------------------------------------ */

describe("PeriodService — archive-in-window publish outcome", () => {
  // The pre-write read sees a non-archived open period (it raced ahead of the
  // archive's commit), so the service clears its archived gate and calls the
  // repo; the guarded compare-and-set then reports the archive that landed in
  // the window. The mock returns the repo outcome directly to model that state.
  function repoWithOutcome(
    publish: ReturnType<typeof vi.fn>,
  ): PeriodRepository {
    return {
      getReportById: () =>
        Promise.resolve({
          id: reportId,
          status: "draft",
          periodStatus: "open",
          publishedAt: null,
          archived: false,
        }),
      getCurrentEditableId: () => Promise.resolve(reportId),
      getLatestPublishedNonArchivedId: () => Promise.resolve(null),
      getReopenedNonArchivedId: () => Promise.resolve(null),
      publishPeriod: publish as PeriodRepository["publishPeriod"],
      reopenPeriod: () => Promise.resolve(),
      listSectionIds: () => Promise.resolve(["s1"]),
    };
  }

  it("throws PeriodScopeError and emits no telemetry when the period was archived in the window", async () => {
    const ingestion = vi.fn(() => Promise.resolve());
    const publish = vi.fn(() =>
      Promise.resolve({ transitioned: false as const, reason: "archived" }),
    );
    const service = new PeriodService(
      repoWithOutcome(publish),
      noopInvalidate,
      noGatingReopenPolicy,
      ingestion,
    );

    const before = await getCounterValue(customreportReportsSubmittedTotal, {
      state: "published",
    });

    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);

    expect(ingestion).not.toHaveBeenCalled();
    expect(
      await getCounterValue(customreportReportsSubmittedTotal, {
        state: "published",
      }),
    ).toBe(before);
  });

  it("returns idempotent success with no side-effects when a concurrent publish won (raced)", async () => {
    const ingestion = vi.fn(() => Promise.resolve());
    const publish = vi.fn(() =>
      Promise.resolve({ transitioned: false as const, reason: "raced" }),
    );
    const service = new PeriodService(
      repoWithOutcome(publish),
      noopInvalidate,
      noGatingReopenPolicy,
      ingestion,
    );

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      { success: true, reportId },
    );
    expect(ingestion).not.toHaveBeenCalled();
  });
});
