import type {
  AssembledReport,
  ReportSectionReadModel,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  customreportPeriodStateTransitionsTotal,
  customreportReportsSubmittedTotal,
} from "../../../infrastructure/metrics/metrics.registry.js";
import { createNullLogger } from "../../../lib/logger";
import {
  makeProjectReadModel,
  makeReportSectionReadModel,
} from "../../../test-utils/report-section-fixtures.js";
import { PublicationPrometheusTelemetry } from "../infrastructure/publication-prometheus-telemetry.adapter.js";
import {
  type AutoPublishResult,
  type PublicationRepository,
  PublicationService,
} from "./publication.service";

/* ------------------------------------------------------------------ */
/*  Fixed test UUIDs                                                   */
/* ------------------------------------------------------------------ */

const reportId = "22222222-2222-4222-8222-222222222222";
const noopInvalidateAnalyticsCache = () => Promise.resolve();
// Explicit publishAt from the domain boundary (the scheduler tick) — the
// mapper must persist exactly this timestamp, never a freshly-minted Date.
const publishAt = new Date("2026-04-10T18:00:00.000Z");

/* ------------------------------------------------------------------ */
/*  Section / report factories                                         */
/* ------------------------------------------------------------------ */

type ProjectFixture = Partial<ReportSectionReadModel["projects"][number]> &
  Pick<
    ReportSectionReadModel["projects"][number],
    "projectId" | "projectName" | "trafficLight"
  >;

function makeSection(
  overrides: Omit<Partial<ReportSectionReadModel>, "projects"> & {
    reportSectionId: string;
    authorId: string;
    authorName: string;
    projects?: ProjectFixture[];
  },
): ReportSectionReadModel {
  const { projects = [], ...sectionOverrides } = overrides;
  return makeReportSectionReadModel({
    reportId,
    status: "submitted",
    submittedAt: new Date("2026-04-09T10:00:00.000Z"),
    projects: projects.map(makeProjectReadModel),
    ...sectionOverrides,
  });
}

