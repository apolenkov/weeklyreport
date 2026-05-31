import type {
  AssembledReport,
  DraftSavePayload,
  UserSession,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  customreportPeriodStateTransitionsTotal,
  customreportReportsSubmittedTotal,
} from "../../infrastructure/metrics/metrics.registry.js";

import { publicationRouter } from "./publication.router";
import {
  PublicationAccessError,
  type PublicationRepository,
  PublicationService,
} from "./publication.service";

const reportId = "22222222-2222-4222-8222-222222222222";

const headSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "head@customreport.local",
  name: "Department Head",
  role: "head",
  activeReportId: reportId,
  activeReportSectionId: null,
};

const leadSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000002",
  email: "lead1@customreport.local",
  name: "Lead 1",
  role: "lead",
  activeReportId: reportId,
  activeReportSectionId: "33333333-3333-4333-8333-333333333333",
};

const assembledReport: AssembledReport = {
  reportId,
  periodStart: new Date("2026-04-06T00:00:00.000Z"),
  periodEnd: new Date("2026-04-12T23:59:59.000Z"),
  deadline: new Date("2026-04-10T15:00:00.000Z"),
  status: "draft",
  publishedAt: null,
  publishedById: null,
  publishedByName: null,
  portfolioOverview: {
    status: "red",
    totals: {
      green: 1,
      yellow: 1,
      red: 1,
    },
  },
  sections: [
    {
      reportSectionId: "11111111-1111-4111-8111-111111111111",
      reportId,
      authorId: "33333333-3333-4333-8333-333333333333",
      authorName: "Lead 1",
      status: "submitted",
      submittedAt: new Date("2026-04-09T10:00:00.000Z"),
      projects: [
        {
          projectId: "44444444-4444-4444-8444-444444444444",
          projectName: "Project 1",
          trafficLight: "green",
        },
      ],
      items: [],
      risks: [],
      decisions: [],
    },
    {
      reportSectionId: "22222222-2222-4222-8222-222222222223",
      reportId,
      authorId: "33333333-3333-4333-8333-333333333334",
      authorName: "Lead 2",
      status: "draft",
      submittedAt: null,
      projects: [
        {
          projectId: "44444444-4444-4444-8444-444444444445",
          projectName: "Project 2",
          trafficLight: "yellow",
        },
      ],
      items: [],
      risks: [],
      decisions: [],
    },
    {
      reportSectionId: "22222222-2222-4222-8222-222222222224",
      reportId,
      authorId: "33333333-3333-4333-8333-333333333335",
      authorName: "Lead 3",
      status: "draft",
      submittedAt: null,
      projects: [
        {
          projectId: "44444444-4444-4444-8444-444444444446",
          projectName: "Project 3",
          trafficLight: "red",
        },
      ],
      items: [],
      risks: [],
      decisions: [],
    },
  ],
};

function createRepository(report: AssembledReport): PublicationRepository {
  let currentReport = structuredClone(report);

  return {
    async getAssembledReport(activeReportId: string) {
      if (activeReportId !== reportId) {
        return null;
      }

      return structuredClone(currentReport);
    },
    async saveAssembledReport(nextReport: AssembledReport) {
      currentReport = structuredClone(nextReport);

      return structuredClone(currentReport);
    },
  };
}

const reviewUpdate: DraftSavePayload = {
  reportSectionId: "11111111-1111-4111-8111-111111111111",
  status: "draft",
  projectStatuses: [
    {
      projectId: "44444444-4444-4444-8444-444444444444",
      status: "yellow",
    },
  ],
  items: [
    {
      projectId: "44444444-4444-4444-8444-444444444444",
      type: "current",
      text: "Reviewed current week update",
      tag: "feature",
      workflowStatus: "in_progress",
    },
  ],
  risks: [],
  decisions: [],
};

