import type {
  PeriodStatus,
  ReportStatus,
  UserSession,
} from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import type { PeriodLifecycleExpectation } from "../domain/period-lifecycle-expectation.js";
import {
  type AnalyticsCacheInvalidator,
  PeriodAccessError,
  type PeriodRepository,
  PeriodService,
  type ReopenPolicyReader,
} from "./period.service";
import { NOOP_PERIOD_TELEMETRY } from "./period-telemetry.port.js";

const noopInvalidate: AnalyticsCacheInvalidator = () => Promise.resolve();
const noGatingReopenPolicy: ReopenPolicyReader = () =>
  Promise.resolve({ allowReopenAfterPublish: true, reopenWindowHours: 0 });

/* ------------------------------------------------------------------ */
/*  Fixed test UUIDs                                                   */
/* ------------------------------------------------------------------ */

const reportId = "22222222-2222-4222-8222-222222222222";

const headSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "head@customreport.local",
  name: "Department Head",
  role: "head",
  activeReportId: reportId,
  activeReportSectionId: null,
};

/* ------------------------------------------------------------------ */
/*  Report factory                                                     */
/* ------------------------------------------------------------------ */

interface MockReport {
  id: string;
  status: ReportStatus;
  periodStatus: PeriodStatus;
  publishedAt: Date | null;
  publishedById: string | null;
  // Defaults to false in `getReportById` when a fixture omits it.
  archived?: boolean;
}

const PERIOD_START = new Date("2026-04-06T00:00:00.000Z");
const PERIOD_END = new Date("2026-04-12T23:59:59.999Z");
const REOPENED_AT = new Date("2026-04-14T09:00:00.000Z");

function toPeriodLifecycleExpectation(
  report: MockReport,
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
    publishedById: isPublished ? report.publishedById : null,
    reopenedAt:
      report.periodStatus === "reopened" ? new Date(REOPENED_AT) : null,
  };
}

