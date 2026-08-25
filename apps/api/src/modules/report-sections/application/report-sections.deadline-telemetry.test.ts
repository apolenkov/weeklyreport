import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  customreportSectionsSubmittedTotal,
  customreportSectionSubmissionLatencySeconds,
} from "../../../infrastructure/metrics/metrics.registry.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { ReportSectionsPrometheusTelemetry } from "../infrastructure/report-sections-prometheus-telemetry.adapter.js";
import {
  ReportSectionAccessError,
  ReportSectionNotFoundError,
  type ReportSectionsRepository,
  ReportSectionsService,
} from "./report-sections.service";

const testGraceSettings = () =>
  Promise.resolve({ gracePeriodHours: 0, allowLateSubmissions: true });

// Deadlines in these suites are expressed as offsets from now.
const ONE_HOUR = 60 * 60 * 1000;

const baseSection: ReportSectionReadModel = {
  reportSectionId: "11111111-1111-4111-8111-111111111111",
  reportId: "22222222-2222-4222-8222-222222222222",
  authorId: "33333333-3333-4333-8333-333333333333",
  authorName: "Lead 1",
  authorRole: "lead",
  version: 1,
  status: "draft",
  submittedAt: null,
  late: false,
  projects: [
    {
      projectId: "44444444-4444-4444-8444-444444444444",
      projectName: "Project 1",
      trafficLight: null,
      // the author owns the Development stage
      // on this project, so the seeded write payloads (stageNames: ["Development"])
      // pass the ownership guard.
      ownedStages: [
        {
          stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          stageName: "Development",
          sortOrder: 0,
        },
      ],
      stageSet: [],
      ownerGroupId: null,
    },
  ],
  referencedProjects: [],
  items: [
    {
      projectId: "44444444-4444-4444-8444-444444444444",
      type: "current",
      text: "Current item",
      tag: "feature",
      workflowStatus: "in_progress",
      carriedOver: false,
      // items carry ≥1 stage on write;
      // validSubmitPayload() reuses these items as a submit payload.
      stageNames: ["Development"],
    },
  ],
  risks: [],
  decisions: [],
  activities: [],
  reviews: [],
};

// the read-model item types stageNames as
// optional, but draft-save/submit payloads require it. Expose a stage-guaranteed
// copy of the seeded items for the write-path test payloads below.
const writeItems = baseSection.items.map((it) => ({
  ...it,
  stageNames: it.stageNames ?? [],
}));

