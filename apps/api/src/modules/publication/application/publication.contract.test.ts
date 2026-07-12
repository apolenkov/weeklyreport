import type {
  AssembledReport,
  ReportSectionReadModel,
  UserSession,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  PublicationAccessError,
  type PublicationRepository,
  PublicationService,
} from "./publication.service";

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
/*  Section factory                                                    */
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

/* ------------------------------------------------------------------ */
/*  Report factory                                                     */
/* ------------------------------------------------------------------ */

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
/*  In-memory mock repository                                          */
/* ------------------------------------------------------------------ */

function createRepository(
  report: AssembledReport | null,
): PublicationRepository {
  let currentReport = report ? structuredClone(report) : null;
  // The assembled read model exposes only legacy `status`; the publish guard
  // keys on `periodStatus`, so the fake tracks it separately.
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

/* ------------------------------------------------------------------ */
/*  getAssembledReport                                                 */
/* ------------------------------------------------------------------ */

describe("PublicationService — contract tests", () => {
  describe("getAssembledReport", () => {
    it("returns assembled report with sorted sections", async () => {
      // Sections intentionally out of alphabetical order
      const report = makeReport({
        sections: [sectionCharlie, sectionAlpha, sectionBravo],
      });

      const service = new PublicationService(createRepository(report));
      const result = await service.getAssembledReport(reportId);

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

  /* ---------------------------------------------------------------- */
  /*  publishReport                                                    */
  /* ---------------------------------------------------------------- */

  describe("publishReport", () => {
    it("sets status to published, publishedAt, publishedById, publishedByName", async () => {
      const report = makeReport({
        sections: [sectionAlpha],
      });

      const service = new PublicationService(createRepository(report));
      const published = await service.publishReport(reportId, headSession);

      expect(published.status).toBe("published");
      expect(published.publishedAt).toBeInstanceOf(Date);
      expect(published.publishedById).toBe(headSession.userId);
      expect(published.publishedByName).toBe(headSession.name);
    });

    it("throws PublicationAccessError when report already published", async () => {
      const report = makeReport({
        status: "published",
        publishedAt: new Date("2026-04-10T16:00:00.000Z"),
        publishedById: headSession.userId,
        publishedByName: headSession.name,
        sections: [sectionAlpha],
      });

      const service = new PublicationService(createRepository(report));

      await expect(
        service.publishReport(reportId, headSession),
      ).rejects.toBeInstanceOf(PublicationAccessError);

      await expect(
        service.publishReport(reportId, headSession),
      ).rejects.toThrow("Report has already been published.");
    });

    it("preserves all sections and portfolio overview", async () => {
      const report = makeReport({
        sections: [sectionAlpha, sectionBravo, sectionCharlie],
      });

      const service = new PublicationService(createRepository(report));
      const published = await service.publishReport(reportId, headSession);

      expect(published.sections).toHaveLength(3);
      expect(published.portfolioOverview).toEqual({
        status: "red",
        totals: { green: 1, yellow: 1, red: 1 },
      });
      // Verify section data integrity
      expect(published.sections.map((s) => s.authorName)).toEqual([
        "Alpha Lead",
        "Bravo Lead",
        "Charlie Lead",
      ]);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  publishReport — P0/P1 regression (REV scenarios)                 */
  /* ---------------------------------------------------------------- */

  describe("publishReport — regression", () => {
    it("publish sets status to published (REV-011)", async () => {
      const report = makeReport({ sections: [sectionAlpha] });
      const service = new PublicationService(createRepository(report));

      const published = await service.publishReport(reportId, headSession);
      expect(published.status).toBe("published");
    });

    it("re-publish of already published report rejected (REV-012)", async () => {
      const report = makeReport({
        status: "published",
        publishedAt: new Date("2026-04-10T16:00:00.000Z"),
        publishedById: headSession.userId,
        publishedByName: headSession.name,
        sections: [sectionAlpha],
      });
      const service = new PublicationService(createRepository(report));

      await expect(
        service.publishReport(reportId, headSession),
      ).rejects.toThrow("Report has already been published.");
    });

    it("published report includes all lead sections data (REV-020)", async () => {
      const report = makeReport({
        sections: [sectionAlpha, sectionBravo, sectionCharlie],
      });
      const service = new PublicationService(createRepository(report));
      const published = await service.publishReport(reportId, headSession);

      expect(published.sections).toHaveLength(3);
      const names = published.sections.map((s) => s.authorName);
      expect(names).toContain("Alpha Lead");
      expect(names).toContain("Bravo Lead");
      expect(names).toContain("Charlie Lead");
    });
  });
});
