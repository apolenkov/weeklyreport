import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  AUTHOR_ID,
  baseSection,
  createRepository,
  PROJECT_ID_1,
  PROJECT_ID_2,
  SECTION_ID,
  validDraft,
} from "./report-sections.contract.fixtures";
import {
  ReportSectionDomainError,
  ReportSectionNotFoundError,
  ReportSectionsService,
} from "./report-sections.service";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "./report-sections-telemetry.port.js";

describe("ReportSectionsService — getActiveSection", () => {
  it("returns section when found", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const section = await service.getActiveSection(SECTION_ID);

    expect(section.reportSectionId).toBe(SECTION_ID);
    expect(section.authorName).toBe("Lead 1");
  });

  it("throws when section ID does not exist", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.getActiveSection("99999999-9999-4999-8999-999999999999"),
    ).rejects.toBeInstanceOf(ReportSectionNotFoundError);
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
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const result = await service.getActiveSection(SECTION_ID);

    expect(result.status).toBe("submitted");
    expect(result.submittedAt).toBeInstanceOf(Date);
  });

  it("validates section through Zod schema (reportSectionReadModelSchema)", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
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
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const saved = await service.saveDraft(
      validDraft({
        projectStatuses: [{ projectId: PROJECT_ID_1, status: "yellow" }],
      }),
      AUTHOR_ID,
    );

    expect(saved.projects[0]?.trafficLight).toBe("yellow");
  });

  it("updates items list", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
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
        stageNames: ["Development"],
      },
    ];
    const saved = await service.saveDraft(
      validDraft({ items: newItems }),
      AUTHOR_ID,
    );

    expect(saved.items).toHaveLength(2);
  });

  it("updates risks list", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
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
            // stageNames is required (min 1) on writes.
            stageNames: ["Development"],
          },
        ],
      }),
      AUTHOR_ID,
    );

    expect(saved.risks).toHaveLength(1);
    expect(saved.risks[0]?.risk).toBe("Deadline risk");
  });

  it("updates decisions list", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const saved = await service.saveDraft(
      validDraft({
        decisions: [
          {
            // A decision has exactly one parent; product-parented decisions
            // carry their required stageNames.
            productId: PROJECT_ID_1,
            text: "Upgrade DB",
            owner: "Alice",
            impact: "Better performance",
            stageNames: ["Development"],
          },
        ],
      }),
      AUTHOR_ID,
    );

    expect(saved.decisions).toHaveLength(1);
    expect(saved.decisions[0]?.owner).toBe(baseSection.authorName);
  });

  it("preserves draft status after save", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const saved = await service.saveDraft(validDraft(), AUTHOR_ID);

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
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const saved = await service.saveDraft(
      validDraft({
        projectStatuses: [{ projectId: PROJECT_ID_1 }],
      }),
      AUTHOR_ID,
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
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.saveDraft(validDraft(), AUTHOR_ID),
    ).rejects.toMatchObject({
      code: "SECTION_ALREADY_SUBMITTED",
      message: "Submitted sections are read-only.",
    });
  });

  it("rejects when the period is published", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection, "published"),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.saveDraft(validDraft(), AUTHOR_ID),
    ).rejects.toMatchObject({
      code: "SECTION_ALREADY_SUBMITTED",
      message: "Cannot edit sections of a published report.",
    });
  });

  it("rejects when the period lookup returns null", async () => {
    const repository = createRepository(baseSection, null);
    const service = new ReportSectionsService(
      repository,
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.saveDraft(validDraft(), AUTHOR_ID),
    ).rejects.toBeInstanceOf(ReportSectionNotFoundError);
  });

  it("rejects when section ID does not exist", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.saveDraft(
        validDraft({
          reportSectionId: "99999999-9999-4999-8999-999999999999",
        }),
        AUTHOR_ID,
      ),
    ).rejects.toBeInstanceOf(ReportSectionNotFoundError);
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
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    try {
      await service.saveDraft(validDraft(), AUTHOR_ID);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ReportSectionDomainError);
    }
  });

  it("rejects items exceeding max array length (Zod: max 100)", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const tooManyItems = Array.from({ length: 101 }, () => ({
      projectId: PROJECT_ID_1,
      type: "current" as const,
      text: "Item",
      tag: "tag",
      workflowStatus: "in_progress" as const,
      carriedOver: false,
      stageNames: ["Development"],
    }));

    await expect(
      service.saveDraft(validDraft({ items: tooManyItems }), AUTHOR_ID),
    ).rejects.toThrow();
  });

  it("rejects item with empty text (safeText min 1)", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
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
              stageNames: ["Development"],
            },
          ],
        }),
        AUTHOR_ID,
      ),
    ).rejects.toThrow();
  });

  it("rejects item with null byte in text", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
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
              stageNames: ["Development"],
            },
          ],
        }),
        AUTHOR_ID,
      ),
    ).rejects.toThrow();
  });

  it("rejects invalid UUID in reportSectionId", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.saveDraft(
        validDraft({ reportSectionId: "not-a-uuid" }),
        AUTHOR_ID,
      ),
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
        stageSet: [],
        ownerGroupId: null,
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
        stageSet: [],
        ownerGroupId: null,
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
        stageNames: ["Development"],
      },
      {
        projectId: PROJECT_ID_2,
        type: "current",
        text: "Beta task",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageNames: ["Development"],
      },
    ],
  };

  it("saveDraft updates traffic lights for multiple projects", async () => {
    const service = new ReportSectionsService(
      createRepository(multiProjectSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const saved = await service.saveDraft(
      {
        reportSectionId: SECTION_ID,
        version: 1,
        status: "draft",
        stageStatuses: [],
        activityStatuses: [],
        projectStatuses: [
          { projectId: PROJECT_ID_1, status: "green" },
          { projectId: PROJECT_ID_2, status: "yellow" },
        ],
        items: multiProjectSection.items,
        risks: [],
        decisions: [],
      },
      AUTHOR_ID,
    );

    expect(saved.projects[0]?.trafficLight).toBe("green");
    expect(saved.projects[1]?.trafficLight).toBe("yellow");
  });

  it("submit requires traffic light for EVERY project", async () => {
    const service = new ReportSectionsService(
      createRepository(multiProjectSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.submitSection(
        {
          reportSectionId: SECTION_ID,
          version: 1,
          status: "draft",
          confirmed: true,
          stageStatuses: [],
          activityStatuses: [],
          projectStatuses: [{ projectId: PROJECT_ID_1, status: "green" }],
          items: multiProjectSection.items,
          risks: [],
          decisions: [],
        },
        AUTHOR_ID,
      ),
    ).rejects.toMatchObject({ code: "MISSING_TRAFFIC_LIGHT" });
  });

  it("submit requires current item for EVERY project", async () => {
    const service = new ReportSectionsService(
      createRepository(multiProjectSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.submitSection(
        {
          reportSectionId: SECTION_ID,
          version: 1,
          status: "draft",
          confirmed: true,
          stageStatuses: [],
          activityStatuses: [],
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
              stageNames: ["Development"],
            },
          ],
          risks: [],
          decisions: [],
        },
        AUTHOR_ID,
      ),
    ).rejects.toMatchObject({ code: "MISSING_CURRENT_ITEM" });
  });

  it("submit succeeds when all projects have traffic light and current item", async () => {
    const service = new ReportSectionsService(
      createRepository(multiProjectSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const result = await service.submitSection(
      {
        reportSectionId: SECTION_ID,
        version: 1,
        status: "draft",
        confirmed: true,
        stageStatuses: [
          {
            projectId: PROJECT_ID_1,
            stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            status: "green",
          },
          {
            projectId: PROJECT_ID_2,
            stageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            status: "red",
          },
        ],
        activityStatuses: [],
        projectStatuses: [
          { projectId: PROJECT_ID_1, status: "green" },
          { projectId: PROJECT_ID_2, status: "red" },
        ],
        items: multiProjectSection.items,
        risks: [],
        decisions: [],
      },
      AUTHOR_ID,
    );

    expect(result.status).toBe("submitted");
    expect(result.projects[0]?.trafficLight).toBe("green");
    expect(result.projects[1]?.trafficLight).toBe("red");
  });
});

describe("ReportSectionsService — edge cases", () => {
  it("saveDraft with empty items/risks/decisions is allowed", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const saved = await service.saveDraft(
      validDraft({
        items: [],
        risks: [],
        decisions: [],
      }),
      AUTHOR_ID,
    );

    expect(saved.items).toHaveLength(0);
    expect(saved.risks).toHaveLength(0);
    expect(saved.decisions).toHaveLength(0);
  });

  it("saveDraft is idempotent — same input twice produces same result", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const first = await service.saveDraft(validDraft(), AUTHOR_ID);
    const second = await service.saveDraft(validDraft(), AUTHOR_ID);

    expect(first.projects[0]?.trafficLight).toBe(
      second.projects[0]?.trafficLight,
    );
    expect(first.items).toHaveLength(second.items.length);
  });

  it("section with max boundary items (100) can be saved", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const maxItems = Array.from({ length: 100 }, (_, i) => ({
      projectId: PROJECT_ID_1,
      type: "current" as const,
      text: `Item ${i + 1}`,
      tag: "feature",
      workflowStatus: "in_progress" as const,
      carriedOver: false,
      stageNames: ["Development"],
    }));
    const saved = await service.saveDraft(
      validDraft({ items: maxItems }),
      AUTHOR_ID,
    );

    expect(saved.items).toHaveLength(100);
  });

  it("draft save preserves project list from section (not from input)", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const saved = await service.saveDraft(
      validDraft({
        projectStatuses: [],
      }),
      AUTHOR_ID,
    );

    // Projects come from the section, not input
    expect(saved.projects).toHaveLength(1);
    expect(saved.projects[0]?.projectName).toBe("Project Alpha");
    // But traffic light is cleared since no matching status in input
    expect(saved.projects[0]?.trafficLight).toBeNull();
  });
});
