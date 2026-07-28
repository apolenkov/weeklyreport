import type {
  PeriodStatus,
  ReportSectionReadModel,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  ReportSectionDomainError,
  type ReportSectionsRepository,
  ReportSectionsService,
} from "./report-sections.service";

const testGraceSettings = () =>
  Promise.resolve({ gracePeriodHours: 0, allowLateSubmissions: true });

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID_1 = "44444444-4444-4444-8444-444444444444";
const PROJECT_ID_2 = "55555555-5555-4555-8555-555555555555";

const baseSection: ReportSectionReadModel = {
  reportSectionId: SECTION_ID,
  reportId: REPORT_ID,
  authorId: AUTHOR_ID,
  authorName: "Lead 1",
  version: 1,
  status: "draft",
  submittedAt: null,
  projects: [
    {
      projectId: PROJECT_ID_1,
      projectName: "Project Alpha",
      trafficLight: null,
      // the author owns the Development stage
      // on this project, so the write payloads (stageIds: ["Development"]) pass
      // the stage-ownership guard.
      ownedStages: [
        {
          stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          stageName: "Development",
          sortOrder: 0,
        },
      ],
    },
  ],
  items: [
    {
      projectId: PROJECT_ID_1,
      type: "current",
      text: "Deliver feature X",
      tag: "feature",
      workflowStatus: "in_progress",
      carriedOver: false,
      // items carry ≥1 stage on write.
      stageIds: ["Development"],
    },
  ],
  risks: [],
  decisions: [],
  activities: [],
};

// read-model item types stageIds optional;
// the write payloads below require it. Expose a stage-guaranteed copy.
const writeItems = baseSection.items.map((it) => ({
  ...it,
  stageIds: it.stageIds ?? [],
}));

function createRepository(
  section: ReportSectionReadModel,
  periodStatus: PeriodStatus = "open",
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
    getReportPeriodStatusForSection() {
      return Promise.resolve(periodStatus);
    },
    getReportMeta() {
      return Promise.resolve(null);
    },
    getPublishedLineage() {
      return Promise.resolve({ itemStableIds: [], decisionStableIds: [] });
    },
    saveSection(nextSection) {
      currentSection = structuredClone(nextSection);
      return Promise.resolve(structuredClone(currentSection));
    },
    getMyHistoryRows() {
      return Promise.resolve([]);
    },
  };
}

function validDraft(overrides: Record<string, unknown> = {}) {
  return {
    reportSectionId: SECTION_ID,
    version: 1,
    status: "draft" as const,
    projectStatuses: [{ projectId: PROJECT_ID_1, status: "green" as const }],
    items: writeItems,
    risks: [],
    decisions: [],
    ...overrides,
  };
}

describe("ReportSectionsService — getActiveSection", () => {
  it("returns section when found", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );
    const section = await service.getActiveSection(SECTION_ID);

    expect(section.reportSectionId).toBe(SECTION_ID);
    expect(section.authorName).toBe("Lead 1");
  });

  it("throws when section ID does not exist", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );

    await expect(
      service.getActiveSection("99999999-9999-4999-8999-999999999999"),
    ).rejects.toThrow("was not found");
  });

  it("returns submitted section (read-only, no error)", async () => {
    const submitted: ReportSectionReadModel = {
      ...baseSection,
      status: "submitted",
      submittedAt: new Date("2026-04-06T12:00:00Z"),
      projects: [
        { ...expectDefined(baseSection.projects[0]), trafficLight: "green" },
      ],
    };
    const service = new ReportSectionsService(
      createRepository(submitted),
      testGraceSettings,
    );
    const result = await service.getActiveSection(SECTION_ID);

    expect(result.status).toBe("submitted");
    expect(result.submittedAt).toBeInstanceOf(Date);
  });

  it("validates section through Zod schema (reportSectionReadModelSchema)", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );
    const result = await service.getActiveSection(SECTION_ID);

    expect(typeof result.reportSectionId).toBe("string");
    expect(typeof result.reportId).toBe("string");
    expect(Array.isArray(result.projects)).toBe(true);
    expect(Array.isArray(result.items)).toBe(true);
  });
});

