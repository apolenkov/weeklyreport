import type {
  AssembledReport,
  ReportSectionReadModel,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  customreportPeriodStateTransitionsTotal,
  customreportReportsSubmittedTotal,
} from "../../../infrastructure/metrics/metrics.registry.js";
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

/* ------------------------------------------------------------------ */
/*  Section / report factories                                         */
/* ------------------------------------------------------------------ */

function makeSection(
  overrides: Partial<ReportSectionReadModel> & {
    reportSectionId: string;
    authorId: string;
    authorName: string;
  },
): ReportSectionReadModel {
  return {
    reportId,
    version: 1,
    status: "submitted",
    submittedAt: new Date("2026-04-09T10:00:00.000Z"),
    projects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    ...overrides,
  };
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
  // The assembled read model exposes only legacy `status`; the publish guard
  // keys on `periodStatus`, so the fake tracks it separately (a reopened
  // period carries legacy status="published" with periodStatus="reopened").
  let currentPeriodStatus: "open" | "published" | "reopened" =
    report?.status === "published" ? "published" : "open";

  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async PublicationRepository contract (no awaitable work in the stub)
    async getAssembledReport(activeReportId: string) {
      if (activeReportId !== currentReport?.reportId) {
        return null;
      }

      return structuredClone(currentReport);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async PublicationRepository contract (no awaitable work in the stub)
    async publishAssembledReport(nextReport: AssembledReport) {
      if (currentPeriodStatus === "published") {
        return {
          status: "already-published" as const,
          report: structuredClone(currentReport ?? nextReport),
        };
      }
      const priorPeriodStatus = currentPeriodStatus;
      currentReport = structuredClone(nextReport);
      currentPeriodStatus = "published";
      return {
        status: "transitioned" as const,
        priorPeriodStatus,
        report: structuredClone(currentReport),
      };
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async PublicationRepository contract (no awaitable work in the stub)
    async saveAutoPublishedReport(nextReport: AssembledReport) {
      currentReport = structuredClone(nextReport);

      return {
        published: true as const,
        report: structuredClone(currentReport),
      };
    },
  };
}

/**
 * Narrow an auto-publish outcome to its report, failing the test loudly if the
 * write was skipped — keeps the published-path assertions free of `if` guards.
 */
function expectPublished(result: AutoPublishResult): AssembledReport {
  if (!result.published) {
    throw new Error("expected a published auto-publish outcome, got a skip");
  }
  return result.report;
}

/**
 * Helper for prom-client Counter introspection in unit tests. Avoids
 * leaking prom-client internals into every test file: the registry tracks
 * (labels → value) pairs and we just find the matching tuple.
 */
async function getCounterValue(
  counter: {
    get(): Promise<{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prom-client label record shape
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
      const service = new PublicationService(createRepository(assembledReport));

      const result = await service.getAssembledReport(reportId);

      expect(result).toMatchObject({ reportId, status: "draft" });
      expect(result.sections.map((s) => s.authorName)).toEqual([
        "Alpha Lead",
        "Bravo Lead",
        "Charlie Lead",
      ]);
    });

    it("throws when report not found (null from repo)", async () => {
      const service = new PublicationService(createRepository(null));

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

      const service = new PublicationService(createRepository(report));
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

      const service = new PublicationService(createRepository(report));
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

      const service = new PublicationService(createRepository(report));
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

      const service = new PublicationService(createRepository(report));
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

      const service = new PublicationService(createRepository(report));
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
      const service = new PublicationService(createRepository(assembledReport));

      const published = expectPublished(await service.publishAuto(reportId));

      expect(published.status).toBe("published");
      expect(published.publishedById).toBeNull();
      expect(published.publishedByName).toBe("system");
      expect(published.publishedAt).toBeInstanceOf(Date);
    });

    it("publishAuto is idempotent on already-published reports (no throw, returns current)", async () => {
      const service = new PublicationService(createRepository(assembledReport));

      const first = expectPublished(await service.publishAuto(reportId));
      const second = expectPublished(await service.publishAuto(reportId));

      expect(first.status).toBe("published");
      expect(second.status).toBe("published");
      // publishedAt should be the same instant — the second call must not
      // re-stamp a new Date(); idempotent means "no write".
      expect(second.publishedAt).toEqual(first.publishedAt);
    });

    it("publishAuto increments product KPI counters once on success", async () => {
      const service = new PublicationService(
        createRepository(assembledReport),
        undefined,
        undefined,
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

      await service.publishAuto(reportId);

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

    // period-dual-state: when the repository's compare-and-set matches zero rows
    // (the period was archived after candidate selection), publishAuto returns a
    // skipped outcome and fires NONE of the publish success side-effects — no KPI
    // counter bump, no ingestion enqueue.
    it("publishAuto skip: zero-row compare-and-set → no metrics, no ingestion", async () => {
      const ingestion = vi.fn(() => Promise.resolve());
      const repository: PublicationRepository = {
        ...createRepository(assembledReport),
        // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async PublicationRepository contract (no awaitable work in the stub)
        async saveAutoPublishedReport() {
          return { published: false as const };
        },
      };
      const service = new PublicationService(repository, undefined, ingestion);
      const submittedBefore = await getCounterValue(
        customreportReportsSubmittedTotal,
        { state: "published" },
      );
      const transitionsBefore = await getCounterValue(
        customreportPeriodStateTransitionsTotal,
        { from: "open", to: "published" },
      );

      const result = await service.publishAuto(reportId);

      expect(result).toEqual({ published: false });
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

    // Characterization pin: the shared side-effects module must call the
    // ingestion enqueue with the just-published report's ids.
    it("publishAuto enqueues ingestion with the published report's section ids", async () => {
      const ingestion = vi.fn(() => Promise.resolve());
      const service = new PublicationService(
        createRepository(assembledReport),
        undefined,
        ingestion,
      );

      const published = expectPublished(await service.publishAuto(reportId));

      expect(ingestion).toHaveBeenCalledTimes(1);
      expect(ingestion).toHaveBeenCalledWith(
        published.sections.map((s) => s.reportSectionId),
      );
    });

    // Characterization pin: publishAuto has never enqueued ingestion for a
    // report with zero sections (the old inline enqueueIngestion guard).
    it("publishAuto skips the ingestion hook when the published report has no sections", async () => {
      const report = makeReport({ sections: [] });
      const ingestion = vi.fn(() => Promise.resolve());
      const service = new PublicationService(
        createRepository(report),
        undefined,
        ingestion,
      );

      await service.publishAuto(reportId);

      expect(ingestion).not.toHaveBeenCalled();
    });

    // Characterization pin: an ingestion-hook failure is logged, never
    // rejected — the auto-publish still reports a published outcome.
    it("publishAuto logs (and swallows) an ingestion hook failure", async () => {
      const warn = vi.fn();
      const logger = {
        debug: () => undefined,
        info: () => undefined,
        warn,
        error: () => undefined,
        child: () => logger,
      };
      const ingestion = vi.fn(() => Promise.reject(new Error("queue down")));
      const service = new PublicationService(
        createRepository(assembledReport),
        logger,
        ingestion,
      );

      const result = await service.publishAuto(reportId);

      expect(result.published).toBe(true);
      expect(warn).toHaveBeenCalledWith(
        "ingestion hook failed",
        expect.objectContaining({ error: "queue down" }),
      );
    });
  });
});
