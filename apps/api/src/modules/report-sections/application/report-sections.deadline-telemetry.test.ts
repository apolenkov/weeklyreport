import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  customreportSectionsSubmittedTotal,
  customreportSectionSubmissionLatencySeconds,
} from "../../../infrastructure/metrics/metrics.registry.js";
import { createNullLogger } from "../../../lib/logger.js";
import { ReportSectionsPrometheusTelemetry } from "../infrastructure/report-sections-prometheus-telemetry.adapter.js";
import {
  type ReportSectionsRepository,
  ReportSectionsService,
} from "./report-sections.service";

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
        current = {
          ...structuredClone(next),
          late: Date.now() > deadline.getTime(),
        };
        return Promise.resolve(structuredClone(current));
      },
      getMyHistoryPage() {
        return Promise.resolve({ items: [], nextCursor: null });
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
      new ReportSectionsPrometheusTelemetry(),
      createNullLogger(),
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
      new ReportSectionsPrometheusTelemetry(),
      createNullLogger(),
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