describe("ReportSectionsService — saveDraft happy path", () => {
  it("updates traffic light status", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );
    const saved = await service.saveDraft(
      validDraft({
        projectStatuses: [{ projectId: PROJECT_ID_1, status: "yellow" }],
      }),
    );

    expect(saved.projects[0]?.trafficLight).toBe("yellow");
  });

  it("updates items list", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );
    const newItems = [
      ...baseSection.items,
      {
        projectId: PROJECT_ID_1,
        type: "next" as const,
        text: "Plan feature Y",
        tag: "planning",
        workflowStatus: "planned" as const,
        carriedOver: false,
        stageIds: ["Development"],
      },
    ];
    const saved = await service.saveDraft(validDraft({ items: newItems }));

    expect(saved.items).toHaveLength(2);
  });

  it("updates risks list", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );
    const saved = await service.saveDraft(
      validDraft({
        risks: [
          {
            projectId: PROJECT_ID_1,
            risk: "Deadline risk",
            impact: "Revenue",
            mitigation: "Hire contractor",
            severity: "at-risk",
            // stageIds is required (min 1) on writes.
            stageIds: ["Development"],
          },
        ],
      }),
    );

    expect(saved.risks).toHaveLength(1);
    expect(saved.risks[0]?.risk).toBe("Deadline risk");
  });

  it("updates decisions list", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );
    const saved = await service.saveDraft(
      validDraft({
        decisions: [
          {
            // a decision now needs exactly one parent;
            // product-parent it (stageIds is then required, as here).
            productId: PROJECT_ID_1,
            text: "Upgrade DB",
            owner: "Alice",
            impact: "Better performance",
            stageIds: ["Development"],
          },
        ],
      }),
    );

    expect(saved.decisions).toHaveLength(1);
    expect(saved.decisions[0]?.owner).toBe(baseSection.authorName);
  });

  it("preserves draft status after save", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );
    const saved = await service.saveDraft(validDraft());

    expect(saved.status).toBe("draft");
    expect(saved.submittedAt).toBeNull();
  });

  it("clears traffic light when status is undefined (draft allows optional)", async () => {
    const withLight: ReportSectionReadModel = {
      ...baseSection,
      projects: [
        { ...expectDefined(baseSection.projects[0]), trafficLight: "green" },
      ],
    };
    const service = new ReportSectionsService(
      createRepository(withLight),
      testGraceSettings,
    );
    const saved = await service.saveDraft(
      validDraft({
        projectStatuses: [{ projectId: PROJECT_ID_1 }],
      }),
    );

    expect(saved.projects[0]?.trafficLight).toBeNull();
  });
});

