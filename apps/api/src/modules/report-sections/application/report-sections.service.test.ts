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
  type ReportSectionsRepository,
  ReportSectionsService,
} from "./report-sections.service";

const baseSection: ReportSectionReadModel = {
  reportSectionId: "11111111-1111-4111-8111-111111111111",
  reportId: "22222222-2222-4222-8222-222222222222",
  authorId: "33333333-3333-4333-8333-333333333333",
  authorName: "Lead 1",
  version: 1,
  status: "draft",
  submittedAt: null,
  projects: [
    {
      projectId: "44444444-4444-4444-8444-444444444444",
      projectName: "Project 1",
      trafficLight: null,
      // lead-form-stage-access-integrity: the author owns the Development stage
      // on this project, so the seeded write payloads (stageIds: ["Development"])
      // pass the ownership guard.
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
      projectId: "44444444-4444-4444-8444-444444444444",
      type: "current",
      text: "Current item",
      tag: "feature",
      workflowStatus: "in_progress",
      carriedOver: false,
      // enforce-item-decision-stage-schema: items carry ≥1 stage on write;
      // validSubmitPayload() reuses these items as a submit payload.
      stageIds: ["Development"],
    },
  ],
  risks: [],
  decisions: [],
  activities: [],
};

// enforce-item-decision-stage-schema: the read-model item types stageIds as
// optional, but draft-save/submit payloads require it. Expose a stage-guaranteed
// copy of the seeded items for the write-path test payloads below.
const writeItems = baseSection.items.map((it) => ({
  ...it,
  stageIds: it.stageIds ?? [],
}));