function makeReport(
  overrides: Partial<AssembledReport> & { sections: ReportSectionReadModel[] },
): AssembledReport {
  return {
    reportId,
    periodStart: new Date("2026-04-06T00:00:00.000Z"),
    periodEnd: new Date("2026-04-12T23:59:59.000Z"),
    deadline: new Date("2026-04-10T15:00:00.000Z"),
    status: "draft",
    publishedAt: null,
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "green",
      totals: { green: 0, yellow: 0, red: 0 },
    },
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Shared in-memory fake repository                                   */
/* ------------------------------------------------------------------ */

function createRepository(
  report: AssembledReport | null,
): PublicationRepository {
  let currentReport = report ? structuredClone(report) : null;

  return {
    getAssembledReport(activeReportId: string) {
      if (activeReportId !== currentReport?.reportId) {
        return Promise.resolve(null);
      }

      return Promise.resolve(structuredClone(currentReport));
    },
    saveAutoPublishedReport(nextReport: AssembledReport) {
      currentReport = structuredClone(nextReport);

      return Promise.resolve({
        published: true as const,
        wasAlreadyPublished: false,
        report: structuredClone(currentReport),
      });
    },
  };
}

// Narrow an auto-publish outcome to its report, failing loudly if the write
// was skipped — keeps the published-path assertions free of `if` guards.
function expectPublished(result: AutoPublishResult): AssembledReport {
  if (!result.published) {
    throw new Error("expected a published auto-publish outcome, got a skip");
  }
  return result.report;
}

// Helper for Prometheus Counter introspection: the registry tracks
// (labels → value) pairs and we find the matching tuple, avoiding client
// internals leaking into every test file.
async function getCounterValue(
  counter: {
    get(): Promise<{
      values: { value: number; labels: Record<string, unknown> }[];
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

/* ------------------------------------------------------------------ */
/*  Shared fixtures                                                    */
/* ------------------------------------------------------------------ */

const sectionAlpha = makeSection({
  reportSectionId: "11111111-1111-4111-8111-111111111111",
  authorId: "33333333-3333-4333-8333-333333333331",
  authorName: "Alpha Lead",
  projects: [
    {
      projectId: "44444444-4444-4444-8444-444444444441",
      projectName: "Project Alpha",
      trafficLight: "green",
    },
  ],
});

const sectionBravo = makeSection({
  reportSectionId: "11111111-1111-4111-8111-111111111112",
  authorId: "33333333-3333-4333-8333-333333333332",
  authorName: "Bravo Lead",
  projects: [
    {
      projectId: "44444444-4444-4444-8444-444444444442",
      projectName: "Project Bravo",
      trafficLight: "yellow",
    },
  ],
});

const sectionCharlie = makeSection({
  reportSectionId: "11111111-1111-4111-8111-111111111113",
  authorId: "33333333-3333-4333-8333-333333333333",
  authorName: "Charlie Lead",
  projects: [
    {
      projectId: "44444444-4444-4444-8444-444444444443",
      projectName: "Project Charlie",
      trafficLight: "red",
    },
  ],
});

// Sections are intentionally out of alphabetical order so the happy-path
// getAssembledReport test can assert the service sorts them by authorName.
const assembledReport: AssembledReport = makeReport({
  status: "draft",
  portfolioOverview: {
    status: "red",
    totals: { green: 1, yellow: 1, red: 1 },
  },
  sections: [sectionCharlie, sectionAlpha, sectionBravo],
});

describe("PublicationService", () => {
  describe("getAssembledReport", () => {
    it("returns the assembled report for the active report, sorted by authorName", async () => {
      const service = new PublicationService(
        createRepository(assembledReport),
        createNullLogger(),
        noopInvalidateAnalyticsCache,
      );

      const result = await service.getAssembledReport(reportId);

      expect(result).toMatchObject({ reportId, status: "draft" });
      expect(result.sections.map((s) => s.authorName)).toEqual([
        "Alpha Lead",
        "Bravo Lead",
        "Charlie Lead",
      ]);
    });

    it("throws when report not found (null from repo)", async () => {
      const service = new PublicationService(
        createRepository(null),
        createNullLogger(),
        noopInvalidateAnalyticsCache,
      );

      await expect(
        service.getAssembledReport("99999999-9999-4999-8999-999999999999"),
      ).rejects.toThrow("was not found");
    });

    it("builds portfolio overview: all green -> status green", async () => {
      const report = makeReport({
        sections: [
          makeSection({
            reportSectionId: "11111111-1111-4111-8111-111111111111",
            authorId: "33333333-3333-4333-8333-333333333331",
            authorName: "Lead A",
            projects: [
              {
                projectId: "44444444-4444-4444-8444-444444444441",
                projectName: "P1",
                trafficLight: "green",
              },
              {
                projectId: "44444444-4444-4444-8444-444444444442",
                projectName: "P2",
                trafficLight: "green",
              },
            ],
          }),
          makeSection({
            reportSectionId: "11111111-1111-4111-8111-111111111112",
            authorId: "33333333-3333-4333-8333-333333333332",
            authorName: "Lead B",
            projects: [
              {
                projectId: "44444444-4444-4444-8444-444444444443",
                projectName: "P3",
                trafficLight: "green",
              },
            ],
          }),
        ],
      });

      const service = new PublicationService(
        createRepository(report),
        createNullLogger(),
        noopInvalidateAnalyticsCache,
      );
      const result = await service.getAssembledReport(reportId);

      expect(result.portfolioOverview).toEqual({
        status: "green",
        totals: { green: 3, yellow: 0, red: 0 },
      });
    });

    it("builds portfolio overview: any yellow -> status yellow", async () => {
      const report = makeReport({
        sections: [
          makeSection({
            reportSectionId: "11111111-1111-4111-8111-111111111111",
            authorId: "33333333-3333-4333-8333-333333333331",
            authorName: "Lead A",
            projects: [
              {
                projectId: "44444444-4444-4444-8444-444444444441",
                projectName: "P1",
                trafficLight: "green",
              },
            ],
          }),
          makeSection({
            reportSectionId: "11111111-1111-4111-8111-111111111112",
            authorId: "33333333-3333-4333-8333-333333333332",
            authorName: "Lead B",
            projects: [
              {
                projectId: "44444444-4444-4444-8444-444444444442",
                projectName: "P2",
                trafficLight: "yellow",
              },
            ],
          }),
        ],
      });

      const service = new PublicationService(
        createRepository(report),
        createNullLogger(),
        noopInvalidateAnalyticsCache,
      );
      const result = await service.getAssembledReport(reportId);

      expect(result.portfolioOverview).toEqual({
        status: "yellow",
        totals: { green: 1, yellow: 1, red: 0 },
      });
    });

    it("builds portfolio overview: any red -> status red (overrides yellow)", async () => {
      const report = makeReport({
        sections: [sectionAlpha, sectionBravo, sectionCharlie],
      });

      const service = new PublicationService(
        createRepository(report),
        createNullLogger(),
        noopInvalidateAnalyticsCache,
      );
      const result = await service.getAssembledReport(reportId);

      expect(result.portfolioOverview.status).toBe("red");
      expect(result.portfolioOverview.totals.red).toBeGreaterThan(0);
    });

    it("counts traffic lights correctly in totals — null lights are not counted", async () => {
      const report = makeReport({
        sections: [
          makeSection({
            reportSectionId: "11111111-1111-4111-8111-111111111111",
            authorId: "33333333-3333-4333-8333-333333333331",
            authorName: "Lead A",
            projects: [
              {
                projectId: "44444444-4444-4444-8444-444444444441",
                projectName: "P1",
                trafficLight: "green",
              },
              {
                projectId: "44444444-4444-4444-8444-444444444442",
                projectName: "P2",
                trafficLight: "green",
              },
              {
                projectId: "44444444-4444-4444-8444-444444444443",
                projectName: "P3 (no light)",
                trafficLight: null,
              },
            ],
          }),
          makeSection({
            reportSectionId: "11111111-1111-4111-8111-111111111112",
            authorId: "33333333-3333-4333-8333-333333333332",
            authorName: "Lead B",
            projects: [
              {
                projectId: "44444444-4444-4444-8444-444444444444",
                projectName: "P4",
                trafficLight: "yellow",
              },
              {
                projectId: "44444444-4444-4444-8444-444444444445",
                projectName: "P5",
                trafficLight: "red",
              },
            ],
          }),
        ],
      });

      const service = new PublicationService(
        createRepository(report),
        createNullLogger(),
        noopInvalidateAnalyticsCache,
      );
      const result = await service.getAssembledReport(reportId);

      // 2 green, 1 yellow, 1 red; null is skipped
      expect(result.portfolioOverview.totals).toEqual({
        green: 2,
        yellow: 1,
        red: 1,
      });
      expect(result.portfolioOverview.status).toBe("red");
    });

    it("sections sorted by authorName (Russian locale)", async () => {
      const report = makeReport({
        sections: [
          makeSection({
            reportSectionId: "11111111-1111-4111-8111-111111111113",
            authorId: "33333333-3333-4333-8333-333333333333",
            authorName: "Яков",
            projects: [
              {
                projectId: "44444444-4444-4444-8444-444444444443",
                projectName: "P3",
                trafficLight: "green",
              },
            ],
          }),
          makeSection({
            reportSectionId: "11111111-1111-4111-8111-111111111111",
            authorId: "33333333-3333-4333-8333-333333333331",
            authorName: "Андрей",
            projects: [
              {
                projectId: "44444444-4444-4444-8444-444444444441",
                projectName: "P1",
                trafficLight: "green",
              },
            ],
          }),
          makeSection({
            reportSectionId: "11111111-1111-4111-8111-111111111112",
            authorId: "33333333-3333-4333-8333-333333333332",
            authorName: "Борис",
            projects: [
              {
                projectId: "44444444-4444-4444-8444-444444444442",
                projectName: "P2",
                trafficLight: "green",
              },
            ],
          }),
        ],
      });

      const service = new PublicationService(
        createRepository(report),
        createNullLogger(),
        noopInvalidateAnalyticsCache,
      );
      const result = await service.getAssembledReport(reportId);

      expect(result.sections.map((s) => s.authorName)).toEqual([
        "Андрей",
        "Борис",
        "Яков",
      ]);
    });
  });

  describe("publishAuto", () => {
    // Scheduler-driven auto-publish bypasses session attribution.
    // publishedById stays null and publishedByName='system' so the head
    // dashboard can show a "auto-published" badge by comparing.
    it("publishAuto stamps system attribution (publishedById=null)", async () => {
      const service = new PublicationService(
        createRepository(assembledReport),
        createNullLogger(),
        noopInvalidateAnalyticsCache,
      );

      const published = expectPublished(
        await service.publishAuto(reportId, publishAt),
      );

      expect(published.status).toBe("published");
      expect(published.publishedById).toBeNull();
      expect(published.publishedByName).toBe("system");
      expect(published.publishedAt).toEqual(publishAt);
    });

    it("publishAuto is idempotent on already-published reports (no throw, returns current)", async () => {
      const service = new PublicationService(
        createRepository(assembledReport),
        createNullLogger(),
        noopInvalidateAnalyticsCache,
      );

      const first = expectPublished(
        await service.publishAuto(reportId, publishAt),
      );
      const second = expectPublished(
        await service.publishAuto(reportId, publishAt),
      );

      expect(first.status).toBe("published");
      expect(second.status).toBe("published");
      // publishedAt should be the same instant — the second call must not
      // re-stamp a new Date(); idempotent means "no write".
      expect(second.publishedAt).toEqual(first.publishedAt);
    });

    // The idempotent short-circuit must be distinguishable from a real write
    // so a caller (the scheduler) can tell "raced with a manual publish"
    // apart from "auto-published just now".
    it("publishAuto idempotent short-circuit reports wasAlreadyPublished=true and performs no write", async () => {
      const alreadyPublished = makeReport({
        status: "published",
        publishedAt: new Date("2026-04-10T18:00:00.000Z"),
        publishedById: "55555555-5555-4555-8555-555555555555",
        publishedByName: "Head",
        sections: [sectionAlpha],
      });
      const saveAutoPublishedReport = vi.fn();
      const repository: PublicationRepository = {
        ...createRepository(alreadyPublished),
        saveAutoPublishedReport,
      };
      const service = new PublicationService(
        repository,
        createNullLogger(),
        noopInvalidateAnalyticsCache,
      );

      const result = await service.publishAuto(reportId, publishAt);

      expect(result).toMatchObject({
        published: true,
        wasAlreadyPublished: true,
        report: { status: "published" },
      });
      expect(saveAutoPublishedReport).not.toHaveBeenCalled();
    });

    // The real write branch (report was draft, CAS succeeds) must still
    // report wasAlreadyPublished=false, distinguishing it from the idempotent
    // short-circuit above.
    it("publishAuto real write reports wasAlreadyPublished=false and writes exactly once", async () => {
      const repository = createRepository(assembledReport);
      const saveSpy = vi.spyOn(repository, "saveAutoPublishedReport");
      const service = new PublicationService(
        repository,
        createNullLogger(),
        noopInvalidateAnalyticsCache,
      );

      const result = await service.publishAuto(reportId, publishAt);

      expect(result).toMatchObject({
        published: true,
        wasAlreadyPublished: false,
        report: { status: "published" },
      });
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it("publishAuto forwards the scheduler's expected deadline into the CAS", async () => {
      const expectedDeadline = new Date("2026-04-09T15:00:00.000Z");
      const saveAutoPublishedReport = vi.fn(
        (nextReport: AssembledReport, _expectedDeadline: Date | null) =>
          Promise.resolve({
            published: true as const,
            wasAlreadyPublished: false,
            report: nextReport,
          }),
      );
      const repository: PublicationRepository = {
        getAssembledReport: () =>
          Promise.resolve(structuredClone(assembledReport)),
        saveAutoPublishedReport,
      };
      const service = new PublicationService(
        repository,
        createNullLogger(),
        noopInvalidateAnalyticsCache,
      );

      await service.publishAuto(reportId, publishAt, expectedDeadline);

      expect(saveAutoPublishedReport).toHaveBeenCalledWith(
        expect.objectContaining({ status: "published" }),
        expectedDeadline,
      );
    });

    it("publishAuto invalidates analytics after a successful publish", async () => {
      const repository = createRepository(assembledReport);
      const saveSpy = vi.spyOn(repository, "saveAutoPublishedReport");
      const invalidateAnalyticsCache = vi.fn(() => Promise.resolve());
      const service = new PublicationService(
        repository,
        createNullLogger(),
        invalidateAnalyticsCache,
      );

      await service.publishAuto(reportId, publishAt);

      expect(invalidateAnalyticsCache).toHaveBeenCalledTimes(1);
      expect(saveSpy.mock.invocationCallOrder[0]).toBeLessThan(
        invalidateAnalyticsCache.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it("publishAuto increments product KPI counters once on success", async () => {
      const service = new PublicationService(
        createRepository(assembledReport),
        createNullLogger(),
        noopInvalidateAnalyticsCache,
        new PublicationPrometheusTelemetry(),
      );
      const submittedBefore = await getCounterValue(
        customreportReportsSubmittedTotal,
        { state: "published" },
      );
      const transitionsBefore = await getCounterValue(
        customreportPeriodStateTransitionsTotal,
        { from: "open", to: "published" },
      );

      await service.publishAuto(reportId, publishAt);

      expect(
        await getCounterValue(customreportReportsSubmittedTotal, {
          state: "published",
        }),
      ).toBe(submittedBefore + 1);
      expect(
        await getCounterValue(customreportPeriodStateTransitionsTotal, {
          from: "open",
          to: "published",
        }),
      ).toBe(transitionsBefore + 1);
    });

    // When the repo's CAS matches zero rows (period archived after selection),
    // publishAuto returns a skipped outcome and fires NONE of the publish
    // success side-effects — no counter bump.
    it("publishAuto skip: zero-row compare-and-set → no metrics", async () => {
      const repository: PublicationRepository = {
        ...createRepository(assembledReport),
        saveAutoPublishedReport() {
          return Promise.resolve({ published: false as const });
        },
      };
      const telemetry = {
        recordPublishedReport: vi.fn(),
        recordPeriodPublished: vi.fn(),
      };
      const service = new PublicationService(
        repository,
        createNullLogger(),
        noopInvalidateAnalyticsCache,
        telemetry,
      );

      const result = await service.publishAuto(reportId, publishAt);

      expect(result).toEqual({ published: false });
      expect(telemetry.recordPublishedReport).not.toHaveBeenCalled();
      expect(telemetry.recordPeriodPublished).not.toHaveBeenCalled();
    });

    // published:false skip must not invalidate analytics — only the real
    // publish branch calls invalidateAnalyticsCache (see publishAuto docs).
    it("publishAuto skip: zero-row compare-and-set → no analytics cache invalidation", async () => {
      const invalidateAnalyticsCache = vi.fn(() => Promise.resolve());
      const repository: PublicationRepository = {
        ...createRepository(assembledReport),
        saveAutoPublishedReport() {
          return Promise.resolve({ published: false as const });
        },
      };
      const service = new PublicationService(
        repository,
        createNullLogger(),
        invalidateAnalyticsCache,
      );

      const result = await service.publishAuto(reportId, publishAt);

      expect(result).toEqual({ published: false });
      expect(invalidateAnalyticsCache).toHaveBeenCalledTimes(0);
    });
  });
});