describe("ReportSectionsService — saveDraft error paths", () => {
  it("rejects when section is already submitted", async () => {
    const submitted: ReportSectionReadModel = {
      ...baseSection,
      status: "submitted",
      submittedAt: new Date("2026-04-06T12:00:00Z"),
      projects: [
        { ...expectDefined(baseSection.projects[0]), trafficLight: "green" },
      ],
    };
    const service = new ReportSectionsService(
      createRepository(submitted),
      testGraceSettings,
    );

    await expect(service.saveDraft(validDraft())).rejects.toMatchObject({
      code: "SECTION_ALREADY_SUBMITTED",
      message: "Submitted sections are read-only.",
    });
  });

  it("rejects when the period is published", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection, "published"),
      testGraceSettings,
    );

    await expect(service.saveDraft(validDraft())).rejects.toMatchObject({
      code: "SECTION_ALREADY_SUBMITTED",
      message: "Cannot edit sections of a published report.",
    });
  });

  it("rejects when section ID does not exist", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );

    await expect(
      service.saveDraft(
        validDraft({
          reportSectionId: "99999999-9999-4999-8999-999999999999",
        }),
      ),
    ).rejects.toThrow("was not found");
  });

  it("thrown error is ReportSectionDomainError for business rule violations", async () => {
    const submitted: ReportSectionReadModel = {
      ...baseSection,
      status: "submitted",
      submittedAt: new Date("2026-04-06T12:00:00Z"),
      projects: [
        { ...expectDefined(baseSection.projects[0]), trafficLight: "green" },
      ],
    };
    const service = new ReportSectionsService(
      createRepository(submitted),
      testGraceSettings,
    );

    try {
      await service.saveDraft(validDraft());
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ReportSectionDomainError);
    }
  });

  it("rejects items exceeding max array length (Zod: max 100)", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );
    const tooManyItems = Array.from({ length: 101 }, () => ({
      projectId: PROJECT_ID_1,
      type: "current" as const,
      text: "Item",
      tag: "tag",
      workflowStatus: "in_progress" as const,
      carriedOver: false,
      stageIds: ["Development"],
    }));

    await expect(
      service.saveDraft(validDraft({ items: tooManyItems })),
    ).rejects.toThrow();
  });

  it("rejects item with empty text (safeText min 1)", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );

    await expect(
      service.saveDraft(
        validDraft({
          items: [
            {
              projectId: PROJECT_ID_1,
              type: "current",
              text: "",
              tag: "bug",
              workflowStatus: "in_progress",
              carriedOver: false,
              stageIds: ["Development"],
            },
          ],
        }),
      ),
    ).rejects.toThrow();
  });

  it("rejects item with null byte in text", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );

    await expect(
      service.saveDraft(
        validDraft({
          items: [
            {
              projectId: PROJECT_ID_1,
              type: "current",
              text: "Hello\u0000World",
              tag: "bug",
              workflowStatus: "in_progress",
              carriedOver: false,
              stageIds: ["Development"],
            },
          ],
        }),
      ),
    ).rejects.toThrow();
  });

  it("rejects invalid UUID in reportSectionId", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );

    await expect(
      service.saveDraft(validDraft({ reportSectionId: "not-a-uuid" })),
    ).rejects.toThrow();
  });
});

