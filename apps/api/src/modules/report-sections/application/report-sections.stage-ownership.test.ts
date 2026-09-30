import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import {
  OPEN_REPORT_META,
  reportMetaReader,
} from "./__tests__/report-meta-fixture";
import {
  type ReportSectionsRepository,
  ReportSectionsService,
} from "./report-sections.service";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "./report-sections-telemetry.port.js";

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

function createRepository(
  section: ReportSectionReadModel,
): ReportSectionsRepository {
  let currentSection = structuredClone(section);

  return {
    getSectionById(reportSectionId) {
      return Promise.resolve(
        reportSectionId === currentSection.reportSectionId
          ? structuredClone(currentSection)
          : null,
      );
    },
    getReportPeriodWriteGateForSection() {
      return Promise.resolve({ periodStatus: "open", archived: false });
    },
    getReportMeta: reportMetaReader(OPEN_REPORT_META),
    getPublishedLineage() {
      return Promise.resolve({ itemStableIds: [], decisionStableIds: [] });
    },
    saveSection(nextSection) {
      currentSection = structuredClone(nextSection);

      return Promise.resolve(structuredClone(currentSection));
    },
    getMyHistoryPage() {
      return Promise.resolve({ items: [], nextCursor: null });
    },
  };
}

describe("ReportSectionsService — stage-ownership guard", () => {
  const PROJECT_P = "44444444-4444-4444-8444-444444444444";
  const CROSS_PROJECT = "77777777-7777-4777-8777-777777777777";
  const STABLE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  // The author owns ONLY the Testing stage on P (no items, so the guard sees
  // only the payload rows under test).
  const testingOwner: ReportSectionReadModel = {
    ...baseSection,
    items: [],
    projects: [
      {
        projectId: PROJECT_P,
        projectName: "Project 1",
        trafficLight: null,
        ownedStages: [
          {
            stageId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            stageName: "Testing",
            sortOrder: 0,
          },
        ],
        stageSet: [],
        ownerGroupId: null,
      },
    ],
  };

  const devOpsRisk = {
    projectId: PROJECT_P,
    risk: "Pipeline outage",
    impact: "Blocks release",
    mitigation: "Escalate to platform",
    severity: "at-risk" as const,
    stageNames: ["DevOps"],
  };

  it("rejects saveDraft when a new risk carries a stage the author does not own", async () => {
    const service = new ReportSectionsService(
      createRepository(testingOwner),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.saveDraft(
        {
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
          stageStatuses: [],
          activityStatuses: [],
          projectStatuses: [{ projectId: PROJECT_P, status: "yellow" }],
          items: [],
          risks: [devOpsRisk],
          decisions: [],
        },
        baseSection.authorId,
      ),
    ).rejects.toMatchObject({ code: "STAGE_NOT_OWNED" });
  });

  it("rejects submitSection when a new risk carries a stage the author does not own", async () => {
    const service = new ReportSectionsService(
      createRepository(testingOwner),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.submitSection(
        {
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
          confirmed: true,
          stageStatuses: [],
          activityStatuses: [],
          projectStatuses: [{ projectId: PROJECT_P, status: "green" }],
          items: [],
          risks: [devOpsRisk],
          decisions: [],
        },
        baseSection.authorId,
      ),
    ).rejects.toMatchObject({ code: "STAGE_NOT_OWNED" });
  });

  it("allows a write whose stages the author owns", async () => {
    const service = new ReportSectionsService(
      createRepository(testingOwner),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    const saved = await service.saveDraft(
      {
        reportSectionId: baseSection.reportSectionId,
        version: 1,
        status: "draft",
        stageStatuses: [],
        activityStatuses: [],
        projectStatuses: [{ projectId: PROJECT_P, status: "yellow" }],
        items: [],
        risks: [{ ...devOpsRisk, stageNames: ["Testing"] }],
        decisions: [],
      },
      baseSection.authorId,
    );

    expect(saved.status).toBe("draft");
    expect(saved.risks).toHaveLength(1);
  });

  it("scopes stage validation to the section author's owned stages", async () => {
    // The fixture supplies the section author as actor and verifies that the
    // author's ownedStages reject an unowned stage.
    const service = new ReportSectionsService(
      createRepository(testingOwner),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.saveDraft(
        {
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
          stageStatuses: [],
          activityStatuses: [],
          projectStatuses: [{ projectId: PROJECT_P, status: "yellow" }],
          items: [],
          risks: [devOpsRisk],
          decisions: [],
        },
        baseSection.authorId,
      ),
    ).rejects.toMatchObject({ code: "STAGE_NOT_OWNED" });
  });

  it("rejects a decision carrying a stage the author does not own on its product", async () => {
    // Decisions run a distinct row-mapping path (productId, null-normalization,
    // union-across-projects for a department-scoped decision), so they get their
    // own reject case.
    const service = new ReportSectionsService(
      createRepository(testingOwner),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.saveDraft(
        {
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
          stageStatuses: [],
          activityStatuses: [],
          projectStatuses: [{ projectId: PROJECT_P, status: "yellow" }],
          items: [],
          risks: [],
          decisions: [
            {
              text: "Adopt new deploy tooling",
              owner: "Lead 1",
              impact: "Faster releases",
              productId: PROJECT_P,
              stageNames: ["DevOps"],
            },
          ],
        },
        baseSection.authorId,
      ),
    ).rejects.toMatchObject({ code: "STAGE_NOT_OWNED" });
  });

  // A cross row references a product the author owns no stage on. Current
  // writes validate every product-parented row, including unchanged rows.
  const crossRowSection: ReportSectionReadModel = {
    ...testingOwner,
    referencedProjects: [
      { projectId: CROSS_PROJECT, projectName: "Payments Gateway" },
    ],
    risks: [
      {
        stableId: STABLE_ID,
        projectId: CROSS_PROJECT,
        risk: "Gateway certification slips",
        impact: "Payments blocked",
        mitigation: "Escalate to vendor",
        severity: "at-risk",
        stageNames: ["Integration"],
      },
    ],
  };

  it("rejects an unchanged cross row when its stage is not currently owned", async () => {
    const service = new ReportSectionsService(
      createRepository(crossRowSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.saveDraft(
        {
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
          stageStatuses: [],
          activityStatuses: [],
          projectStatuses: [{ projectId: PROJECT_P, status: "yellow" }],
          items: [],
          risks: [
            {
              stableId: STABLE_ID,
              projectId: CROSS_PROJECT,
              risk: "Gateway certification slips",
              impact: "Payments blocked",
              mitigation: "Escalate to vendor",
              severity: "at-risk",
              stageNames: ["Integration"],
            },
          ],
          decisions: [],
        },
        baseSection.authorId,
      ),
    ).rejects.toMatchObject({ code: "STAGE_NOT_OWNED" });
  });

  it("rejects a smuggle that reuses a stableId but swaps in an unowned stage", async () => {
    const service = new ReportSectionsService(
      createRepository(crossRowSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.saveDraft(
        {
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
          stageStatuses: [],
          activityStatuses: [],
          projectStatuses: [{ projectId: PROJECT_P, status: "yellow" }],
          items: [],
          risks: [
            {
              // Stable identity never bypasses current ownership validation.
              stableId: STABLE_ID,
              projectId: CROSS_PROJECT,
              risk: "Gateway certification slips",
              impact: "Payments blocked",
              mitigation: "Escalate to vendor",
              severity: "at-risk",
              stageNames: ["DevOps"],
            },
          ],
          decisions: [],
        },
        baseSection.authorId,
      ),
    ).rejects.toMatchObject({ code: "STAGE_NOT_OWNED" });
  });

  it("rejects a smuggle that reuses a stableId + stage set but moves the row to an unowned product", async () => {
    // The author owns Testing on P; the server row lives on P with [Testing].
    const ownedRowSection: ReportSectionReadModel = {
      ...testingOwner,
      referencedProjects: [
        { projectId: CROSS_PROJECT, projectName: "Payments Gateway" },
      ],
      risks: [
        {
          stableId: STABLE_ID,
          projectId: PROJECT_P,
          risk: "Flaky suite",
          impact: "Slows release",
          mitigation: "Stabilize",
          severity: "at-risk",
          stageNames: ["Testing"],
        },
      ],
    };
    const service = new ReportSectionsService(
      createRepository(ownedRowSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.saveDraft(
        {
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
          stageStatuses: [],
          activityStatuses: [],
          projectStatuses: [{ projectId: PROJECT_P, status: "yellow" }],
          items: [],
          risks: [
            {
              // The product changed to one the author owns no stage on;
              // Testing is not owned there.
              stableId: STABLE_ID,
              projectId: CROSS_PROJECT,
              risk: "Flaky suite",
              impact: "Slows release",
              mitigation: "Stabilize",
              severity: "at-risk",
              stageNames: ["Testing"],
            },
          ],
          decisions: [],
        },
        baseSection.authorId,
      ),
    ).rejects.toMatchObject({ code: "STAGE_NOT_OWNED" });
  });
});