function createRepository(
  section: ReportSectionReadModel,
): ReportSectionsRepository {
  let currentSection = structuredClone(section);

  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository contract (Promise<...>); no awaitable work in stub
    async getSectionById(reportSectionId) {
      if (reportSectionId !== currentSection.reportSectionId) {
        return null;
      }

      return structuredClone(currentSection);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository contract (Promise<string | null>); no awaitable work in stub
    async getReportPeriodStatusForSection() {
      return "open";
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository contract (Promise<...>); no awaitable work in stub
    async getPublishedLineage() {
      return { itemStableIds: [], decisionStableIds: [] };
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository contract (Promise<ReportSectionReadModel>); no awaitable work in stub
    async saveSection(nextSection) {
      currentSection = structuredClone(nextSection);

      return structuredClone(currentSection);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository contract (Promise<...>); no awaitable work in stub
    async getMyHistoryRows() {
      return [];
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
      version: 1,
      projects: [{ projectName: "Project 1" }],
      items: [{ text: "Current item" }],
    });
  });

  it("saves draft without changing submitted state", async () => {
    const service = new ReportSectionsService(createRepository(baseSection));
    const saved = await service.saveDraft({
      reportSectionId: baseSection.reportSectionId,
      version: 1,
      status: "draft",
      projectStatuses: [
        {
          projectId: expectDefined(baseSection.projects[0]).projectId,
          status: "yellow",
        },
      ],
      items: writeItems,
      risks: [],
      decisions: [],
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
          version: 1,
          status: "draft",
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

  it("rejects submit when traffic light is missing", async () => {
    const service = new ReportSectionsService(createRepository(baseSection));

    await expect(
      service.submitSection({
        reportSectionId: baseSection.reportSectionId,
        version: 1,
        status: "draft",
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
          version: 1,
          status: "draft",
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
    const service = new ReportSectionsService(createRepository(baseSection));

    const saved = await service.submitSection({
      reportSectionId: baseSection.reportSectionId,
      version: 1,
      status: "draft",
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
    });

    expect(saved.status).toBe("submitted");
    expect(saved.projects).toHaveLength(1);
    expect(saved.projects[0]?.projectId).toBe(
      expectDefined(baseSection.projects[0]).projectId,
    );
  });

  describe("saveDraft — published report guard", () => {
    it("rejects editing a section when the period is published", async () => {
      const repo = createRepository(baseSection);
      // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository.getReportPeriodStatusForSection contract (Promise<string | null>); no awaitable work in stub
      repo.getReportPeriodStatusForSection = async () => "published";

      const service = new ReportSectionsService(repo);

      await expect(
        service.saveDraft({
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
          projectStatuses: [
            {
              projectId: expectDefined(baseSection.projects[0]).projectId,
              status: "yellow",
            },
          ],
          items: writeItems,
          risks: [],
          decisions: [],
        }),
      ).rejects.toMatchObject({
        code: "SECTION_ALREADY_SUBMITTED",
        message: "Cannot edit sections of a published report.",
      });
    });

    it("allows editing when the period is open", async () => {
      const repo = createRepository(baseSection);
      // getReportPeriodStatusForSection already returns 'open' by default.
      const service = new ReportSectionsService(repo);

      const saved = await service.saveDraft({
        reportSectionId: baseSection.reportSectionId,
        version: 1,
        status: "draft",
        projectStatuses: [
          {
            projectId: expectDefined(baseSection.projects[0]).projectId,
            status: "green",
          },
        ],
        items: writeItems,
        risks: [],
        decisions: [],
      });

      expect(saved.status).toBe("draft");
      expect(saved.projects[0]?.trafficLight).toBe("green");
    });

    it("allows editing on a reopened period even while the legacy status reads published", async () => {
      const repo = createRepository(baseSection);
      // The reopen transition leaves the legacy Report.status at 'published'
      // while flipping the canonical periodStatus to 'reopened'. The gate must
      // follow periodStatus regardless of the divergent legacy value.
      // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository.getReportPeriodStatusForSection contract (Promise<string | null>); no awaitable work in stub
      repo.getReportPeriodStatusForSection = async () => "reopened";

      const service = new ReportSectionsService(repo);

      const saved = await service.saveDraft({
        reportSectionId: baseSection.reportSectionId,
        version: 1,
        status: "draft",
        projectStatuses: [
          {
            projectId: expectDefined(baseSection.projects[0]).projectId,
            status: "green",
          },
        ],
        items: writeItems,
        risks: [],
        decisions: [],
      });

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

      const service = new ReportSectionsService(repo);

      await service.saveDraft({
        reportSectionId: baseSection.reportSectionId,
        version: 1,
        status: "draft",
        projectStatuses: [
          {
            projectId: expectDefined(baseSection.projects[0]).projectId,
            status: "yellow",
          },
        ],
        items: writeItems,
        risks: [],
        decisions: [],
      });

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
      );

      await expect(
        service.saveDraft({
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
          projectStatuses: [
            {
              projectId: expectDefined(baseSection.projects[0]).projectId,
              status: "yellow",
            },
          ],
          items: writeItems,
          risks: [],
          decisions: [],
        }),
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
      // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository.getReportPeriodStatusForSection contract (Promise<string | null>); no awaitable work in stub
      repo.getReportPeriodStatusForSection = async () => "published";

      const service = new ReportSectionsService(repo);

      await expect(service.submitSection(submitPayload)).rejects.toMatchObject({
        code: "SECTION_ALREADY_SUBMITTED",
        message: "Cannot submit sections of a published report.",
      });
    });

    it("succeeds submitting a draft section on an open period", async () => {
      const service = new ReportSectionsService(createRepository(greenSection));

      const saved = await service.submitSection(submitPayload);

      expect(saved.status).toBe("submitted");
    });

    it("succeeds submitting a draft section on a reopened period", async () => {
      const repo = createRepository(greenSection);
      // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository.getReportPeriodStatusForSection contract (Promise<string | null>); no awaitable work in stub
      repo.getReportPeriodStatusForSection = async () => "reopened";

      const service = new ReportSectionsService(repo);

      const saved = await service.submitSection(submitPayload);

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
    );

    await expect(
      service.submitSection({
        reportSectionId: baseSection.reportSectionId,
        version: 1,
        status: "draft",
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
      }),
    ).rejects.toMatchObject({
      code: "SECTION_ALREADY_SUBMITTED",
    });
  });
});

// ---------------------------------------------------------------------------
// lead-form-stage-access-integrity: the server stage-ownership guard rejects a
// write whose new/changed row carries a stage the SECTION AUTHOR does not own,
// on BOTH saveDraft and submitSection; grandfathers an unchanged legacy/cross
// row; and (security) re-validates a row that reuses a stableId but changes its
// stage set OR its product.
// ---------------------------------------------------------------------------

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
      },
    ],
  };

  const devOpsRisk = {
    projectId: PROJECT_P,
    risk: "Pipeline outage",
    impact: "Blocks release",
    mitigation: "Escalate to platform",
    severity: "at-risk" as const,
    stageIds: ["DevOps"],
  };

  it("rejects saveDraft when a new risk carries a stage the author does not own", async () => {
    const service = new ReportSectionsService(createRepository(testingOwner));

    await expect(
      service.saveDraft({
        reportSectionId: baseSection.reportSectionId,
        version: 1,
        status: "draft",
        projectStatuses: [{ projectId: PROJECT_P, status: "yellow" }],
        items: [],
        risks: [devOpsRisk],
        decisions: [],
      }),
    ).rejects.toMatchObject({ code: "STAGE_NOT_OWNED" });
  });

  it("rejects submitSection when a new risk carries a stage the author does not own", async () => {
    const service = new ReportSectionsService(createRepository(testingOwner));

    await expect(
      service.submitSection({
        reportSectionId: baseSection.reportSectionId,
        version: 1,
        status: "draft",
        confirmed: true,
        projectStatuses: [{ projectId: PROJECT_P, status: "green" }],
        items: [],
        risks: [devOpsRisk],
        decisions: [],
      }),
    ).rejects.toMatchObject({ code: "STAGE_NOT_OWNED" });
  });

  it("allows a write whose stages the author owns", async () => {
    const service = new ReportSectionsService(createRepository(testingOwner));

    const saved = await service.saveDraft({
      reportSectionId: baseSection.reportSectionId,
      version: 1,
      status: "draft",
      projectStatuses: [{ projectId: PROJECT_P, status: "yellow" }],
      items: [],
      risks: [{ ...devOpsRisk, stageIds: ["Testing"] }],
      decisions: [],
    });

    expect(saved.status).toBe("draft");
    expect(saved.risks).toHaveLength(1);
  });

  it("scopes to the section author's owned stages even on an on-behalf edit", async () => {
    // The guard never reads actorUserId; it references the SECTION AUTHOR's
    // ownedStages (Testing only). Passing the author's own id exercises the
    // self-check path and still reaches the guard — so a head/admin on-behalf
    // edit (which bypasses the self-check) likewise cannot inject an unowned
    // stage: the DevOps stage is rejected because the AUTHOR does not own it.
    const service = new ReportSectionsService(createRepository(testingOwner));

    await expect(
      service.saveDraft(
        {
          reportSectionId: baseSection.reportSectionId,
          version: 1,
          status: "draft",
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
    const service = new ReportSectionsService(createRepository(testingOwner));

    await expect(
      service.saveDraft({
        reportSectionId: baseSection.reportSectionId,
        version: 1,
        status: "draft",
        projectStatuses: [{ projectId: PROJECT_P, status: "yellow" }],
        items: [],
        risks: [],
        decisions: [
          {
            text: "Adopt new deploy tooling",
            owner: "Lead 1",
            impact: "Faster releases",
            productId: PROJECT_P,
            stageIds: ["DevOps"],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "STAGE_NOT_OWNED" });
  });

  // A legacy/cross row references a product the author owns no stage on
  // (fix-lead-surface-name-resolution). Unchanged, it must survive the guard.
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
        stageIds: ["Integration"],
      },
    ],
  };

  it("grandfathers an unchanged legacy/cross row (same stableId, product, stage set)", async () => {
    const service = new ReportSectionsService(
      createRepository(crossRowSection),
    );

    const saved = await service.saveDraft({
      reportSectionId: baseSection.reportSectionId,
      version: 1,
      status: "draft",
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
          stageIds: ["Integration"],
        },
      ],
      decisions: [],
    });

    expect(saved.status).toBe("draft");
    expect(saved.risks).toHaveLength(1);
  });

  it("rejects a smuggle that reuses a stableId but swaps in an unowned stage", async () => {
    const service = new ReportSectionsService(
      createRepository(crossRowSection),
    );

    await expect(
      service.saveDraft({
        reportSectionId: baseSection.reportSectionId,
        version: 1,
        status: "draft",
        projectStatuses: [{ projectId: PROJECT_P, status: "yellow" }],
        items: [],
        risks: [
          {
            // Same lineage key as the grandfathered row, but the stage set
            // changed to one the author does not own → re-validated, rejected.
            stableId: STABLE_ID,
            projectId: CROSS_PROJECT,
            risk: "Gateway certification slips",
            impact: "Payments blocked",
            mitigation: "Escalate to vendor",
            severity: "at-risk",
            stageIds: ["DevOps"],
          },
        ],
        decisions: [],
      }),
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
          stageIds: ["Testing"],
        },
      ],
    };
    const service = new ReportSectionsService(
      createRepository(ownedRowSection),
    );

    await expect(
      service.saveDraft({
        reportSectionId: baseSection.reportSectionId,
        version: 1,
        status: "draft",
        projectStatuses: [{ projectId: PROJECT_P, status: "yellow" }],
        items: [],
        risks: [
          {
            // Identical stage set, but the product changed to one the author
            // owns no stage on → not grandfathered, Testing is not owned there.
            stableId: STABLE_ID,
            projectId: CROSS_PROJECT,
            risk: "Flaky suite",
            impact: "Slows release",
            mitigation: "Stabilize",
            severity: "at-risk",
            stageIds: ["Testing"],
          },
        ],
        decisions: [],
      }),
    ).rejects.toMatchObject({ code: "STAGE_NOT_OWNED" });
  });
});

// ---------------------------------------------------------------------------
// submitSection deadline gate (grace + late matrix)
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
      // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository contract (Promise<...>); no awaitable work in stub
      async getSectionById(id) {
        if (id !== currentSection.reportSectionId) return null;
        return structuredClone(currentSection);
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository contract (Promise<string | null>); no awaitable work in stub
      async getReportPeriodStatusForSection() {
        return "open";
      },
      getReportMeta,
      // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository contract (Promise<...>); no awaitable work in stub
      async getPublishedLineage() {
        return { itemStableIds: [], decisionStableIds: [] };
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository contract (Promise<ReportSectionReadModel>); no awaitable work in stub
      async saveSection(next) {
        currentSection = structuredClone(next);
        return structuredClone(currentSection);
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository contract (Promise<...>); no awaitable work in stub
      async getMyHistoryRows() {
        return [];
      },
    };
  }

  function validSubmitPayload() {
    return {
      reportSectionId: baseSection.reportSectionId,
      version: 1,
      status: "draft" as const,
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
  }

  const ONE_HOUR = 60 * 60 * 1000;

  it("before deadline: submits with late=false (gate fully bypassed)", async () => {
    const repo = createGracedRepository({
      deadline: new Date(Date.now() + 24 * ONE_HOUR),
    });
    // eslint-disable-next-line @typescript-eslint/require-await -- implements GetGraceSettings contract ((): Promise<...>); no awaitable work in stub
    const service = new ReportSectionsService(repo, async () => ({
      gracePeriodHours: 24,
      allowLateSubmissions: false,
    }));

    const saved = await service.submitSection(validSubmitPayload());

    expect(saved.status).toBe("submitted");
    expect(saved.late).toBe(false);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.getReportMeta).toHaveBeenCalledTimes(1);
  });

  it("past deadline within grace + allowLate=true: submits with late=true", async () => {
    const repo = createGracedRepository({
      deadline: new Date(Date.now() - 1 * ONE_HOUR),
    });
    // eslint-disable-next-line @typescript-eslint/require-await -- implements GetGraceSettings contract ((): Promise<...>); no awaitable work in stub
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
    // eslint-disable-next-line @typescript-eslint/require-await -- implements GetGraceSettings contract ((): Promise<...>); no awaitable work in stub
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
    // eslint-disable-next-line @typescript-eslint/require-await -- implements GetGraceSettings contract ((): Promise<...>); no awaitable work in stub
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
    const service = new ReportSectionsService(
      repo,
      // eslint-disable-next-line @typescript-eslint/require-await -- implements GetGraceSettings contract ((): Promise<...>); no awaitable work in stub
      async () => ({
        gracePeriodHours: 24,
        allowLateSubmissions: false,
      }),
    );

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

// product-telemetry counters/histogram. Verifies the
// submit path bumps `customreport_sections_submitted_total{late}` with the
// stamped label, and observes a positive value in the latency histogram
// when submission lands AFTER the deadline.
describe("ReportSectionsService — product telemetry", () => {
  function buildRepo(deadline: Date): ReportSectionsRepository {
    const section: ReportSectionReadModel = {
      reportSectionId: "11111111-1111-4111-8111-111111111111",
      reportId: "22222222-2222-4222-8222-222222222222",
      authorId: "33333333-3333-4333-8333-333333333333",
      authorName: "Lead 1",
      version: 1,
      status: "draft",
      submittedAt: null,
      projects: [
        {
          projectId: "44444444-4444-4444-8444-444444444444",
          projectName: "Project 1",
          trafficLight: "green",
          // lead-form-stage-access-integrity: the submitted item carries the
          // Development stage, so the author must own it to pass the guard.
          ownedStages: [
            {
              stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              stageName: "Development",
              sortOrder: 0,
            },
          ],
        },
      ],
      items: [],
      risks: [],
      decisions: [],
      activities: [],
    };
    let current = section;
    return {
      // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository contract (Promise<...>); no awaitable work in stub
      async getSectionById(id) {
        if (id !== current.reportSectionId) return null;
        return structuredClone(current);
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository contract (Promise<string | null>); no awaitable work in stub
      async getReportPeriodStatusForSection() {
        return "open";
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository contract (Promise<...>); no awaitable work in stub
      async getReportMeta() {
        return { status: "draft", deadline };
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository contract (Promise<...>); no awaitable work in stub
      async getPublishedLineage() {
        return { itemStableIds: [], decisionStableIds: [] };
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository contract (Promise<ReportSectionReadModel>); no awaitable work in stub
      async saveSection(next) {
        current = structuredClone(next);
        return structuredClone(current);
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- implements ReportSectionsRepository contract (Promise<...>); no awaitable work in stub
      async getMyHistoryRows() {
        return [];
      },
    };
  }

  const ONE_HOUR = 60 * 60 * 1000;

  it("increments late=false counter and observes a negative latency when submitted before deadline", async () => {
    const before = await counterValue(customreportSectionsSubmittedTotal, {
      late: "false",
    });
    const histBefore = await histogramSum(
      customreportSectionSubmissionLatencySeconds,
    );

    const service = new ReportSectionsService(
      buildRepo(new Date(Date.now() + 6 * ONE_HOUR)),
      // eslint-disable-next-line @typescript-eslint/require-await -- implements GetGraceSettings contract ((): Promise<...>); no awaitable work in stub
      async () => ({ gracePeriodHours: 24, allowLateSubmissions: false }),
      new ReportSectionsPrometheusTelemetry(),
    );
    await service.submitSection({
      reportSectionId: "11111111-1111-4111-8111-111111111111",
      version: 1,
      status: "draft" as const,
      confirmed: true as const,
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
          // enforce-item-decision-stage-schema: items carry ≥1 stage on write.
          stageIds: ["Development"],
        },
      ],
      risks: [],
      decisions: [],
    });

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
      // eslint-disable-next-line @typescript-eslint/require-await -- implements GetGraceSettings contract ((): Promise<...>); no awaitable work in stub
      async () => ({ gracePeriodHours: 24, allowLateSubmissions: true }),
      new ReportSectionsPrometheusTelemetry(),
    );
    await service.submitSection({
      reportSectionId: "11111111-1111-4111-8111-111111111111",
      version: 1,
      status: "draft" as const,
      confirmed: true as const,
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
          // enforce-item-decision-stage-schema: items carry ≥1 stage on write.
          stageIds: ["Development"],
        },
      ],
      risks: [],
      decisions: [],
    });

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prom-client label record shape
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

async function histogramSum(hist: {
  get(): Promise<{ values: { value: number; metricName?: string }[] }>;
}): Promise<number> {
  const snapshot = await hist.get();
  const sum = snapshot.values.find((e) => e.metricName?.endsWith("_sum"));
  return sum?.value ?? 0;
}
