import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  OPEN_REPORT_META,
  reportMetaReader,
} from "./__tests__/report-meta-fixture";
import {
  ReportSectionAccessError,
  type ReportSectionsRepository,
  ReportSectionsService,
} from "./report-sections.service";

const testGraceSettings = () =>
  Promise.resolve({ gracePeriodHours: 0, allowLateSubmissions: true });

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

function validDraftFor(section: ReportSectionReadModel) {
  return {
    reportSectionId: section.reportSectionId,
    version: 1,
    status: "draft" as const,
    stageStatuses: [],
    activityStatuses: [],
    projectStatuses: [
      {
        projectId: expectDefined(section.projects[0]).projectId,
        status: "green" as const,
      },
    ],
    items: writeItems,
    risks: [],
    decisions: [],
  };
}

function validSubmitFor(section: ReportSectionReadModel) {
  return {
    ...validDraftFor(section),
    confirmed: true as const,
  };
}

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
    getReportPeriodStatusForSection() {
      return Promise.resolve("open");
    },
    getReportMeta: reportMetaReader(OPEN_REPORT_META),
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

describe("ReportSectionsService", () => {
  it("loads a lead section as one typed payload", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );

    await expect(
      service.getActiveSection(baseSection.reportSectionId),
    ).resolves.toMatchObject({
      reportSectionId: baseSection.reportSectionId,
      version: 1,
      projects: [{ projectName: "Project 1" }],
      items: [{ text: "Current item" }],
    });
  });

  it("saves draft without changing submitted state", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );
    const saved = await service.saveDraft(
      {
        reportSectionId: baseSection.reportSectionId,
        version: 1,
        status: "draft",
        stageStatuses: [],
        activityStatuses: [],
        projectStatuses: [
          {
            projectId: expectDefined(baseSection.projects[0]).projectId,
            status: "yellow",
          },
        ],
        items: writeItems,
        risks: [],
        decisions: [],
      },
      baseSection.authorId,
    );

    expect(saved.status).toBe("draft");
    expect(saved.submittedAt).toBeNull();
    expect(saved.projects[0]?.trafficLight).toBe("yellow");
  });

  it("rejects saveDraft for another user section when actor is supplied", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );

    await expect(
      service.saveDraft(
        {
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
          stageStatuses: [],
          activityStatuses: [],
          projectStatuses: [
            {
              projectId: expectDefined(baseSection.projects[0]).projectId,
              status: "yellow",
            },
          ],
          items: writeItems,
          risks: [],
          decisions: [],
        },
        "55555555-5555-4555-8555-555555555555",
      ),
    ).rejects.toBeInstanceOf(ReportSectionAccessError);
  });

  // Fail-closed: the writing actor is mandatory and must own the section — an
  // unauthorized actor never reaches the repository write (the old optional
  // actor let a write proceed unowned).
  it.each([
    {
      method: "saveDraft",
      call: (s: ReportSectionsService) =>
        s.saveDraft(
          validDraftFor(baseSection),
          "55555555-5555-4555-8555-555555555555",
        ),
    },
    {
      method: "submitSection",
      call: (s: ReportSectionsService) =>
        s.submitSection(
          validSubmitFor(baseSection),
          "55555555-5555-4555-8555-555555555555",
        ),
    },
  ] as const)(
    "$method rejects an unauthorized actor before any write",
    async ({ call }) => {
      const repo = createRepository(baseSection);
      const saveSection = vi.fn();
      repo.saveSection = saveSection;
      const service = new ReportSectionsService(repo, testGraceSettings);

      await expect(call(service)).rejects.toBeInstanceOf(
        ReportSectionAccessError,
      );
      expect(saveSection).not.toHaveBeenCalled();
    },
  );

  it("rejects submit when traffic light is missing", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );

    await expect(
      service.submitSection(
        {
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
          stageStatuses: [],
          activityStatuses: [],
          confirmed: true,
          projectStatuses: [
            {
              projectId: "99999999-9999-4999-8999-999999999999",
              status: "green",
            },
          ],
          items: writeItems,
          risks: [],
          decisions: [],
        },
        baseSection.authorId,
      ),
    ).rejects.toMatchObject({
      code: "MISSING_TRAFFIC_LIGHT",
    });
  });

  it("rejects submit for another user section before validation", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );

    await expect(
      service.submitSection(
        {
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
          stageStatuses: [],
          activityStatuses: [],
          confirmed: true,
          projectStatuses: [
            {
              projectId: expectDefined(baseSection.projects[0]).projectId,
              status: "green",
            },
          ],
          items: writeItems,
          risks: [],
          decisions: [],
        },
        "55555555-5555-4555-8555-555555555555",
      ),
    ).rejects.toBeInstanceOf(ReportSectionAccessError);
  });

  it("submits by read-model scope and does not require owner-only projects", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      testGraceSettings,
    );

    const saved = await service.submitSection(
      {
        reportSectionId: baseSection.reportSectionId,
        version: 1,
        status: "draft",
        stageStatuses: [],
        activityStatuses: [],
        confirmed: true,
        projectStatuses: [
          {
            projectId: expectDefined(baseSection.projects[0]).projectId,
            status: "green",
          },
        ],
        items: writeItems,
        risks: [],
        decisions: [],
      },
      baseSection.authorId,
    );

    expect(saved.status).toBe("submitted");
    expect(saved.projects).toHaveLength(1);
    expect(saved.projects[0]?.projectId).toBe(
      expectDefined(baseSection.projects[0]).projectId,
    );
  });

  describe("saveDraft — published report guard", () => {
    it("rejects editing a section when the period is published", async () => {
      const repo = createRepository(baseSection);
      repo.getReportPeriodStatusForSection = () => Promise.resolve("published");

      const service = new ReportSectionsService(repo, testGraceSettings);

      await expect(
        service.saveDraft(
          {
            reportSectionId: baseSection.reportSectionId,
            version: 1,
            status: "draft",
            stageStatuses: [],
            activityStatuses: [],
            projectStatuses: [
              {
                projectId: expectDefined(baseSection.projects[0]).projectId,
                status: "yellow",
              },
            ],
            items: writeItems,
            risks: [],
            decisions: [],
          },
          baseSection.authorId,
        ),
      ).rejects.toMatchObject({
        code: "SECTION_ALREADY_SUBMITTED",
        message: "Cannot edit sections of a published report.",
      });
    });

    it("allows editing when the period is open", async () => {
      const repo = createRepository(baseSection);
      // getReportPeriodStatusForSection already returns 'open' by default.
      const service = new ReportSectionsService(repo, testGraceSettings);

      const saved = await service.saveDraft(
        {
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
          stageStatuses: [],
          activityStatuses: [],
          projectStatuses: [
            {
              projectId: expectDefined(baseSection.projects[0]).projectId,
              status: "green",
            },
          ],
          items: writeItems,
          risks: [],
          decisions: [],
        },
        baseSection.authorId,
      );

      expect(saved.status).toBe("draft");
      expect(saved.projects[0]?.trafficLight).toBe("green");
    });

    it("allows editing on a reopened period even while the legacy status reads published", async () => {
      const repo = createRepository(baseSection);
      // The reopen transition leaves the legacy Report.status at 'published'
      // while flipping the canonical periodStatus to 'reopened'. The gate must
      // follow periodStatus regardless of the divergent legacy value.
      repo.getReportPeriodStatusForSection = () => Promise.resolve("reopened");

      const service = new ReportSectionsService(repo, testGraceSettings);

      const saved = await service.saveDraft(
        {
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
          stageStatuses: [],
          activityStatuses: [],
          projectStatuses: [
            {
              projectId: expectDefined(baseSection.projects[0]).projectId,
              status: "green",
            },
          ],
          items: writeItems,
          risks: [],
          decisions: [],
        },
        baseSection.authorId,
      );

      expect(saved.status).toBe("draft");
      expect(saved.projects[0]?.trafficLight).toBe("green");
    });

    it("reads editability via getReportPeriodStatusForSection keyed on the section id", async () => {
      const repo = createRepository(baseSection);
      const calls: string[] = [];
      const original = repo.getReportPeriodStatusForSection.bind(repo);
      repo.getReportPeriodStatusForSection = async (sectionId: string) => {
        calls.push(sectionId);
        return original(sectionId);
      };

      const service = new ReportSectionsService(repo, testGraceSettings);

      await service.saveDraft(
        {
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
          stageStatuses: [],
          activityStatuses: [],
          projectStatuses: [
            {
              projectId: expectDefined(baseSection.projects[0]).projectId,
              status: "yellow",
            },
          ],
          items: writeItems,
          risks: [],
          decisions: [],
        },
        baseSection.authorId,
      );

      expect(calls).toEqual([baseSection.reportSectionId]);
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
        testGraceSettings,
      );

      await expect(
        service.saveDraft(
          {
            reportSectionId: baseSection.reportSectionId,
            version: 1,
            status: "draft",
            stageStatuses: [],
            activityStatuses: [],
            projectStatuses: [
              {
                projectId: expectDefined(baseSection.projects[0]).projectId,
                status: "yellow",
              },
            ],
            items: writeItems,
            risks: [],
            decisions: [],
          },
          baseSection.authorId,
        ),
      ).rejects.toMatchObject({
        code: "SECTION_ALREADY_SUBMITTED",
        message: "Submitted sections are read-only.",
      });
    });
  });

  describe("submitSection — published period guard", () => {
    const greenSection: ReportSectionReadModel = {
      ...baseSection,
      status: "draft",
      submittedAt: null,
      projects: [
        { ...expectDefined(baseSection.projects[0]), trafficLight: "green" },
      ],
    };

    const submitPayload = {
      reportSectionId: baseSection.reportSectionId,
      version: 1,
      status: "draft" as const,
      stageStatuses: [],
      activityStatuses: [],
      confirmed: true as const,
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

    it("rejects submitting a draft section on a published period", async () => {
      const repo = createRepository(greenSection);
      repo.getReportPeriodStatusForSection = () => Promise.resolve("published");

      const service = new ReportSectionsService(repo, testGraceSettings);

      await expect(
        service.submitSection(submitPayload, baseSection.authorId),
      ).rejects.toMatchObject({
        code: "SECTION_ALREADY_SUBMITTED",
        message: "Cannot submit sections of a published report.",
      });
    });

    it("succeeds submitting a draft section on an open period", async () => {
      const service = new ReportSectionsService(
        createRepository(greenSection),
        testGraceSettings,
      );

      const saved = await service.submitSection(
        submitPayload,
        baseSection.authorId,
      );

      expect(saved.status).toBe("submitted");
    });

    it("succeeds submitting a draft section on a reopened period", async () => {
      const repo = createRepository(greenSection);
      repo.getReportPeriodStatusForSection = () => Promise.resolve("reopened");

      const service = new ReportSectionsService(repo, testGraceSettings);

      const saved = await service.submitSection(
        submitPayload,
        baseSection.authorId,
      );

      expect(saved.status).toBe("submitted");
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
      testGraceSettings,
    );

    await expect(
      service.submitSection(
        {
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
          stageStatuses: [],
          activityStatuses: [],
          confirmed: true,
          projectStatuses: [
            {
              projectId: expectDefined(baseSection.projects[0]).projectId,
              status: "green",
            },
          ],
          items: writeItems,
          risks: [],
          decisions: [],
        },
        baseSection.authorId,
      ),
    ).rejects.toMatchObject({
      code: "SECTION_ALREADY_SUBMITTED",
    });
  });
});
