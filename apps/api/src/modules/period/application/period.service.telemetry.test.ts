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

  // Characterization pin: the
  // ingestion hook receives the section ids read AFTER the publish
  // transaction (not read before it), so sections that raced in before
  // commit are still picked up.
  it("enqueues ingestion with the section ids read after the publish transaction", async () => {
    const ingestion = vi.fn(() => Promise.resolve());
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
      { ...repo, listSectionIds: () => Promise.resolve(["s1", "s2"]) },
      noopInvalidate,
      noGatingReopenPolicy,
      ingestion,
    );

    await service.publishPeriod(reportId, headSession);

    expect(ingestion).toHaveBeenCalledExactlyOnceWith(["s1", "s2"]);
  });

  // Characterization pin: an ingestion-hook failure is swallowed — the
  // publish still resolves successfully (mirrors the discipline the
  // publication module logs a warning for instead of throwing away silently).
  it("swallows an ingestion hook failure without rejecting the publish", async () => {
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
      () => Promise.reject(new Error("queue down")),
    );

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      { success: true, reportId },
    );
  });

  // The post-commit section-id read shares the ingestion swallow: a transient
  // read failure degrades ingestion, never the already-committed publish.
  it("swallows a section-id read failure without rejecting the publish", async () => {
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
    const ingestion = vi.fn(() => Promise.resolve());
    const service = new PeriodService(
      {
        ...repo,
        listSectionIds: () => Promise.reject(new Error("read blip")),
      },
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
