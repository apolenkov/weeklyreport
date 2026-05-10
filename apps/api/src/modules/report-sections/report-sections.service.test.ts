import { describe, expect, it } from "vitest";

import type { ReportSectionReadModel } from "@customreport/shared";

import {
  ReportSectionAccessError,
  ReportSectionsService,
  type ReportSectionsRepository,
} from "./report-sections.service";
import { expectDefined } from "../../test-utils/expect-defined.js";

const baseSection: ReportSectionReadModel = {
  reportSectionId: "11111111-1111-4111-8111-111111111111",
  reportId: "22222222-2222-4222-8222-222222222222",
  authorId: "33333333-3333-4333-8333-333333333333",
  authorName: "Lead 1",
  status: "draft",
  submittedAt: null,
  projects: [
    {
      projectId: "44444444-4444-4444-8444-444444444444",
      projectName: "Project 1",
      trafficLight: null,
    },
  ],
  items: [
    {
      projectId: "44444444-4444-4444-8444-444444444444",
      type: "current",
      text: "Current item",
      tag: "feature",
      workflowStatus: "in_progress",
      carriedOver: false,
    },
  ],
  risks: [],
  decisions: [],
  priorities: [
    { rank: 1, text: "Priority 1" },
    { rank: 2, text: "Priority 2" },
    { rank: 3, text: "Priority 3" },
  ],
};

function createRepository(
  section: ReportSectionReadModel,
): ReportSectionsRepository {
  let currentSection = structuredClone(section);

  return {
    async getSectionById(reportSectionId) {
      if (reportSectionId !== currentSection.reportSectionId) {
        return null;
      }

      return structuredClone(currentSection);
    },
    async getReportStatus() {
      return "draft";
    },
    async saveSection(nextSection) {
      currentSection = structuredClone(nextSection);

      return structuredClone(currentSection);
    },
  };
}

