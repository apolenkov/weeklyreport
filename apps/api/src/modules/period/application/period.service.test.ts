import { MS_PER_HOUR } from "@customreport/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  archivedReportId,
  createSpyRepository,
  headSession,
  noGatingReopenPolicy,
  noopInvalidate,
  otherReportId,
  reportId,
  type SpyReport,
} from "./__tests__/period-service-harness.js";
import {
  PeriodAccessError,
  PeriodScopeError,
  PeriodService,
} from "./period.service";

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

    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.not.toBeInstanceOf(PeriodAccessError);
  });

  it("returns idempotent success without a write when period is already published", async () => {
    // A retry landing after the winner committed (double-click, second tab)
    // already has the desired state — publish-compare-and-set semantics: no
    // error, no second write, no counters.
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

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      { success: true, reportId },
    );
    expect(repo.publishPeriod).not.toHaveBeenCalled();
  });

  it("never consults the active-period resolver on the already-published fast path", async () => {
    // Gate order: the fast return precedes the non-admin scope assert, so a
    // retry that changes nothing is answered with success instead of a scope
    // denial for a period that is no longer the active one.
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
    const base = createSpyRepository(reports);
    const getCurrentEditableId = vi.fn(() => base.getCurrentEditableId());
    const service = new PeriodService(
      { ...base, getCurrentEditableId },
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(otherReportId, headSession),
    ).resolves.toEqual({ success: true, reportId: otherReportId });

    expect(getCurrentEditableId).not.toHaveBeenCalled();
    expect(base.publishPeriod).not.toHaveBeenCalled();
  });

  it("denies an archived period even when it is already published", async () => {
    // Gate order: the archived check precedes the already-published fast
    // return, so an archived row can never be answered with success.
    const reports = new Map<string, SpyReport>([
      [
        archivedReportId,
        {
          id: archivedReportId,
          status: "published",
          periodStatus: "published",
          publishedAt: new Date(),
          archived: true,
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
      service.publishPeriod(archivedReportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
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

    await service.publishPeriod(reportId, headSession);
    expect(repo.publishPeriod).toHaveBeenCalledOnce();

    await service.reopenPeriod(reportId, headSession);
    expect(repo.reopenPeriod).toHaveBeenCalledOnce();

    // A reopened period is publishable again, so this second publish writes.
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
    const invalidate = vi.fn(() => Promise.resolve(undefined));
    const service = new PeriodService(
      createSpyRepository(reports),
      invalidate,
      noGatingReopenPolicy,
    );

    await service.publishPeriod(reportId, headSession);

    expect(invalidate).toHaveBeenCalledOnce();
  });

  it("does NOT invalidate analytics cache on idempotent already-published success", async () => {
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
    const invalidate = vi.fn(() => Promise.resolve(undefined));
    const service = new PeriodService(
      createSpyRepository(reports),
      invalidate,
      noGatingReopenPolicy,
    );

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      { success: true, reportId },
    );

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("does NOT invalidate analytics cache when publish fails (archived)", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "draft",
          periodStatus: "open",
          publishedAt: null,
          archived: true,
        },
      ],
    ]);
    const invalidate = vi.fn(() => Promise.resolve(undefined));
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

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      {
        success: true,
        reportId,
      },
    );

    // The other report is already published: idempotent success, not an error.
    await expect(
      service.publishPeriod(otherReportId, headSession),
    ).resolves.toEqual({ success: true, reportId: otherReportId });
  });
});

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
    const invalidate = vi.fn(() => Promise.resolve(undefined));
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

    await service.reopenPeriod(reportId, headSession);

    // The first reopen left periodStatus='reopened', so the second no longer
    // meets the published precondition.
    await expect(
      service.reopenPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodAccessError);
  });
});

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
      () => Promise.resolve(undefined),
      () =>
        Promise.resolve({
          allowReopenAfterPublish: false,
          reopenWindowHours: 72,
        }),
    );

    await expect(
      service.reopenPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodAccessError);
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("throws PeriodAccessError when reopen window has expired", async () => {
    const publishedAt = new Date(Date.now() - 100 * MS_PER_HOUR);
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
      () => Promise.resolve(undefined),
      () =>
        Promise.resolve({
          allowReopenAfterPublish: true,
          reopenWindowHours: 72,
        }),
    );

    await expect(
      service.reopenPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodAccessError);
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("throws PeriodAccessError when a positive window has no publishedAt", async () => {
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "published",
          periodStatus: "published",
          publishedAt: null,
        },
      ],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(repo, noopInvalidate, () =>
      Promise.resolve({
        allowReopenAfterPublish: true,
        reopenWindowHours: 72,
      }),
    );

    await expect(
      service.reopenPeriod(reportId, headSession),
    ).rejects.toMatchObject({
      name: "PeriodAccessError",
      message:
        "Published period is missing publishedAt; reopen window cannot be enforced.",
    });
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("allows reopen within the window", async () => {
    const publishedAt = new Date(Date.now() - 2 * MS_PER_HOUR);
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
      () => Promise.resolve(undefined),
      () =>
        Promise.resolve({
          allowReopenAfterPublish: true,
          reopenWindowHours: 72,
        }),
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

// The window edge is what the admin list mirrors via `canReopen`; frozen time
// is the only way to land exactly on `publishedAt + reopenWindowHours`.
describe("PeriodService — reopen window boundary", () => {
  const NOW = new Date("2026-05-14T09:00:00.000Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  const reopenAtWindowAge = async (ageMs: number): Promise<boolean> => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const reports = new Map<string, SpyReport>([
      [
        reportId,
        {
          id: reportId,
          status: "published",
          periodStatus: "published",
          publishedAt: new Date(NOW.getTime() - ageMs),
        },
      ],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(repo, noopInvalidate, () =>
      Promise.resolve({
        allowReopenAfterPublish: true,
        reopenWindowHours: 72,
      }),
    );

    return service.reopenPeriod(reportId, headSession).then(
      () => true,
      () => false,
    );
  };

  it("allows reopen at the exact window boundary", async () => {
    await expect(reopenAtWindowAge(72 * MS_PER_HOUR)).resolves.toBe(true);
  });

  it("rejects reopen one millisecond past the boundary", async () => {
    await expect(reopenAtWindowAge(72 * MS_PER_HOUR + 1)).resolves.toBe(false);
  });
});
