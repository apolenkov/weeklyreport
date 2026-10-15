import type { ReportSectionReadModel } from "@weeklyreport/shared";
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

  // A cross row references a product the author owns no stage on, e.g. after an
  // admin removed the assignment. Writes validate new and changed rows; a row
  // saved unchanged keeps its stored stages so one stale row cannot block the
  // whole section.
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

  it("accepts an unchanged row whose stage is no longer owned while another row is edited", async () => {
    const service = new ReportSectionsService(
      createRepository(crossRowSection),
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
        items: [
          {
            projectId: PROJECT_P,
            type: "current",
            text: "Freshly edited item",
            tag: "feature",
            workflowStatus: "in_progress",
            carriedOver: false,
            stageNames: ["Testing"],
          },
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
        decisions: [],
      },
      baseSection.authorId,
    );

    expect(saved.risks.map((risk) => risk.stageNames)).toEqual([
      ["Integration"],
    ]);
    expect(saved.items.map((item) => item.text)).toEqual([
      "Freshly edited item",
    ]);
  });

  it("rejects a row without stable identity even when it matches a stored stale row", async () => {
    // Neither side has lineage, so nothing proves the row is the stored one.
    const anonymousRowSection: ReportSectionReadModel = {
      ...crossRowSection,
      risks: crossRowSection.risks.map(
        ({ stableId: _stableId, ...risk }) => risk,
      ),
    };
    const service = new ReportSectionsService(
      createRepository(anonymousRowSection),
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

  const saveCrossRisk = (
    section: ReportSectionReadModel,
    risk: ReportSectionReadModel["risks"][number],
  ) =>
    new ReportSectionsService(
      createRepository(section),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    ).saveDraft(
      {
        reportSectionId: baseSection.reportSectionId,
        version: 1,
        status: "draft",
        stageStatuses: [],
        activityStatuses: [],
        projectStatuses: [{ projectId: PROJECT_P, status: "yellow" }],
        items: [],
        risks: [risk],
        decisions: [],
      },
      baseSection.authorId,
    );

  it("keeps an unchanged-stage row saveable when its other fields change", async () => {
    const [stored] = crossRowSection.risks;
    if (stored === undefined) throw new Error("Expected a stored risk");

    const saved = await saveCrossRisk(crossRowSection, {
      ...stored,
      risk: "Gateway certification slips again",
    });

    expect(saved.risks.map((risk) => risk.risk)).toEqual([
      "Gateway certification slips again",
    ]);
  });

  it.each([
    ["adds an unowned stage", ["Integration"], ["Integration", "DevOps"]],
    [
      "swaps a repeated stored stage for an unowned one",
      ["Integration", "Integration"],
      ["Integration", "DevOps"],
    ],
  ])(
    "rejects a reused stableId that %s",
    async (_case, storedStages, sentStages) => {
      const [stored] = crossRowSection.risks;
      if (stored === undefined) throw new Error("Expected a stored risk");
      const section: ReportSectionReadModel = {
        ...crossRowSection,
        risks: [{ ...stored, stageNames: storedStages }],
      };

      await expect(
        saveCrossRisk(section, { ...stored, stageNames: sentStages }),
      ).rejects.toMatchObject({ code: "STAGE_NOT_OWNED" });
    },
  );

  it("rejects an owned stored stage only because of the stage the payload adds", async () => {
    const [stored] = crossRowSection.risks;
    if (stored === undefined) throw new Error("Expected a stored risk");
    const ownedRow = {
      ...stored,
      projectId: PROJECT_P,
      stageNames: ["Testing"],
    };
    const section: ReportSectionReadModel = {
      ...crossRowSection,
      risks: [ownedRow],
    };

    await expect(
      saveCrossRisk(section, {
        ...ownedRow,
        stageNames: ["Testing", "DevOps"],
      }),
    ).rejects.toMatchObject({
      code: "STAGE_NOT_OWNED",
      message: expect.stringContaining('"DevOps"') as unknown,
    });
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
              // A reused stable identity with a changed stage is validated.
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