describe("ReportSectionsService", () => {
  it("loads a lead section as one typed payload", async () => {
    const service = new ReportSectionsService(createRepository(baseSection));

    await expect(
      service.getActiveSection(baseSection.reportSectionId),
    ).resolves.toMatchObject({
      reportSectionId: baseSection.reportSectionId,
      projects: [{ projectName: "Project 1" }],
      items: [{ text: "Current item" }],
      priorities: [
        { rank: 1, text: "Priority 1" },
        { rank: 2, text: "Priority 2" },
        { rank: 3, text: "Priority 3" },
      ],
    });
  });

  it("saves draft without changing submitted state", async () => {
    const service = new ReportSectionsService(createRepository(baseSection));
    const saved = await service.saveDraft({
      reportSectionId: baseSection.reportSectionId,
      status: "draft",
      projectStatuses: [
        {
          projectId: expectDefined(baseSection.projects[0]).projectId,
          status: "yellow",
        },
      ],
      items: baseSection.items,
      risks: [],
      decisions: [],
      priorities: baseSection.priorities,
    });

    expect(saved.status).toBe("draft");
    expect(saved.submittedAt).toBeNull();
    expect(saved.projects[0]?.trafficLight).toBe("yellow");
  });

  it("rejects saveDraft for another user section when actor is supplied", async () => {
    const service = new ReportSectionsService(createRepository(baseSection));

    await expect(
      service.saveDraft(
        {
          reportSectionId: baseSection.reportSectionId,
          status: "draft",
          projectStatuses: [
            {
              projectId: expectDefined(baseSection.projects[0]).projectId,
              status: "yellow",
            },
          ],
          items: baseSection.items,
          risks: [],
          decisions: [],
          priorities: baseSection.priorities,
        },
        "55555555-5555-4555-8555-555555555555",
      ),
    ).rejects.toBeInstanceOf(ReportSectionAccessError);
  });

  it("rejects submit when traffic light is missing", async () => {
    const service = new ReportSectionsService(createRepository(baseSection));

    await expect(
      service.submitSection({
        reportSectionId: baseSection.reportSectionId,
        status: "draft",
        confirmed: true,
        projectStatuses: [
          {
            projectId: "99999999-9999-4999-8999-999999999999",
            status: "green",
          },
        ],
        items: baseSection.items,
        risks: [],
        decisions: [],
        priorities: baseSection.priorities,
      }),
    ).rejects.toMatchObject({
      code: "MISSING_TRAFFIC_LIGHT",
    });
  });

  it("rejects submit for another user section before validation", async () => {
    const service = new ReportSectionsService(createRepository(baseSection));

    await expect(
      service.submitSection(
        {
          reportSectionId: baseSection.reportSectionId,
          status: "draft",
          confirmed: true,
          projectStatuses: [
            {
              projectId: expectDefined(baseSection.projects[0]).projectId,
              status: "green",
            },
          ],
          items: baseSection.items,
          risks: [],
          decisions: [],
          priorities: baseSection.priorities,
        },
        "55555555-5555-4555-8555-555555555555",
      ),
    ).rejects.toBeInstanceOf(ReportSectionAccessError);
  });

  it("submits by read-model scope and does not require owner-only projects", async () => {
    const service = new ReportSectionsService(createRepository(baseSection));

    const saved = await service.submitSection({
      reportSectionId: baseSection.reportSectionId,
      status: "draft",
      confirmed: true,
      projectStatuses: [
        {
          projectId: expectDefined(baseSection.projects[0]).projectId,
          status: "green",
        },
      ],
      items: baseSection.items,
      risks: [],
      decisions: [],
      priorities: baseSection.priorities,
    });

    expect(saved.status).toBe("submitted");
    expect(saved.projects).toHaveLength(1);
    expect(saved.projects[0]?.projectId).toBe(
      expectDefined(baseSection.projects[0]).projectId,
    );
  });

  describe("saveDraft — published report guard", () => {
    it("rejects editing a section when the report is published", async () => {
      const repo = createRepository(baseSection);
      // Override getReportStatus to return 'published'
      repo.getReportStatus = async () => "published";

      const service = new ReportSectionsService(repo);

      await expect(
        service.saveDraft({
          reportSectionId: baseSection.reportSectionId,
          status: "draft",
          projectStatuses: [
            {
              projectId: expectDefined(baseSection.projects[0]).projectId,
              status: "yellow",
            },
          ],
          items: baseSection.items,
          risks: [],
          decisions: [],
          priorities: baseSection.priorities,
        }),
      ).rejects.toMatchObject({
        code: "SECTION_ALREADY_SUBMITTED",
        message: "Cannot edit sections of a published report.",
      });
    });

    it("allows editing when the report is still a draft", async () => {
      const repo = createRepository(baseSection);
      // getReportStatus already returns 'draft' by default
      const service = new ReportSectionsService(repo);

      const saved = await service.saveDraft({
        reportSectionId: baseSection.reportSectionId,
        status: "draft",
        projectStatuses: [
          {
            projectId: expectDefined(baseSection.projects[0]).projectId,
            status: "green",
          },
        ],
        items: baseSection.items,
        risks: [],
        decisions: [],
        priorities: baseSection.priorities,
      });

      expect(saved.status).toBe("draft");
      expect(saved.projects[0]?.trafficLight).toBe("green");
    });

    it("calls getReportStatus with the correct reportId", async () => {
      const repo = createRepository(baseSection);
      const calls: string[] = [];
      const originalGetReportStatus = repo.getReportStatus.bind(repo);
      repo.getReportStatus = async (reportId: string) => {
        calls.push(reportId);
        return originalGetReportStatus(reportId);
      };

      const service = new ReportSectionsService(repo);

      await service.saveDraft({
        reportSectionId: baseSection.reportSectionId,
        status: "draft",
        projectStatuses: [
          {
            projectId: expectDefined(baseSection.projects[0]).projectId,
            status: "yellow",
          },
        ],
        items: baseSection.items,
        risks: [],
        decisions: [],
        priorities: baseSection.priorities,
      });

      expect(calls).toEqual([baseSection.reportId]);
    });

    it("rejects saveDraft on an already-submitted section", async () => {
      const service = new ReportSectionsService(
        createRepository({
          ...baseSection,
          status: "submitted",
          submittedAt: new Date("2026-04-06T12:00:00.000Z"),
          projects: [
            {
              ...expectDefined(baseSection.projects[0]),
              trafficLight: "green",
            },
          ],
        }),
      );

      await expect(
        service.saveDraft({
          reportSectionId: baseSection.reportSectionId,
          status: "draft",
          projectStatuses: [
            {
              projectId: expectDefined(baseSection.projects[0]).projectId,
              status: "yellow",
            },
          ],
          items: baseSection.items,
          risks: [],
          decisions: [],
          priorities: baseSection.priorities,
        }),
      ).rejects.toMatchObject({
        code: "SECTION_ALREADY_SUBMITTED",
        message: "Submitted sections are read-only.",
      });
    });
  });

  it("rejects a second submit for an already-submitted section", async () => {
    const service = new ReportSectionsService(
      createRepository({
        ...baseSection,
        status: "submitted",
        submittedAt: new Date("2026-04-06T12:00:00.000Z"),
        projects: [
          { ...expectDefined(baseSection.projects[0]), trafficLight: "green" },
        ],
      }),
    );

    await expect(
      service.submitSection({
        reportSectionId: baseSection.reportSectionId,
        status: "draft",
        confirmed: true,
        projectStatuses: [
          {
            projectId: expectDefined(baseSection.projects[0]).projectId,
            status: "green",
          },
        ],
        items: baseSection.items,
        risks: [],
        decisions: [],
        priorities: baseSection.priorities,
      }),
    ).rejects.toMatchObject({
      code: "SECTION_ALREADY_SUBMITTED",
    });
  });
});