describe("PublicationService", () => {
  it("returns the assembled report for the active report", async () => {
    const service = new PublicationService(createRepository(assembledReport));

    await expect(service.getAssembledReport(reportId)).resolves.toMatchObject({
      reportId,
      status: "draft",
    });
  });

  it("keeps portfolio overview aggregation deterministic", async () => {
    const service = new PublicationService(createRepository(assembledReport));
    const report = await service.getAssembledReport(reportId);

    expect(report.portfolioOverview).toEqual({
      status: "red",
      totals: {
        green: 1,
        yellow: 1,
        red: 1,
      },
    });
  });

  it("allows section review updates before publish", async () => {
    const service = new PublicationService(createRepository(assembledReport));
    const updatedReport = await service.updateSectionForReview(
      reportId,
      reviewUpdate,
    );

    expect(updatedReport.sections[0]?.projects[0]?.trafficLight).toBe("yellow");
    expect(updatedReport.sections[0]?.items[0]?.text).toBe(
      "Reviewed current week update",
    );
  });

  it("publishes once and rejects further review changes", async () => {
    const service = new PublicationService(createRepository(assembledReport));

    const published = await service.publishReport(reportId, headSession);

    expect(published.status).toBe("published");
    expect(published.publishedById).toBe(headSession.userId);
    expect(published.publishedAt).toBeInstanceOf(Date);

    await expect(
      service.updateSectionForReview(reportId, reviewUpdate),
    ).rejects.toBeInstanceOf(PublicationAccessError);
  });

  it("rejects non-head access before returning assembled report data", async () => {
    const service = new PublicationService(createRepository(assembledReport));

    await expect(
      publicationRouter.getAssembledReport({
        publicationService: service,
        session: leadSession,
      }),
    ).rejects.toBeInstanceOf(PublicationAccessError);
  });

  // UFB-049 / Phase 50-B: scheduler-driven auto-publish bypasses session
  // attribution. publishedById stays null and publishedByName='system' so
  // the head dashboard can show a "auto-published" badge by comparing.
  it("publishAuto stamps system attribution (publishedById=null)", async () => {
    const service = new PublicationService(createRepository(assembledReport));

    const published = await service.publishAuto(reportId);

    expect(published.status).toBe("published");
    expect(published.publishedById).toBeNull();
    expect(published.publishedByName).toBe("system");
    expect(published.publishedAt).toBeInstanceOf(Date);
  });

  it("publishAuto is idempotent on already-published reports (no throw, returns current)", async () => {
    const service = new PublicationService(createRepository(assembledReport));

    const first = await service.publishAuto(reportId);
    const second = await service.publishAuto(reportId);

    expect(first.status).toBe("published");
    expect(second.status).toBe("published");
    // publishedAt should be the same instant — the second call must not
    // re-stamp a new Date(); idempotent means "no write".
    expect(second.publishedAt).toEqual(first.publishedAt);
  });

  // Phase 52-A (UFB-054): product-telemetry counters bump exactly once per
  // successful publish, for both the manual and auto paths. Both paths use
  // `state='published'` so the funnel rolls up cleanly.
  it("publishReport increments product KPI counters once on success", async () => {
    const service = new PublicationService(createRepository(assembledReport));
    const submittedBefore = await getCounterValue(
      customreportReportsSubmittedTotal,
      { state: "published" },
    );
    const transitionsBefore = await getCounterValue(
      customreportPeriodStateTransitionsTotal,
      { from: "open", to: "published" },
    );

    await service.publishReport(reportId, headSession);

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

  it("publishAuto increments product KPI counters once on success", async () => {
    const service = new PublicationService(createRepository(assembledReport));
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
});

/**
 * Helper for prom-client Counter introspection in unit tests. Avoids
 * leaking prom-client internals into every test file: the registry tracks
 * (labels → value) pairs and we just find the matching tuple.
 */
async function getCounterValue(
  counter: {
    get(): Promise<{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prom-client label record (migrated from eslint-disable)
      values: Array<{ value: number; labels: Record<string, any> }>;
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

describe("publicationRouter", () => {
  it("allows a head session to read the assembled report", async () => {
    const service = new PublicationService(createRepository(assembledReport));

    await expect(
      publicationRouter.getAssembledReport({
        publicationService: service,
        session: headSession,
      }),
    ).resolves.toMatchObject({
      reportId,
      portfolioOverview: { status: "red" },
    });
  });

  it("publishes for a head session and blocks a second publish attempt", async () => {
    const service = new PublicationService(createRepository(assembledReport));

    const published = await publicationRouter.publishReport({
      publicationService: service,
      session: headSession,
    });

    expect(published.status).toBe("published");

    await expect(
      publicationRouter.publishReport({
        publicationService: service,
        session: headSession,
      }),
    ).rejects.toBeInstanceOf(PublicationAccessError);
  });
});
