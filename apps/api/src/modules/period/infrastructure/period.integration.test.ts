import type {
  PeriodStatus,
  ReportStatus,
  UserSession,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  type AnalyticsCacheInvalidator,
  PeriodAccessError,
  type PeriodRepository,
  PeriodService,
  type ReopenPolicyReader,
} from "../application/period.service";

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
  /** Defaults to false in `getReportById` when a fixture omits it. */
  archived?: boolean;
}

function createSpyRepository(
  reports: Map<string, SpyReport>,
): PeriodRepository & {
  publishPeriod: ReturnType<typeof vi.fn>;
  reopenPeriod: ReturnType<typeof vi.fn>;
} {
  // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn mock implements the async PeriodRepository.publishPeriod contract (no awaitable work in the stub)
  const publishFn = vi.fn(async (id: string) => {
    const r = reports.get(id);
    // Mirror the guarded compare-and-set: only a not-yet-published,
    // non-archived row transitions. A zero-row match splits into "raced" (now
    // published) vs "archived" (archived inside the window).
    if (!r || r.periodStatus === "published" || r.archived) {
      const reason: "raced" | "archived" =
        r?.periodStatus === "published" ? "raced" : "archived";
      return { transitioned: false as const, reason };
    }
    r.periodStatus = "published";
    r.publishedAt = new Date();
    return { transitioned: true as const };
  });

  // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn mock implements the async PeriodRepository.reopenPeriod contract (no awaitable work in the stub)
  const reopenFn = vi.fn(async (id: string) => {
    const r = reports.get(id);
    if (r) {
      r.periodStatus = "reopened";
    }
  });

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
      noopInvalidate,
      noGatingReopenPolicy,
    );

    const result = await service.publishPeriod(reportId, headSession);

    expect(result.success).toBe(true);
    expect(result.reportId).toBe(reportId);
    // The spy mutated the in-memory record
    const record = reports.get(reportId);
    expect(record?.periodStatus).toBe("published");
    expect(record?.publishedAt).toBeInstanceOf(Date);
  });

  it("publish fails with PeriodAccessError if already published", async () => {
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

    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodAccessError);
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
      noopInvalidate,
      noGatingReopenPolicy,
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
      noopInvalidate,
      noGatingReopenPolicy,
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
      noopInvalidate,
      noGatingReopenPolicy,
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
      noopInvalidate,
      noGatingReopenPolicy,
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
      noopInvalidate,
      noGatingReopenPolicy,
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
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await service.publishPeriod(reportId, headSession);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.publishPeriod).toHaveBeenCalledWith(
      reportId,
      headSession.userId,
    );
  });
});