// ---------------------------------------------------------------------------
// UFB-049 / Phase 50-B: submitSection deadline gate (grace + late matrix)
//
// Combinations under test:
//
//   ┌──────────────────────┬──────────────────────┬───────────────────────┐
//   │ now vs deadline      │ allowLateSubmissions │ Expected outcome      │
//   ├──────────────────────┼──────────────────────┼───────────────────────┤
//   │ before deadline      │ (any)                │ submit, late=false    │
//   │ past deadline,       │ true                 │ submit, late=true     │
//   │   within grace       │ false                │ submit, late=true     │
//   │ past grace window    │ true                 │ submit, late=true     │
//   │ past grace window    │ false                │ 403 ReportSection-    │
//   │                      │                      │ AccessError           │
//   └──────────────────────┴──────────────────────┴───────────────────────┘
// ---------------------------------------------------------------------------

describe("ReportSectionsService — deadline gate (UFB-049 / 50-B)", () => {
  function createGracedRepository(opts: {
    section?: ReportSectionReadModel;
    deadline: Date;
  }): ReportSectionsRepository {
    const section = structuredClone(opts.section ?? baseSection);
    // Make the section's traffic light filled so the content validator
    // doesn't fire — we want to test the deadline gate in isolation.
    const fixed = {
      ...section,
      projects: section.projects.map((p) => ({
        ...p,
        trafficLight: "green" as const,
      })),
    };
    let currentSection = fixed;
    return {
      async getSectionById(id) {
        if (id !== currentSection.reportSectionId) return null;
        return structuredClone(currentSection);
      },
      async getReportStatus() {
        return "draft";
      },
      async getReportMeta() {
        return { status: "draft", deadline: opts.deadline };
      },
      async saveSection(next) {
        currentSection = structuredClone(next);
        return structuredClone(currentSection);
      },
    };
  }

  function validSubmitPayload() {
    return {
      reportSectionId: baseSection.reportSectionId,
      status: "draft" as const,
      confirmed: true,
      projectStatuses: [
        {
          projectId: expectDefined(baseSection.projects[0]).projectId,
          status: "green" as const,
        },
      ],
      items: baseSection.items,
      risks: [],
      decisions: [],
      priorities: baseSection.priorities,
    };
  }

  const ONE_HOUR = 60 * 60 * 1000;

  it("before deadline: submits with late=false (gate fully bypassed)", async () => {
    const repo = createGracedRepository({
      deadline: new Date(Date.now() + 24 * ONE_HOUR),
    });
    const service = new ReportSectionsService(repo, async () => ({
      gracePeriodHours: 24,
      allowLateSubmissions: false,
    }));

    const saved = await service.submitSection(validSubmitPayload());

    expect(saved.status).toBe("submitted");
    expect(saved.late).toBe(false);
  });

  it("past deadline within grace + allowLate=true: submits with late=true", async () => {
    const repo = createGracedRepository({
      deadline: new Date(Date.now() - 1 * ONE_HOUR),
    });
    const service = new ReportSectionsService(repo, async () => ({
      gracePeriodHours: 24,
      allowLateSubmissions: true,
    }));

    const saved = await service.submitSection(validSubmitPayload());

    expect(saved.status).toBe("submitted");
    expect(saved.late).toBe(true);
  });

  it("past deadline within grace + allowLate=false: submits with late=true (grace still permissive)", async () => {
    const repo = createGracedRepository({
      deadline: new Date(Date.now() - 1 * ONE_HOUR),
    });
    const service = new ReportSectionsService(repo, async () => ({
      gracePeriodHours: 24,
      allowLateSubmissions: false,
    }));

    const saved = await service.submitSection(validSubmitPayload());

    expect(saved.status).toBe("submitted");
    expect(saved.late).toBe(true);
  });

  it("past grace window + allowLate=true: submits with late=true", async () => {
    const repo = createGracedRepository({
      deadline: new Date(Date.now() - 48 * ONE_HOUR),
    });
    const service = new ReportSectionsService(repo, async () => ({
      gracePeriodHours: 24,
      allowLateSubmissions: true,
    }));

    const saved = await service.submitSection(validSubmitPayload());

    expect(saved.status).toBe("submitted");
    expect(saved.late).toBe(true);
  });

  it("past grace window + allowLate=false: 403 ReportSectionAccessError", async () => {
    const repo = createGracedRepository({
      deadline: new Date(Date.now() - 48 * ONE_HOUR),
    });
    const service = new ReportSectionsService(repo, async () => ({
      gracePeriodHours: 24,
      allowLateSubmissions: false,
    }));

    await expect(
      service.submitSection(validSubmitPayload()),
    ).rejects.toBeInstanceOf(ReportSectionAccessError);
  });

  it("legacy: no grace-settings provider wired → gate skipped, late stays false even past deadline", async () => {
    const repo = createGracedRepository({
      deadline: new Date(Date.now() - 48 * ONE_HOUR),
    });
    // No second constructor arg — legacy code path.
    const service = new ReportSectionsService(repo);

    const saved = await service.submitSection(validSubmitPayload());

    expect(saved.status).toBe("submitted");
    expect(saved.late).toBe(false);
  });
});