function makeReport(overrides: Partial<MockReport> = {}): MockReport {
  return {
    id: reportId,
    status: "draft",
    periodStatus: "open",
    publishedAt: null,
    publishedById: null,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  In-memory mock repository                                          */
/* ------------------------------------------------------------------ */

function createRepository(report: MockReport | null): PeriodRepository & {
  getReport(): MockReport | null;
} {
  let current = report ? structuredClone(report) : null;

  // Resolve the live `current` id when it matches a lifecycle predicate.
  const matchId = (predicate: (r: MockReport) => boolean): string | null =>
    current && predicate(current) ? current.id : null;

  return {
    getReportById(id: string) {
      if (id !== current?.id) {
        return Promise.resolve(null);
      }

      return Promise.resolve({
        id: current.id,
        ...toPeriodLifecycleExpectation(current),
      });
    },

    getCurrentEditableId: () =>
      Promise.resolve(
        matchId(
          (r) =>
            (r.periodStatus === "open" || r.periodStatus === "reopened") &&
            !r.archived,
        ),
      ),

    getLatestPublishedNonArchivedId: () =>
      Promise.resolve(
        matchId((r) => r.periodStatus === "published" && !r.archived),
      ),

    getReopenedNonArchivedId: () =>
      Promise.resolve(
        matchId((r) => r.periodStatus === "reopened" && !r.archived),
      ),

    publishPeriod(
      id: string,
      userId: string,
      _expected: PeriodLifecycleExpectation,
    ) {
      // Mirror the guarded compare-and-set: only a not-yet-published,
      // non-archived row transitions. A zero-row match splits into "raced" (now
      // published) vs "archived" (archived inside the window).
      if (
        id === current?.id &&
        current.periodStatus !== "published" &&
        !current.archived
      ) {
        current = {
          ...current,
          status: "published",
          periodStatus: "published",
          publishedAt: new Date(),
          publishedById: userId,
        };
        return Promise.resolve({ transitioned: true as const });
      }
      const reason: "raced" | "archived" =
        current?.periodStatus === "published" ? "raced" : "archived";
      return Promise.resolve({ transitioned: false as const, reason });
    },

    reopenPeriod(id: string, _expected: PeriodLifecycleExpectation) {
      if (id === current?.id) {
        current = {
          ...current,
          periodStatus: "reopened",
        };
      }
      return Promise.resolve();
    },

    getReport() {
      return current ? structuredClone(current) : null;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  publishPeriod                                                      */
/* ------------------------------------------------------------------ */

describe("PeriodService — contract tests", () => {
  describe("publishPeriod", () => {
    it("succeeds for an open period", async () => {
      const report = makeReport({ periodStatus: "open" });
      const service = new PeriodService(
        createRepository(report),
        { invalidateAll: noopInvalidate },
        { getSettings: noGatingReopenPolicy },
        NOOP_PERIOD_TELEMETRY,
        createNullLogger(),
      );

      const result = await service.publishPeriod(reportId, headSession);

      expect(result).toEqual({ success: true, reportId });
    });

    it("succeeds for a reopened period", async () => {
      const report = makeReport({ periodStatus: "reopened" });
      const service = new PeriodService(
        createRepository(report),
        { invalidateAll: noopInvalidate },
        { getSettings: noGatingReopenPolicy },
        NOOP_PERIOD_TELEMETRY,
        createNullLogger(),
      );

      const result = await service.publishPeriod(reportId, headSession);

      expect(result).toEqual({ success: true, reportId });
    });

    it("treats a publish of an already-published period as idempotent success", async () => {
      const report = makeReport({
        periodStatus: "published",
        publishedAt: new Date("2026-04-10T16:00:00.000Z"),
      });
      const service = new PeriodService(
        createRepository(report),
        { invalidateAll: noopInvalidate },
        { getSettings: noGatingReopenPolicy },
        NOOP_PERIOD_TELEMETRY,
        createNullLogger(),
      );

      await expect(
        service.publishPeriod(reportId, headSession),
      ).resolves.toEqual({ success: true, reportId });
    });

    it("throws when report not found", async () => {
      const service = new PeriodService(
        createRepository(null),
        { invalidateAll: noopInvalidate },
        { getSettings: noGatingReopenPolicy },
        NOOP_PERIOD_TELEMETRY,
        createNullLogger(),
      );

      await expect(
        service.publishPeriod(
          "99999999-9999-4999-8999-999999999999",
          headSession,
        ),
      ).rejects.toThrow("not found");
    });

    it("records publishedAt and publishedById via repository", async () => {
      const report = makeReport({ periodStatus: "open" });
      const repo = createRepository(report);
      const service = new PeriodService(
        repo,
        { invalidateAll: noopInvalidate },
        { getSettings: noGatingReopenPolicy },
        NOOP_PERIOD_TELEMETRY,
        createNullLogger(),
      );

      await service.publishPeriod(reportId, headSession);

      const updated = repo.getReport();
      expect(updated).not.toBeNull();
      expect(expectDefined(updated).periodStatus).toBe("published");
      expect(expectDefined(updated).publishedAt).toBeInstanceOf(Date);
      expect(expectDefined(updated).publishedById).toBe(headSession.userId);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  reopenPeriod                                                     */
  /* ---------------------------------------------------------------- */

  describe("reopenPeriod", () => {
    it("succeeds for a published period", async () => {
      const report = makeReport({
        status: "published",
        periodStatus: "published",
        publishedAt: new Date("2026-04-10T16:00:00.000Z"),
      });
      const service = new PeriodService(
        createRepository(report),
        { invalidateAll: noopInvalidate },
        { getSettings: noGatingReopenPolicy },
        NOOP_PERIOD_TELEMETRY,
        createNullLogger(),
      );

      const result = await service.reopenPeriod(reportId, headSession);

      expect(result).toEqual({ success: true, reportId });
    });

    it("throws PeriodAccessError for non-published period (open)", async () => {
      const report = makeReport({ periodStatus: "open" });
      const service = new PeriodService(
        createRepository(report),
        { invalidateAll: noopInvalidate },
        { getSettings: noGatingReopenPolicy },
        NOOP_PERIOD_TELEMETRY,
        createNullLogger(),
      );

      await expect(
        service.reopenPeriod(reportId, headSession),
      ).rejects.toBeInstanceOf(PeriodAccessError);

      await expect(service.reopenPeriod(reportId, headSession)).rejects.toThrow(
        "Only published periods can be reopened.",
      );
    });

    it("throws PeriodAccessError for non-published period (reopened)", async () => {
      const report = makeReport({ periodStatus: "reopened" });
      const service = new PeriodService(
        createRepository(report),
        { invalidateAll: noopInvalidate },
        { getSettings: noGatingReopenPolicy },
        NOOP_PERIOD_TELEMETRY,
        createNullLogger(),
      );

      await expect(
        service.reopenPeriod(reportId, headSession),
      ).rejects.toBeInstanceOf(PeriodAccessError);

      await expect(service.reopenPeriod(reportId, headSession)).rejects.toThrow(
        "Only published periods can be reopened.",
      );
    });

    it("throws when report not found", async () => {
      const service = new PeriodService(
        createRepository(null),
        { invalidateAll: noopInvalidate },
        { getSettings: noGatingReopenPolicy },
        NOOP_PERIOD_TELEMETRY,
        createNullLogger(),
      );

      await expect(
        service.reopenPeriod(
          "99999999-9999-4999-8999-999999999999",
          headSession,
        ),
      ).rejects.toThrow("not found");
    });

    it("updates periodStatus to reopened via repository", async () => {
      const report = makeReport({
        status: "published",
        periodStatus: "published",
        publishedAt: new Date("2026-04-10T16:00:00.000Z"),
      });
      const repo = createRepository(report);
      const service = new PeriodService(
        repo,
        { invalidateAll: noopInvalidate },
        { getSettings: noGatingReopenPolicy },
        NOOP_PERIOD_TELEMETRY,
        createNullLogger(),
      );

      await service.reopenPeriod(reportId, headSession);

      const updated = repo.getReport();
      expect(updated).not.toBeNull();
      expect(expectDefined(updated).periodStatus).toBe("reopened");
    });
  });
});
