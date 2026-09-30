import type {
  PeriodStatus,
  ReportStatus,
  UserSession,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import {
  type AnalyticsCacheInvalidator,
  PeriodAccessError,
  type PeriodRepository,
  PeriodService,
  type ReopenPolicyReader,
} from "../application/period.service";
import { NOOP_PERIOD_TELEMETRY } from "../application/period-telemetry.port.js";
import type { PeriodLifecycleExpectation } from "../domain/period-lifecycle-expectation.js";

const noopInvalidate: AnalyticsCacheInvalidator = () => Promise.resolve();
const noGatingReopenPolicy: ReopenPolicyReader = () =>
  Promise.resolve({ allowReopenAfterPublish: true, reopenWindowHours: 0 });

/* ------------------------------------------------------------------ */
/*  Fixed test UUIDs                                                   */
/* ------------------------------------------------------------------ */

const reportId = "aaaa1111-1111-4111-8111-111111111111";

const headSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "head@customreport.local",
  name: "Department Head",
  role: "head",
  activeReportId: reportId,
  activeReportSectionId: null,
};

/* ------------------------------------------------------------------ */
/*  Mock repository                                                    */
/* ------------------------------------------------------------------ */

interface SpyReport {
  id: string;
  status: ReportStatus;
  periodStatus: PeriodStatus;
  publishedAt: Date | null;
  // Defaults to false in `getReportById` when a fixture omits it.
  archived?: boolean;
}

const PERIOD_START = new Date("2026-04-06T00:00:00.000Z");
const PERIOD_END = new Date("2026-04-12T23:59:59.999Z");
const REOPENED_AT = new Date("2026-04-14T09:00:00.000Z");

function toPeriodLifecycleExpectation(
  report: SpyReport,
): PeriodLifecycleExpectation {
  const isPublished = report.periodStatus !== "open";
  return {
    periodStart: new Date(PERIOD_START),
    periodEnd: new Date(PERIOD_END),
    periodState: report.archived
      ? "archived"
      : report.periodStatus === "published"
        ? "published"
        : "open",
    status: isPublished ? "published" : "draft",
    periodStatus: report.periodStatus,
    archived: report.archived ?? false,
    autoPublished: false,
    autoArchived: false,
    publishedAt: isPublished
      ? new Date(report.publishedAt ?? "2026-04-13T09:00:00.000Z")
      : null,
    publishedById: isPublished ? headSession.userId : null,
    reopenedAt:
      report.periodStatus === "reopened" ? new Date(REOPENED_AT) : null,
  };
}

function createSpyRepository(
  reports: Map<string, SpyReport>,
): PeriodRepository & {
  publishPeriod: ReturnType<typeof vi.fn>;
  reopenPeriod: ReturnType<typeof vi.fn>;
} {
  const publishFn = vi.fn(
    (id: string, _userId: string, _expected: PeriodLifecycleExpectation) => {
      const r = reports.get(id);
      // Mirror the guarded compare-and-set: only a not-yet-published,
      // non-archived row transitions. A zero-row match splits into "raced" (now
      // published) vs "archived" (archived inside the window).
      if (!r || r.periodStatus === "published" || r.archived) {
        const reason: "raced" | "archived" =
          r?.periodStatus === "published" ? "raced" : "archived";
        return Promise.resolve({ transitioned: false as const, reason });
      }
      r.periodStatus = "published";
      r.publishedAt = new Date();
      return Promise.resolve({ transitioned: true as const });
    },
  );

  const reopenFn = vi.fn(
    (id: string, _expected: PeriodLifecycleExpectation) => {
      const r = reports.get(id);
      if (r) {
        r.periodStatus = "reopened";
      }
      return Promise.resolve();
    },
  );

  const resolveFirstId = (match: (r: SpyReport) => boolean): string | null =>
    [...reports.values()].find(match)?.id ?? null;

  return {
    getReportById(id: string) {
      const r = reports.get(id);
      return Promise.resolve(
        r ? { id: r.id, ...toPeriodLifecycleExpectation(r) } : null,
      );
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
/*  Integration-level tests — complementary to period.service.test.ts  */
/* ------------------------------------------------------------------ */

describe("PeriodService — integration (publish lifecycle)", () => {
  it("publish sets periodStatus to published and records timestamp", async () => {
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
      { invalidateAll: noopInvalidate },
      { getSettings: noGatingReopenPolicy },
      NOOP_PERIOD_TELEMETRY,
      createNullLogger(),
    );

    const result = await service.publishPeriod(reportId, headSession);

    expect(result.success).toBe(true);
    expect(result.reportId).toBe(reportId);
    // The spy mutated the in-memory record
    const record = reports.get(reportId);
    expect(record?.periodStatus).toBe("published");
    expect(record?.publishedAt).toBeInstanceOf(Date);
  });

  it("publish of an already-published period is an idempotent success", async () => {
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
      { invalidateAll: noopInvalidate },
      { getSettings: noGatingReopenPolicy },
      NOOP_PERIOD_TELEMETRY,
      createNullLogger(),
    );

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      { success: true, reportId },
    );
  });

  it("reopen resets periodStatus from published to reopened", async () => {
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
      { invalidateAll: noopInvalidate },
      { getSettings: noGatingReopenPolicy },
      NOOP_PERIOD_TELEMETRY,
      createNullLogger(),
    );

    const result = await service.reopenPeriod(reportId, headSession);

    expect(result.success).toBe(true);
    expect(reports.get(reportId)?.periodStatus).toBe("reopened");
  });

  it("reopen fails with PeriodAccessError if not published", async () => {
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
      { invalidateAll: noopInvalidate },
      { getSettings: noGatingReopenPolicy },
      NOOP_PERIOD_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.reopenPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodAccessError);
  });

  it("publish after reopen succeeds (reopened -> published)", async () => {
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
      { invalidateAll: noopInvalidate },
      { getSettings: noGatingReopenPolicy },
      NOOP_PERIOD_TELEMETRY,
      createNullLogger(),
    );

    // Publish -> Reopen -> Re-publish
    await service.publishPeriod(reportId, headSession);
    await service.reopenPeriod(reportId, headSession);
    const result = await service.publishPeriod(reportId, headSession);

    expect(result.success).toBe(true);
  });

  it("publish with missing report throws generic Error (not PeriodAccessError)", async () => {
    const service = new PeriodService(
      createSpyRepository(new Map()),
      { invalidateAll: noopInvalidate },
      { getSettings: noGatingReopenPolicy },
      NOOP_PERIOD_TELEMETRY,
      createNullLogger(),
    );

    const error = await service
      .publishPeriod(reportId, headSession)
      .catch((error_: unknown) => error_);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(PeriodAccessError);
  });

  it("reopen with missing report throws generic Error", async () => {
    const service = new PeriodService(
      createSpyRepository(new Map()),
      { invalidateAll: noopInvalidate },
      { getSettings: noGatingReopenPolicy },
      NOOP_PERIOD_TELEMETRY,
      createNullLogger(),
    );

    const error = await service
      .reopenPeriod(reportId, headSession)
      .catch((error_: unknown) => error_);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(PeriodAccessError);
  });

  it("publish records the userId via repository call", async () => {
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
      { invalidateAll: noopInvalidate },
      { getSettings: noGatingReopenPolicy },
      NOOP_PERIOD_TELEMETRY,
      createNullLogger(),
    );

    await service.publishPeriod(reportId, headSession);

    expect(repo.publishPeriod).toHaveBeenCalledWith(
      reportId,
      headSession.userId,
      expect.objectContaining({
        periodStatus: "open",
      }),
    );
  });
});
