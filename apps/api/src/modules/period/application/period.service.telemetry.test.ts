import { describe, expect, it, vi } from "vitest";

import {
  customreportPeriodStateTransitionsTotal,
  customreportReportsSubmittedTotal,
} from "../../../infrastructure/metrics/metrics.registry.js";
import { PeriodPrometheusTelemetry } from "../infrastructure/period-prometheus-telemetry.adapter.js";
import {
  createSpyRepository,
  getCounterValue,
  headSession,
  noGatingReopenPolicy,
  noopInvalidate,
  reportId,
  type SpyReport,
} from "./__tests__/period-service-harness.js";
import { type PeriodRepository, PeriodService } from "./period.service";

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
      getReportById(id: string) {
        if (id === reportId) {
          return Promise.resolve({
            id: reportId,
            status: "draft",
            periodStatus: "open",
            publishedAt: null,
            archived: false,
          });
        }
        return Promise.resolve(null);
      },
      getCurrentEditableId: () => Promise.resolve(reportId),
      getLatestPublishedNonArchivedId: () => Promise.resolve(null),
      getReopenedNonArchivedId: () => Promise.resolve(null),
      publishPeriod: vi.fn(() => {
        return Promise.reject(new Error("DB write failed"));
      }),
      reopenPeriod: vi.fn(() => Promise.resolve(undefined)),
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

  it("emits no counters or cache invalidation when the compare-and-set did not transition", async () => {
    // A concurrent publish already transitioned the period: getReportById still
    // reads "open" (it raced ahead of the winner's commit), the service clears
    // its fast-path, but the guarded write reports transitioned:false.
    const invalidateAnalyticsCache = vi.fn(() => Promise.resolve());
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
    };
    const service = new PeriodService(
      repo,
      invalidateAnalyticsCache,
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

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      { success: true, reportId },
    );

    expect(invalidateAnalyticsCache).not.toHaveBeenCalled();
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

  // A committed lifecycle write must not fail the API response because the
  // post-commit cache invalidation rejected; the failure is observed via
  // onSideEffectError, never propagated.
  it("swallows a cache-invalidation failure without rejecting the publish", async () => {
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
    const onSideEffectError = vi.fn();
    const telemetry = {
      recordPublishedReport: vi.fn(),
      recordPeriodPublished: vi.fn(),
    };
    const service = new PeriodService(
      repo,
      () => Promise.reject(new Error("cache down")),
      noGatingReopenPolicy,
      telemetry,
      onSideEffectError,
    );

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      { success: true, reportId },
    );
    expect(onSideEffectError).toHaveBeenCalledExactlyOnceWith(
      new Error("cache down"),
    );
    expect(telemetry.recordPublishedReport).toHaveBeenCalledTimes(1);
    expect(telemetry.recordPeriodPublished).toHaveBeenCalledExactlyOnceWith(
      "open",
    );
  });

  // The publish still resolves when the post-commit telemetry adapter throws;
  // the failure is observed via onSideEffectError, never propagated.
  it("swallows a telemetry failure without rejecting the publish", async () => {
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
    const onSideEffectError = vi.fn();
    const invalidateAnalyticsCache = vi.fn(() => Promise.resolve());
    const service = new PeriodService(
      repo,
      invalidateAnalyticsCache,
      noGatingReopenPolicy,
      {
        recordPublishedReport: () => {
          throw new Error("telemetry blip");
        },
        recordPeriodPublished: () => undefined,
      },
      onSideEffectError,
    );

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      { success: true, reportId },
    );
    expect(onSideEffectError).toHaveBeenCalledExactlyOnceWith(
      new Error("telemetry blip"),
    );
    expect(invalidateAnalyticsCache).toHaveBeenCalledTimes(1);
  });
});
