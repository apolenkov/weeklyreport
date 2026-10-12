import type {
  DraftSavePayload,
  PeriodStatus,
  ReportSectionReadModel,
  SubmitSectionPayload,
} from "@weeklyreport/shared";
import { trafficLightStatusSchema } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { evaluateSubmissionDeadline } from "../domain/submission-deadline.js";
import {
  OPEN_REPORT_META,
  reportMetaReader,
} from "./__tests__/report-meta-fixture";
import { ReportSectionDomainError } from "./report-sections.contract.js";
import {
  ReportSectionAccessError,
  ReportSectionNotFoundError,
  type ReportSectionsRepository,
  ReportSectionsService,
} from "./report-sections.service";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "./report-sections-telemetry.port.js";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID_1 = "44444444-4444-4444-8444-444444444444";
const baseSection: ReportSectionReadModel = {
  reportSectionId: SECTION_ID,
  reportId: REPORT_ID,
  authorId: AUTHOR_ID,
  authorName: "Lead 1",
  authorRole: "lead",
  version: 1,
  status: "draft",
  submittedAt: null,
  late: false,
  projects: [
    {
      projectId: PROJECT_ID_1,
      projectName: "Project Alpha",
      trafficLight: null,
      // the author owns the Development stage
      // on this project, so the write payloads (stageNames: ["Development"]) pass
      // the stage-ownership guard.
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
      projectId: PROJECT_ID_1,
      type: "current",
      text: "Deliver feature X",
      tag: "feature",
      workflowStatus: "in_progress",
      carriedOver: false,
      // items carry ≥1 stage on write.
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
  periodStatus: PeriodStatus | null = "open",
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
      return Promise.resolve(
        periodStatus === null ? null : { periodStatus, archived: false },
      );
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

function validDraft(
  overrides: Partial<DraftSavePayload> = {},
): DraftSavePayload {
  return {
    reportSectionId: SECTION_ID,
    version: 1,
    status: "draft" as const,
    projectStatuses: [{ projectId: PROJECT_ID_1, status: "green" as const }],
    stageStatuses: [],
    activityStatuses: [],
    items: baseSection.items,
    risks: [],
    decisions: [],
    ...overrides,
  };
}

function validSubmit(
  overrides: Partial<SubmitSectionPayload> = {},
): SubmitSectionPayload {
  return {
    reportSectionId: SECTION_ID,
    version: 1,
    status: "draft" as const,
    projectStatuses: [{ projectId: PROJECT_ID_1, status: "green" }],
    stageStatuses: [
      {
        projectId: PROJECT_ID_1,
        stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        status: "green",
      },
    ],
    activityStatuses: [],
    items: baseSection.items,
    risks: [],
    decisions: [],
    confirmed: true as const,
    ...overrides,
  };
}

describe("ReportSectionsService — submitSection happy path", () => {
  it.each(["red", "yellow", "green"] as const)(
    "submits complete %s owned-stage statuses",
    async (status) => {
      const service = new ReportSectionsService(
        createRepository(baseSection),
        NOOP_REPORT_SECTIONS_TELEMETRY,
        createNullLogger(),
      );
      const result = await service.submitSection(
        validSubmit({
          stageStatuses: [
            {
              projectId: PROJECT_ID_1,
              stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              status,
            },
          ],
        }),
        AUTHOR_ID,
      );

      expect(result.projects[0]?.ownedStages[0]?.status).toBe(status);
      expect(result.status).toBe("submitted");
      expect(result.submittedAt).toBeInstanceOf(Date);
    },
  );

  it("sets traffic light from the explicit owned-stage input", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const result = await service.submitSection(
      validSubmit({
        projectStatuses: [{ projectId: PROJECT_ID_1, status: "red" }],
        stageStatuses: [
          {
            projectId: PROJECT_ID_1,
            stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            status: "red",
          },
        ],
      }),
      AUTHOR_ID,
    );

    expect(result.projects[0]?.trafficLight).toBe("red");
  });

  it("preserves items, risks, decisions from input", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const result = await service.submitSection(
      validSubmit({
        items: [
          {
            projectId: PROJECT_ID_1,
            type: "current",
            text: "Task A",
            tag: "feature",
            workflowStatus: "done",
            carriedOver: false,
            stageNames: ["Development"],
          },
        ],
        risks: [
          {
            projectId: PROJECT_ID_1,
            risk: "Risk",
            impact: "Impact",
            mitigation: "Mitigation",
            severity: "at-risk",
            // stageNames is required (min 1) on writes.
            stageNames: ["Development"],
          },
        ],
      }),
      AUTHOR_ID,
    );

    expect(result.items).toHaveLength(1);
    expect(result.risks).toHaveLength(1);
  });
});

describe("ReportSectionsService — submitSection validation errors", () => {
  it.each([
    { name: "missing entry", stageStatuses: [] },
    {
      name: "null status",
      stageStatuses: [
        {
          projectId: PROJECT_ID_1,
          stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          status: null,
        },
      ],
    },
    {
      name: "omitted status",
      stageStatuses: [
        {
          projectId: PROJECT_ID_1,
          stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
      ],
    },
  ])("refuses owned-stage $name without saving", async ({ stageStatuses }) => {
    const repository = createRepository(baseSection);
    const save = vi.spyOn(repository, "saveSection");
    const service = new ReportSectionsService(
      repository,
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const submission = service.submitSection(
      validSubmit({ stageStatuses }),
      AUTHOR_ID,
    );
    await expect(submission).rejects.toBeInstanceOf(ReportSectionDomainError);
    await expect(submission).rejects.toMatchObject({
      code: "MISSING_TRAFFIC_LIGHT",
    });
    expect(save).not.toHaveBeenCalled();
    expect(await service.getActiveSection(SECTION_ID)).toEqual(baseSection);
  });

  it("rejects when the period lookup returns null", async () => {
    const repository = createRepository(baseSection, null);
    const service = new ReportSectionsService(
      repository,
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.submitSection(validSubmit(), AUTHOR_ID),
    ).rejects.toBeInstanceOf(ReportSectionNotFoundError);
  });

  it("rejects when section already submitted", async () => {
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
      service.submitSection(validSubmit(), AUTHOR_ID),
    ).rejects.toMatchObject({
      code: "SECTION_ALREADY_SUBMITTED",
    });
  });

  it("rejects when traffic light is missing for a project", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.submitSection(
        validSubmit({
          projectStatuses: [
            {
              projectId: "99999999-9999-4999-8999-999999999999",
              status: "green",
            },
          ],
        }),
        AUTHOR_ID,
      ),
    ).rejects.toMatchObject({ code: "MISSING_TRAFFIC_LIGHT" });
  });

  it("rejects missing traffic light before a deadline expired beyond grace", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T10:00:00.000Z"));
    try {
      const repository = createRepository(baseSection);
      const settings = { gracePeriodHours: 24, allowLateSubmissions: false };
      repository.getReportMeta = reportMetaReader({
        status: "draft",
        deadline: new Date("2026-09-28T10:00:00.000Z"),
      });
      const report = expectDefined(await repository.getReportMeta(REPORT_ID));
      expect(report.deadline).toEqual(new Date("2026-09-28T10:00:00.000Z"));
      expect(
        evaluateSubmissionDeadline(
          expectDefined(report.deadline),
          settings,
          Date.now(),
        ),
      ).toBe("closed");
      const saveSection = vi.fn(async (nextSection: ReportSectionReadModel) => {
        const meta = expectDefined(
          await repository.getReportMeta(nextSection.reportId),
        );
        if (
          evaluateSubmissionDeadline(
            expectDefined(meta.deadline),
            settings,
            Date.now(),
          ) === "closed"
        ) {
          throw new ReportSectionAccessError(
            "Past deadline; submissions closed.",
          );
        }
        return nextSection;
      });
      repository.saveSection = saveSection;
      const service = new ReportSectionsService(
        repository,
        NOOP_REPORT_SECTIONS_TELEMETRY,
        createNullLogger(),
      );

      await expect(
        service.submitSection(validSubmit({ projectStatuses: [] }), AUTHOR_ID),
      ).rejects.toMatchObject({
        name: "ReportSectionDomainError",
        code: "MISSING_TRAFFIC_LIGHT",
      });
      expect(saveSection).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects when no current items for a project", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.submitSection(
        validSubmit({
          items: [
            {
              projectId: PROJECT_ID_1,
              type: "next",
              text: "Future work",
              tag: "planning",
              workflowStatus: "planned",
              carriedOver: false,
              stageNames: ["Development"],
            },
          ],
        }),
        AUTHOR_ID,
      ),
    ).rejects.toMatchObject({ code: "MISSING_CURRENT_ITEM" });
  });

  it("rejects confirmed: false", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.submitSection(
        {
          ...validSubmit(),
          // Negative test: schema requires `confirmed: true` (z.literal(true)).
          confirmed: false as unknown as true,
        },
        AUTHOR_ID,
      ),
    ).rejects.toThrow();
  });

  it("rejects empty projectStatuses", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.submitSection(
        validSubmit({
          projectStatuses: [],
        }),
        AUTHOR_ID,
      ),
    ).rejects.toThrow();
  });
});