describe("ReportSectionsService — deadline gate", () => {
  function createGracedRepository(opts: {
    section?: ReportSectionReadModel;
    deadline: Date;
  }): ReportSectionsRepository {
    const section = structuredClone(opts.section ?? baseSection);
    // Make the section's traffic light filled so the content validator
    // doesn't fire — we want to test the deadline gate in isolation.
    const fixed: ReportSectionReadModel = {
      ...section,
      projects: section.projects.map((p) => ({
        ...p,
        trafficLight: "green",
      })),
    };
    let currentSection = fixed;
    const getReportMeta = vi.fn().mockResolvedValue({
      status: "draft" as const,
      deadline: opts.deadline,
    });
    return {
      getSectionById(id) {
        return Promise.resolve(
          id === currentSection.reportSectionId
            ? structuredClone(currentSection)
            : null,
        );
      },
      getReportPeriodWriteGateForSection() {
        return Promise.resolve({ periodStatus: "open", archived: false });
      },
      getReportMeta,
      getPublishedLineage() {
        return Promise.resolve({ itemStableIds: [], decisionStableIds: [] });
      },
      saveSection(next) {
        currentSection = structuredClone(next);
        return Promise.resolve(structuredClone(currentSection));
      },
      getMyHistoryRows() {
        return Promise.resolve([]);
      },
    };
  }

  function validSubmitPayload() {
    return {
      reportSectionId: baseSection.reportSectionId,
      version: 1,
      status: "draft" as const,
      confirmed: true as const,
      stageStatuses: [],
      activityStatuses: [],
      projectStatuses: [
        {
          projectId: expectDefined(baseSection.projects[0]).projectId,
          status: "green" as const,
        },
      ],
      items: writeItems,
      risks: [],
      decisions: [],
    };
  }

  it("before deadline: submits with late=false (gate fully bypassed)", async () => {
    const repo = createGracedRepository({
      deadline: new Date(Date.now() + 24 * ONE_HOUR),
    });
    const service = new ReportSectionsService(repo, () =>
      Promise.resolve({ gracePeriodHours: 24, allowLateSubmissions: false }),
    );

    const saved = await service.submitSection(
      validSubmitPayload(),
      baseSection.authorId,
    );

    expect(saved.status).toBe("submitted");
    expect(saved.late).toBe(false);
    expect(repo.getReportMeta).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      label: "past deadline within grace + allowLate=true",
      hoursPast: 1,
      allowLateSubmissions: true,
    },
    {
      label:
        "past deadline within grace + allowLate=false (grace still permissive)",
      hoursPast: 1,
      allowLateSubmissions: false,
    },
    {
      label: "past grace window + allowLate=true",
      hoursPast: 48,
      allowLateSubmissions: true,
    },
  ] as const)(
    "$label: submits with late=true",
    async ({ hoursPast, allowLateSubmissions }) => {
      const repo = createGracedRepository({
        deadline: new Date(Date.now() - hoursPast * ONE_HOUR),
      });
      const service = new ReportSectionsService(repo, () =>
        Promise.resolve({ gracePeriodHours: 24, allowLateSubmissions }),
      );

      const saved = await service.submitSection(
        validSubmitPayload(),
        baseSection.authorId,
      );

      expect(saved.status).toBe("submitted");
      expect(saved.late).toBe(true);
    },
  );

  it("past grace window + allowLate=false: 403 ReportSectionAccessError", async () => {
    const repo = createGracedRepository({
      deadline: new Date(Date.now() - 48 * ONE_HOUR),
    });
    const service = new ReportSectionsService(repo, () =>
      Promise.resolve({ gracePeriodHours: 24, allowLateSubmissions: false }),
    );

    await expect(
      service.submitSection(validSubmitPayload(), baseSection.authorId),
    ).rejects.toBeInstanceOf(ReportSectionAccessError);
  });

  it("a period with an explicitly cleared deadline stamps late=false past any date (ruling F16)", async () => {
    // deadline: null is a real domain state (admin cleared it) — no reference
    // point, so nothing is ever late and the gate never throws.
    const repo = {
      ...createGracedRepository({
        deadline: new Date(Date.now() - 48 * ONE_HOUR),
      }),
      getReportMeta: () =>
        Promise.resolve({ status: "draft" as const, deadline: null }),
    };
    const service = new ReportSectionsService(repo, () =>
      Promise.resolve({ gracePeriodHours: 0, allowLateSubmissions: false }),
    );

    const saved = await service.submitSection(
      validSubmitPayload(),
      baseSection.authorId,
    );

    expect(saved.status).toBe("submitted");
    expect(saved.late).toBe(false);
  });

  it("fails closed when report meta is missing — never an un-gated submission", async () => {
    // The section exists, so its report row must too; a null meta is a
    // mid-flight deletion / integrity failure, surfaced as NOT_FOUND, never a
    // silent pass-through to an on-time submission.
    const repo = {
      ...createGracedRepository({
        deadline: new Date(Date.now() - 48 * ONE_HOUR),
      }),
      getReportMeta: () => Promise.resolve(null),
    };
    const service = new ReportSectionsService(repo, testGraceSettings);

    await expect(
      service.submitSection(validSubmitPayload(), baseSection.authorId),
    ).rejects.toBeInstanceOf(ReportSectionNotFoundError);
  });
});