describe("ReportSectionsService — multi-project", () => {
  const multiProjectSection: ReportSectionReadModel = {
    ...baseSection,
    projects: [
      {
        projectId: PROJECT_ID_1,
        projectName: "Project Alpha",
        trafficLight: null,
        // author owns Development on both
        // projects so the Development-staged items pass the ownership guard.
        ownedStages: [
          {
            stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            stageName: "Development",
            sortOrder: 0,
          },
        ],
      },
      {
        projectId: PROJECT_ID_2,
        projectName: "Project Beta",
        trafficLight: null,
        ownedStages: [
          {
            stageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            stageName: "Development",
            sortOrder: 0,
          },
        ],
      },
    ],
    items: [
      {
        projectId: PROJECT_ID_1,
        type: "current",
        text: "Alpha task",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageIds: ["Development"],
      },
      {
        projectId: PROJECT_ID_2,
        type: "current",
        text: "Beta task",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageIds: ["Development"],
      },
    ],
  };

  // stage-guaranteed copy for write payloads.
  const multiWriteItems = multiProjectSection.items.map((it) => ({
    ...it,
    stageIds: it.stageIds ?? [],
  }));

  it("saveDraft updates traffic lights for multiple projects", async () => {
    const service = new ReportSectionsService(
      createRepository(multiProjectSection),
      testGraceSettings,
    );
    const saved = await service.saveDraft({
      reportSectionId: SECTION_ID,
      version: 1,
      status: "draft",
      projectStatuses: [
        { projectId: PROJECT_ID_1, status: "green" },
        { projectId: PROJECT_ID_2, status: "yellow" },
      ],
      items: multiWriteItems,
      risks: [],
      decisions: [],
    });

    expect(saved.projects[0]?.trafficLight).toBe("green");
    expect(saved.projects[1]?.trafficLight).toBe("yellow");
  });

  it("submit requires traffic light for EVERY project", async () => {
    const service = new ReportSectionsService(
      createRepository(multiProjectSection),
      testGraceSettings,
    );

    await expect(
      service.submitSection({
        reportSectionId: SECTION_ID,
        version: 1,
        status: "draft",
        confirmed: true,
        projectStatuses: [{ projectId: PROJECT_ID_1, status: "green" }],
        items: multiWriteItems,
        risks: [],
        decisions: [],
      }),
    ).rejects.toMatchObject({ code: "MISSING_TRAFFIC_LIGHT" });
  });

  it("submit requires current item for EVERY project", async () => {
    const service = new ReportSectionsService(
      createRepository(multiProjectSection),
      testGraceSettings,
    );

    await expect(
      service.submitSection({
        reportSectionId: SECTION_ID,
        version: 1,
        status: "draft",
        confirmed: true,
        projectStatuses: [
          { projectId: PROJECT_ID_1, status: "green" },
          { projectId: PROJECT_ID_2, status: "yellow" },
        ],
        items: [
          {
            projectId: PROJECT_ID_1,
            type: "current",
            text: "Only for Alpha",
            tag: "feature",
            workflowStatus: "in_progress",
            carriedOver: false,
            stageIds: ["Development"],
          },
        ],
        risks: [],
        decisions: [],
      }),
    ).rejects.toMatchObject({ code: "MISSING_CURRENT_ITEM" });
  });

  it("submit succeeds when all projects have traffic light and current item", async () => {
    const service = new ReportSectionsService(
      createRepository(multiProjectSection),
      testGraceSettings,
    );
    const result = await service.submitSection({
      reportSectionId: SECTION_ID,
      version: 1,
      status: "draft",
      confirmed: true,
      projectStatuses: [
        { projectId: PROJECT_ID_1, status: "green" },
        { projectId: PROJECT_ID_2, status: "red" },
      ],
      items: multiWriteItems,
      risks: [],
      decisions: [],
    });

    expect(result.status).toBe("submitted");
    expect(result.projects[0]?.trafficLight).toBe("green");
    expect(result.projects[1]?.trafficLight).toBe("red");
  });
});

describe("ReportSectionsService — edge cases", () => {
  it("saveDraft with empty items/risks/decisions is allowed", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );
    const saved = await service.saveDraft(
      validDraft({
        items: [],
        risks: [],
        decisions: [],
      }),
    );

    expect(saved.items).toHaveLength(0);
    expect(saved.risks).toHaveLength(0);
    expect(saved.decisions).toHaveLength(0);
  });

  it("saveDraft is idempotent — same input twice produces same result", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );
    const first = await service.saveDraft(validDraft());
    const second = await service.saveDraft(validDraft());

    expect(first.projects[0]?.trafficLight).toBe(
      second.projects[0]?.trafficLight,
    );
    expect(first.items).toHaveLength(second.items.length);
  });

  it("section with max boundary items (100) can be saved", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );
    const maxItems = Array.from({ length: 100 }, (_, i) => ({
      projectId: PROJECT_ID_1,
      type: "current" as const,
      text: `Item ${i + 1}`,
      tag: "feature",
      workflowStatus: "in_progress" as const,
      carriedOver: false,
      stageIds: ["Development"],
    }));
    const saved = await service.saveDraft(validDraft({ items: maxItems }));

    expect(saved.items).toHaveLength(100);
  });

  it("draft save preserves project list from section (not from input)", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );
    const saved = await service.saveDraft(
      validDraft({
        projectStatuses: [],
      }),
    );

    // Projects come from the section, not input
    expect(saved.projects).toHaveLength(1);
    expect(saved.projects[0]?.projectName).toBe("Project Alpha");
    // But traffic light is cleared since no matching status in input
    expect(saved.projects[0]?.trafficLight).toBeNull();
  });
});