describe("ReportSectionsService — unset-stage draft saves", () => {
  it.each([
    { name: "missing entry", stageStatuses: [] },
    {
      name: "null status",
      stageStatuses: [
        {
          projectId: PROJECT_ID_1,
          stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          status: null,
        },
      ],
    },
    {
      name: "omitted status",
      stageStatuses: [
        {
          projectId: PROJECT_ID_1,
          stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
      ],
    },
  ])("allows $name while editing", async ({ stageStatuses }) => {
    const section = {
      ...baseSection,
      projects: baseSection.projects.map((project) => ({
        ...project,
        ownedStages: project.ownedStages.map((stage) => ({
          ...stage,
          status: null,
        })),
      })),
    };
    const service = new ReportSectionsService(
      createRepository(section),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );
    const saved = await service.saveDraft(
      validDraft({ stageStatuses }),
      AUTHOR_ID,
    );
    expect(saved.status).toBe("draft");
    expect(saved.submittedAt).toBeNull();
    expect(saved.projects[0]?.ownedStages[0]?.status).toBeNull();
  });
});

describe("ReportSectionsService — traffic light all valid statuses", () => {
  it.each(trafficLightStatusSchema.options)(
    "sets traffic light to %s",
    async (status) => {
      const service = new ReportSectionsService(
        createRepository(baseSection),
        NOOP_REPORT_SECTIONS_TELEMETRY,
        createNullLogger(),
      );
      const saved = await service.saveDraft(
        validDraft({
          projectStatuses: [{ projectId: PROJECT_ID_1, status }],
        }),
        AUTHOR_ID,
      );
      expect(saved.projects[0]?.trafficLight).toBe(status);
    },
  );

  it("sets traffic light to null when status is omitted", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
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

describe("ReportSectionsService — item tag and workflowStatus combinations", () => {
  const tags = [
    "feature",
    "bugfix",
    "infra",
    "ops",
    "support",
    "tech-debt",
  ] as const;
  // The current-item vocabulary (blocked is never a stored status; next-only
  // values are covered by the per-type rejection tests).
  const statuses = ["done", "in_progress", "paused"] as const;

  it.each(tags.flatMap((tag) => statuses.map((ws) => [tag, ws] as const)))(
    'accepts item with tag="%s" workflowStatus="%s"',
    async (tag, ws) => {
      const service = new ReportSectionsService(
        createRepository(baseSection),
        NOOP_REPORT_SECTIONS_TELEMETRY,
        createNullLogger(),
      );
      const saved = await service.saveDraft(
        validDraft({
          items: [
            {
              projectId: PROJECT_ID_1,
              type: "current",
              text: `Test item ${tag}/${ws}`,
              tag,
              workflowStatus: ws,
              ...(ws === "paused" ? { pausedReason: "Waiting on input" } : {}),
              carriedOver: false,
              stageNames: ["Development"],
            },
          ],
        }),
        AUTHOR_ID,
      );
      expect(saved.items).toHaveLength(1);
      expect(saved.items[0]?.tag).toBe(tag);
      expect(saved.items[0]?.workflowStatus).toBe(ws);
    },
  );
});

describe("ReportSectionsService — double submit rejected", () => {
  it("second submit on same section throws SECTION_ALREADY_SUBMITTED", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    const submitted = await service.submitSection(validSubmit(), AUTHOR_ID);
    expect(submitted.status).toBe("submitted");

    await expect(
      service.submitSection(validSubmit(), AUTHOR_ID),
    ).rejects.toMatchObject({
      code: "SECTION_ALREADY_SUBMITTED",
    });
  });

  it("saveDraft after submit is rejected", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await service.submitSection(validSubmit(), AUTHOR_ID);

    await expect(
      service.saveDraft(validDraft(), AUTHOR_ID),
    ).rejects.toMatchObject({
      code: "SECTION_ALREADY_SUBMITTED",
    });
  });
});

describe("ReportSectionsService — risk/decision Zod validation", () => {
  it("rejects risk with empty risk text", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.saveDraft(
        validDraft({
          risks: [
            {
              projectId: PROJECT_ID_1,
              risk: "",
              impact: "Some impact",
              mitigation: "Some mitigation",
              severity: "at-risk",
              // keep stageNames valid so the rejection
              // stays attributable to the empty text under test.
              stageNames: ["Development"],
            },
          ],
        }),
        AUTHOR_ID,
      ),
    ).rejects.toThrow();
  });

  it("rejects risk with empty impact text", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.saveDraft(
        validDraft({
          risks: [
            {
              projectId: PROJECT_ID_1,
              risk: "A valid risk",
              impact: "",
              mitigation: "Some mitigation",
              severity: "at-risk",
              // keep stageNames valid so the rejection
              // stays attributable to the empty impact under test.
              stageNames: ["Development"],
            },
          ],
        }),
        AUTHOR_ID,
      ),
    ).rejects.toThrow();
  });

  it("rejects risk without stageNames", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.saveDraft(
        validDraft({
          risks: [
            {
              projectId: PROJECT_ID_1,
              risk: "A valid risk",
              impact: "Some impact",
              mitigation: "Some mitigation",
              severity: "at-risk",
            },
          ],
        }),
        AUTHOR_ID,
      ),
    ).rejects.toThrow();
  });

  it("rejects decision with empty text", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.saveDraft(
        validDraft({
          decisions: [
            {
              productId: PROJECT_ID_1,
              text: "",
              owner: "Owner",
              impact: "Impact",
              stageNames: ["Development"],
            },
          ],
        }),
        AUTHOR_ID,
      ),
    ).rejects.toThrow();
  });

  it("rejects decision with empty owner", async () => {
    const service = new ReportSectionsService(
      createRepository(baseSection),
      NOOP_REPORT_SECTIONS_TELEMETRY,
      createNullLogger(),
    );

    await expect(
      service.saveDraft(
        validDraft({
          decisions: [
            {
              productId: PROJECT_ID_1,
              text: "Valid decision",
              owner: "",
              impact: "Impact",
              stageNames: ["Development"],
            },
          ],
        }),
        AUTHOR_ID,
      ),
    ).rejects.toThrow();
  });
});
