import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  customreportPeriodStateTransitionsTotal,
  customreportReportsSubmittedTotal,
} from "../../infrastructure/metrics/metrics.registry.js";
import {
  PeriodAccessError,
  type PeriodRepository,
  PeriodService,
} from "./period.service";

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

/* ------------------------------------------------------------------ */
/*  Mock repository with spies                                         */
/* ------------------------------------------------------------------ */

function createSpyRepository(
  reports: Map<
    string,
    {
      id: string;
      status: string;
      periodStatus: string;
      publishedAt: Date | null;
    }
  >,
): PeriodRepository & {
  publishPeriod: ReturnType<typeof vi.fn>;
  reopenPeriod: ReturnType<typeof vi.fn>;
} {
  // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn wrapping an async stub; async required so the spy satisfies the PeriodRepository.publishPeriod typed slot (must return Promise<void>)
  const publishFn = vi.fn(async (id: string) => {
    const r = reports.get(id);
    if (r) {
      r.periodStatus = "published";
      r.publishedAt = new Date();
    }
  });

  // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn wrapping an async stub; async required so the spy satisfies the PeriodRepository.reopenPeriod typed slot (must return Promise<void>)
  const reopenFn = vi.fn(async (id: string) => {
    const r = reports.get(id);
    if (r) {
      r.periodStatus = "reopened";
    }
  });

  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PeriodRepository contract (no awaitable work in the stub)
    async getReportById(id: string) {
      const r = reports.get(id);
      return r ? structuredClone(r) : null;
    },
    publishPeriod: publishFn,
    reopenPeriod: reopenFn,
  };
}

/* ------------------------------------------------------------------ */
/*  publishPeriod — service-level unit tests                           */
/* ------------------------------------------------------------------ */

describe("PeriodService — publishPeriod (unit)", () => {
  it("calls repository.publishPeriod with correct args", async () => {
    const reports = new Map([
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
    const service = new PeriodService(repo);

    await service.publishPeriod(reportId, headSession);

    expect(repo.publishPeriod).toHaveBeenCalledOnce();
    expect(repo.publishPeriod).toHaveBeenCalledWith(
      reportId,
      headSession.userId,
    );
  });

  it("returns the reportId in the success result", async () => {
    const reports = new Map([
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
    const service = new PeriodService(createSpyRepository(reports));

    const result = await service.publishPeriod(reportId, headSession);

    expect(result.reportId).toBe(reportId);
    expect(result.success).toBe(true);
  });

  it("throws plain Error (not PeriodAccessError) when report is missing", async () => {
    const service = new PeriodService(createSpyRepository(new Map()));

    await expect(service.publishPeriod(reportId, headSession)).rejects.toThrow(
      Error,
    );

    // Verify it's NOT a PeriodAccessError
    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.not.toBeInstanceOf(PeriodAccessError);
  });

  it("does not call repository when period is already published", async () => {
    const reports = new Map([
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
    const service = new PeriodService(repo);

    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.toThrow();
    expect(repo.publishPeriod).not.toHaveBeenCalled();
  });

  it("publish-then-reopen-then-publish cycle works", async () => {
    const reports = new Map([
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
    const service = new PeriodService(repo);

    // 1. Publish
    await service.publishPeriod(reportId, headSession);
    expect(repo.publishPeriod).toHaveBeenCalledOnce();

    // 2. Reopen
    await service.reopenPeriod(reportId);
    expect(repo.reopenPeriod).toHaveBeenCalledOnce();

    // 3. Re-publish (reopened -> published is allowed)
    await service.publishPeriod(reportId, headSession);
    expect(repo.publishPeriod).toHaveBeenCalledTimes(2);
  });

  it("invalidates analytics cache on successful publish (ANAL-01)", async () => {
    const reports = new Map([
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
    const service = new PeriodService(createSpyRepository(reports), invalidate);

    await service.publishPeriod(reportId, headSession);

    expect(invalidate).toHaveBeenCalledOnce();
  });

  it("does NOT invalidate analytics cache when publish fails", async () => {
    const reports = new Map([
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
    const service = new PeriodService(createSpyRepository(reports), invalidate);

    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.toThrow();

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("different reports are independent", async () => {
    const reports = new Map([
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
    const service = new PeriodService(createSpyRepository(reports));

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
    const reports = new Map([
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
    const service = new PeriodService(repo);

    await service.reopenPeriod(reportId);

    expect(repo.reopenPeriod).toHaveBeenCalledOnce();
    expect(repo.reopenPeriod).toHaveBeenCalledWith(reportId);
  });

  it("does not call repository when period is not published", async () => {
    const reports = new Map([
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
    const service = new PeriodService(repo);

    await expect(service.reopenPeriod(reportId)).rejects.toThrow();
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("invalidates analytics cache on successful reopen (ANAL-01)", async () => {
    const reports = new Map([
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
    const service = new PeriodService(createSpyRepository(reports), invalidate);

    await service.reopenPeriod(reportId);

    expect(invalidate).toHaveBeenCalledOnce();
  });

  it("double reopen of a reopened period fails", async () => {
    const reports = new Map([
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
    const service = new PeriodService(createSpyRepository(reports));

    // First reopen works
    await service.reopenPeriod(reportId);

    // Second reopen fails (now status is 'reopened', not 'published')
    await expect(service.reopenPeriod(reportId)).rejects.toBeInstanceOf(
      PeriodAccessError,
    );
  });
});

/* ------------------------------------------------------------------ */
/*  UFB-052 (Phase 51-B): reopen-policy gate                           */
/* ------------------------------------------------------------------ */

describe("PeriodService — reopen policy gate (UFB-052)", () => {
  it("throws PeriodAccessError when allowReopenAfterPublish=false", async () => {
    const reports = new Map([
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

    await expect(service.reopenPeriod(reportId)).rejects.toBeInstanceOf(
      PeriodAccessError,
    );
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("throws PeriodAccessError when reopen window has expired", async () => {
    const publishedAt = new Date(Date.now() - 100 * 3_600_000); // 100h ago
    const reports = new Map([
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

    await expect(service.reopenPeriod(reportId)).rejects.toBeInstanceOf(
      PeriodAccessError,
    );
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("allows reopen within the window", async () => {
    const publishedAt = new Date(Date.now() - 2 * 3_600_000); // 2h ago
    const reports = new Map([
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

    await service.reopenPeriod(reportId);
    expect(repo.reopenPeriod).toHaveBeenCalledOnce();
  });

  it("legacy callers without a policy reader stay un-gated", async () => {
    const reports = new Map([
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
    const service = new PeriodService(repo);

    await service.reopenPeriod(reportId);
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
    const reports = new Map([
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
    const service = new PeriodService(createSpyRepository(reports));
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
    const reports = new Map([
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
    const service = new PeriodService(createSpyRepository(reports));
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
    const reports = new Map([
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
    const service = new PeriodService(createSpyRepository(reports));
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
          };
        }
        return null;
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- async stub satisfies the PeriodRepository typed slot; throw is synchronous
      publishPeriod: vi.fn(async () => {
        throw new Error("DB write failed");
      }),
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PeriodRepository contract
      reopenPeriod: vi.fn(async () => undefined),
    };
    const service = new PeriodService(repo);

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
});
