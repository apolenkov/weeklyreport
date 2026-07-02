import type {
  AssembledReport,
  DraftSavePayload,
  UserSession,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  customreportPeriodStateTransitionsTotal,
  customreportReportsSubmittedTotal,
} from "../../infrastructure/metrics/metrics.registry.js";
import {
  type AutoPublishResult,
  PublicationAccessError,
  PublicationArchivedError,
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
      version: 1,
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
      activities: [],
    },
    {
      reportSectionId: "22222222-2222-4222-8222-222222222223",
      reportId,
      version: 1,
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
      activities: [],
    },
    {
      reportSectionId: "22222222-2222-4222-8222-222222222224",
      reportId,
      version: 1,
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
      activities: [],
    },
  ],
};

function createRepository(report: AssembledReport): PublicationRepository {
  let currentReport = structuredClone(report);
  // The assembled read model exposes only legacy `status`; the publish guard
  // keys on `periodStatus`, so the fake tracks it separately (a reopened period
  // carries legacy status="published" with periodStatus="reopened").
  let currentPeriodStatus: "open" | "published" | "reopened" =
    report.status === "published" ? "published" : "open";

  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async PublicationRepository contract (no awaitable work in the stub)
    async getAssembledReport(activeReportId: string) {
      if (activeReportId !== reportId) {
        return null;
      }

      return structuredClone(currentReport);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async PublicationRepository contract (no awaitable work in the stub)
    async saveAssembledReport(nextReport: AssembledReport) {
      currentReport = structuredClone(nextReport);

      return structuredClone(currentReport);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async PublicationRepository contract (no awaitable work in the stub)
    async publishAssembledReport(nextReport: AssembledReport) {
      if (currentPeriodStatus === "published") {
        return {
          status: "already-published" as const,
          report: structuredClone(currentReport),
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

const reviewUpdate: DraftSavePayload = {
  reportSectionId: "11111111-1111-4111-8111-111111111111",
  version: 1,
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
      stageIds: ["Development"],
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

  // UFB-049 / Phase 50-B: scheduler-driven auto-publish bypasses session
  // attribution. publishedById stays null and publishedByName='system' so
  // the head dashboard can show a "auto-published" badge by comparing.
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

  it("publishReport labels the transition counter with the prior status (reopened, not a hardcoded open)", async () => {
    // A reopened period carries legacy status="published" with
    // periodStatus="reopened"; the from label must reflect that, never "open".
    const repository: PublicationRepository = {
      ...createRepository(assembledReport),
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async PublicationRepository contract (no awaitable work in the stub)
      async publishAssembledReport(nextReport: AssembledReport) {
        return {
          status: "transitioned" as const,
          priorPeriodStatus: "reopened" as const,
          report: structuredClone(nextReport),
        };
      },
    };
    const service = new PublicationService(repository);
    const before = await getCounterValue(
      customreportPeriodStateTransitionsTotal,
      { from: "reopened", to: "published" },
    );

    await service.publishReport(reportId, headSession);

    expect(
      await getCounterValue(customreportPeriodStateTransitionsTotal, {
        from: "reopened",
        to: "published",
      }),
    ).toBe(before + 1);
  });

  it("publishReport raced (zero-transition): returns the published report, no counters, no ingestion", async () => {
    // A concurrent publish won the compare-and-set. Idempotent success: the
    // report comes back published, but this call emits no counters and enqueues
    // no ingestion, so a redundant publish never inflates the ratio.
    const ingestion = vi.fn(() => Promise.resolve());
    const repository: PublicationRepository = {
      ...createRepository(assembledReport),
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async PublicationRepository contract (no awaitable work in the stub)
      async publishAssembledReport(nextReport: AssembledReport) {
        return {
          status: "raced" as const,
          report: { ...structuredClone(nextReport), status: "published" },
        };
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

    const published = await service.publishReport(reportId, headSession);

    expect(published.status).toBe("published");
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

  it("publishReport archived-in-window: throws PublicationArchivedError, no counters, no ingestion", async () => {
    // The period was archived inside the read→write window: the guarded
    // compare-and-set matched zero rows and the re-read showed the row archived.
    // Fail closed (FORBIDDEN), never a silent idempotent success.
    const ingestion = vi.fn(() => Promise.resolve());
    const repository: PublicationRepository = {
      ...createRepository(assembledReport),
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async PublicationRepository contract (no awaitable work in the stub)
      async publishAssembledReport(nextReport: AssembledReport) {
        return {
          status: "archived" as const,
          report: structuredClone(nextReport),
        };
      },
    };
    const service = new PublicationService(repository, undefined, ingestion);
    const submittedBefore = await getCounterValue(
      customreportReportsSubmittedTotal,
      { state: "published" },
    );

    await expect(
      service.publishReport(reportId, headSession),
    ).rejects.toBeInstanceOf(PublicationArchivedError);

    expect(ingestion).not.toHaveBeenCalled();
    expect(
      await getCounterValue(customreportReportsSubmittedTotal, {
        state: "published",
      }),
    ).toBe(submittedBefore);
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