// Verifies the submit path bumps `customreport_sections_submitted_total{late}`
// with the stamped label and observes a positive latency-histogram value when
// the submission lands AFTER the deadline.
describe("ReportSectionsService — product telemetry", () => {
  function buildRepo(deadline: Date): ReportSectionsRepository {
    const section: ReportSectionReadModel = {
      reportSectionId: "11111111-1111-4111-8111-111111111111",
      reportId: "22222222-2222-4222-8222-222222222222",
      authorId: "33333333-3333-4333-8333-333333333333",
      authorName: "Lead 1",
      authorRole: "lead",
      version: 1,
      status: "draft",
      submittedAt: null,
      late: false,
      projects: [
        {
          projectId: "44444444-4444-4444-8444-444444444444",
          projectName: "Project 1",
          trafficLight: "green",
          // the submitted item carries the
          // Development stage, so the author must own it to pass the guard.
          ownedStages: [
            {
              stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              stageName: "Development",
              sortOrder: 0,
            },
          ],
          stageSet: [],
          ownerGroupId: null,
        },
      ],
      referencedProjects: [],
      items: [],
      risks: [],
      decisions: [],
      activities: [],
      reviews: [],
    };
    let current = section;
    return {
      getSectionById(id) {
        return Promise.resolve(
          id === current.reportSectionId ? structuredClone(current) : null,
        );
      },
      getReportPeriodWriteGateForSection() {
        return Promise.resolve({ periodStatus: "open", archived: false });
      },
      getReportMeta() {
        return Promise.resolve({ status: "draft" as const, deadline });
      },
      getPublishedLineage() {
        return Promise.resolve({ itemStableIds: [], decisionStableIds: [] });
      },
      saveSection(next) {
        current = structuredClone(next);
        return Promise.resolve(structuredClone(current));
      },
      getMyHistoryRows() {
        return Promise.resolve([]);
      },
    };
  }

  it("increments late=false counter and observes a negative latency when submitted before deadline", async () => {
    const before = await counterValue(customreportSectionsSubmittedTotal, {
      late: "false",
    });
    const histBefore = await histogramSum(
      customreportSectionSubmissionLatencySeconds,
    );

    const service = new ReportSectionsService(
      buildRepo(new Date(Date.now() + 6 * ONE_HOUR)),
      () =>
        Promise.resolve({ gracePeriodHours: 24, allowLateSubmissions: false }),
      new ReportSectionsPrometheusTelemetry(),
    );
    await service.submitSection(
      {
        reportSectionId: "11111111-1111-4111-8111-111111111111",
        version: 1,
        status: "draft" as const,
        confirmed: true as const,
        stageStatuses: [],
        activityStatuses: [],
        projectStatuses: [
          {
            projectId: "44444444-4444-4444-8444-444444444444",
            status: "green" as const,
          },
        ],
        items: [
          {
            projectId: "44444444-4444-4444-8444-444444444444",
            type: "current" as const,
            text: "Current item",
            tag: "feature" as const,
            workflowStatus: "in_progress" as const,
            carriedOver: false,
            // items carry ≥1 stage on write.
            stageNames: ["Development"],
          },
        ],
        risks: [],
        decisions: [],
      },
      baseSection.authorId,
    );

    expect(
      await counterValue(customreportSectionsSubmittedTotal, {
        late: "false",
      }),
    ).toBe(before + 1);
    // sum delta must be negative (submitted ahead of deadline).
    const histAfter = await histogramSum(
      customreportSectionSubmissionLatencySeconds,
    );
    expect(histAfter - histBefore).toBeLessThan(0);
  });

  it("increments late=true counter when submission lands past deadline", async () => {
    const before = await counterValue(customreportSectionsSubmittedTotal, {
      late: "true",
    });

    const service = new ReportSectionsService(
      buildRepo(new Date(Date.now() - 2 * ONE_HOUR)),
      () =>
        Promise.resolve({ gracePeriodHours: 24, allowLateSubmissions: true }),
      new ReportSectionsPrometheusTelemetry(),
    );
    await service.submitSection(
      {
        reportSectionId: "11111111-1111-4111-8111-111111111111",
        version: 1,
        status: "draft" as const,
        confirmed: true as const,
        stageStatuses: [],
        activityStatuses: [],
        projectStatuses: [
          {
            projectId: "44444444-4444-4444-8444-444444444444",
            status: "green" as const,
          },
        ],
        items: [
          {
            projectId: "44444444-4444-4444-8444-444444444444",
            type: "current" as const,
            text: "Current item",
            tag: "feature" as const,
            workflowStatus: "in_progress" as const,
            carriedOver: false,
            // items carry ≥1 stage on write.
            stageNames: ["Development"],
          },
        ],
        risks: [],
        decisions: [],
      },
      baseSection.authorId,
    );

    expect(
      await counterValue(customreportSectionsSubmittedTotal, {
        late: "true",
      }),
    ).toBe(before + 1);
  });
});

async function counterValue(
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

async function histogramSum(hist: {
  get(): Promise<{ values: { value: number; metricName?: string }[] }>;
}): Promise<number> {
  const snapshot = await hist.get();
  const sum = snapshot.values.find((e) => e.metricName?.endsWith("_sum"));
  return sum?.value ?? 0;
}
