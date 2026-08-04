import type { TrafficLightStatus } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import type { FabricatedRow } from "./__tests__/report-sections-prisma-harness";
import {
  AUTHOR_ID,
  baseRow,
  FIXED_TIMESTAMP,
  fullCrossLeadAssignment,
  fullDecision,
  fullItem,
  fullOwnedStageAssignment,
  fullProjectStatus,
  fullRisk,
  mapRow,
  OWNED_PROJECT,
  SECTION_ID,
  STAGE_ID,
  TESTING_STAGE_ID,
  UNOWNED_PROJECT,
} from "./__tests__/report-sections-prisma-harness";

// A project's name comes from its own row, not from the ownership join, so a
// project a risk merely references still carries its real name.
describe("mapPrismaToReportSection — referencedProjects", () => {
  it("emits a name-only entry for a project a risk references but the author owns no stage on", () => {
    const section = mapRow(
      baseRow({
        risks: [
          fullRisk({
            projectId: UNOWNED_PROJECT,
            project: { name: "Foreign Project" },
          }),
        ],
      }),
    );

    expect(section.referencedProjects).toEqual([
      { projectId: UNOWNED_PROJECT, projectName: "Foreign Project" },
    ]);
    // Name-only: the stage-owned `projects` array is NOT widened, so no
    // stray product card / ProjectStatus write / submit demand appears.
    expect(section.projects.map((p) => p.projectId)).toEqual([OWNED_PROJECT]);
  });

  it("collects names from items and decisions too", () => {
    const section = mapRow(
      baseRow({
        items: [
          fullItem({
            projectId: UNOWNED_PROJECT,
            text: "Cross-stage item",
            project: { name: "Foreign Project" },
          }),
        ],
        decisions: [
          fullDecision({
            productId: UNOWNED_PROJECT,
            text: "Cross-stage decision",
            project: { name: "Foreign Project" },
          }),
        ],
      }),
    );

    expect(section.referencedProjects).toEqual([
      { projectId: UNOWNED_PROJECT, projectName: "Foreign Project" },
    ]);
  });

  it("excludes stage-owned projects — they already carry their name in `projects`", () => {
    const section = mapRow(
      baseRow({
        risks: [
          fullRisk({
            projectId: OWNED_PROJECT,
            project: { name: "Owned Project" },
          }),
        ],
      }),
    );

    expect(section.referencedProjects).toEqual([]);
  });

  it("resolves a referenced-only archived project's name", () => {
    // The author's stage assignment on an archived project is skipped from
    // `projects`, so the project counts as referenced-only — yet its name
    // still resolves rather than degrading to a placeholder.
    const section = mapRow(
      baseRow({
        author: {
          name: "Lead 1",
          role: "lead",
          id: AUTHOR_ID,
          reportingGroupId: null,
          stageAssignments: [
            fullOwnedStageAssignment({
              project: { name: "Archived Project", archived: true },
            }),
          ],
        },
        risks: [
          fullRisk({
            projectId: OWNED_PROJECT,
            project: { name: "Archived Project" },
          }),
        ],
      }),
    );

    expect(section.projects).toEqual([]);
    expect(section.referencedProjects).toEqual([
      { projectId: OWNED_PROJECT, projectName: "Archived Project" },
    ]);
  });

  it("skips rows without a loaded project relation (legacy fixture shape)", () => {
    // A real DB row's nullable `project` relation surfaces as `null`, never
    // `undefined` — this pins the honest contract (the hand-written type
    // used to model it as optional-absent).
    const section = mapRow(
      baseRow({
        risks: [fullRisk({ projectId: UNOWNED_PROJECT, project: null })],
      }),
    );

    expect(section.referencedProjects).toEqual([]);
  });
});

// stageSet excludes vacant stages; ownedStages stay author-writable only.
describe("mapPrismaToReportSection — ownerGroupId freeze", () => {
  it("stamps each project entry with the PRODUCT lead's reporting group, not the section author's", () => {
    const assignment = fullOwnedStageAssignment();
    const row = baseRow({
      author: {
        name: "Lead 1",
        role: "lead",
        id: AUTHOR_ID,
        // The section author's own group differs from the product owner's —
        // a stamp that read the author's group would leak through here.
        reportingGroupId: "e0000000-0000-4000-a000-0000000000a1",
        stageAssignments: [
          {
            ...assignment,
            project: {
              ...assignment.project,
              lead: {
                reportingGroupId: "e0000000-0000-4000-a000-0000000000b2",
              },
            },
          },
        ],
      },
    });

    const mapped = mapRow(row);

    expect(mapped.projects[0]?.ownerGroupId).toBe(
      "e0000000-0000-4000-a000-0000000000b2",
    );
  });

  it("freezes a null ownerGroupId for a product whose lead has no group", () => {
    const mapped = mapRow(baseRow());

    expect(mapped.projects[0]?.ownerGroupId).toBeNull();
  });
});

describe("mapPrismaToReportSection — assigned-stage set", () => {
  // A row where the author owns Development, and the product also carries a
  // Testing assignment held by ANOTHER lead.
  function rowWithCrossLeadAssignments(): FabricatedRow {
    return baseRow({
      author: {
        name: "Lead 1",
        role: "lead",
        id: AUTHOR_ID,
        reportingGroupId: null,
        stageAssignments: [
          fullOwnedStageAssignment({
            // The product's full assignment set across all leads.
            crossLeadAssignments: [
              fullCrossLeadAssignment(STAGE_ID, "Development", 4),
              fullCrossLeadAssignment(TESTING_STAGE_ID, "Testing", 5),
              // Duplicate Development row (e.g. a second relation read) must
              // dedupe by stageId, not double-count.
              fullCrossLeadAssignment(STAGE_ID, "Development", 4),
            ],
          }),
        ],
      },
    });
  }

  it("exposes the union of all leads' assignments, deduped and ordered by sortOrder", () => {
    const project = expectDefined(
      mapRow(rowWithCrossLeadAssignments()).projects.find(
        (p) => p.projectId === OWNED_PROJECT,
      ),
    );

    expect(project.stageSet).toEqual([
      { stageId: STAGE_ID, stageName: "Development", sortOrder: 4 },
      { stageId: TESTING_STAGE_ID, stageName: "Testing", sortOrder: 5 },
    ]);
  });

  it("keeps a foreign stage in stageSet but OUT of ownedStages (write path stays owned-only)", () => {
    const project = expectDefined(
      mapRow(rowWithCrossLeadAssignments()).projects.find(
        (p) => p.projectId === OWNED_PROJECT,
      ),
    );

    // Testing is assigned to another lead: visible as display metadata...
    expect(project.stageSet.map((s) => s.stageName)).toContain("Testing");
    // ...but never in the writable ownedStages, so a lead can never persist a
    // status for a stage they do not own.
    expect(project.ownedStages.map((s) => s.stageName)).toEqual([
      "Development",
    ]);
  });

  it("yields an empty stageSet when the project carries no cross-lead assignment", () => {
    // baseRow's project has an empty stageAssignments array; the mapper must
    // not throw and yields an empty set (web falls back to ownedStages).
    const project = expectDefined(
      mapRow(baseRow()).projects.find((p) => p.projectId === OWNED_PROJECT),
    );

    expect(project.stageSet).toEqual([]);
  });
});

// Own risk on empty owned stage floors trafficLight; raw stage status stays null.
describe("mapPrismaToReportSection — own-risk product floor", () => {
  function coveringRisk(severity: "blocked" | "at-risk", stageNames: string[]) {
    return fullRisk({
      risk: "Own covering risk",
      impact: "High",
      mitigation: "Mitigate",
      projectId: OWNED_PROJECT,
      severity,
      stageNames,
      project: { name: "Owned Project" },
    });
  }

  it("floors red for a covers-all blocked own risk on an owned empty stage", () => {
    const section = mapRow(
      baseRow({
        projectStatuses: [
          fullProjectStatus({ projectId: OWNED_PROJECT, status: "green" }),
        ],
        risks: [coveringRisk("blocked", [])],
      }),
    );

    const project = expectDefined(
      section.projects.find((p) => p.projectId === OWNED_PROJECT),
    );
    expect(project.trafficLight).toBe("red");
    // The raw per-stage status stays empty (null) — only the derived
    // product-level trafficLight is floored.
    expect(project.ownedStages[0]?.status ?? null).toBeNull();
  });

  it("floors yellow for a covers-all at-risk own risk on an owned empty stage", () => {
    const section = mapRow(
      baseRow({
        projectStatuses: [
          fullProjectStatus({ projectId: OWNED_PROJECT, status: "green" }),
        ],
        risks: [coveringRisk("at-risk", [])],
      }),
    );

    expect(
      section.projects.find((p) => p.projectId === OWNED_PROJECT)?.trafficLight,
    ).toBe("yellow");
  });

  it("never lowers: a real red ProjectStatus survives a milder own risk", () => {
    const section = mapRow(
      baseRow({
        projectStatuses: [
          fullProjectStatus({ projectId: OWNED_PROJECT, status: "red" }),
        ],
        risks: [coveringRisk("at-risk", [])],
      }),
    );

    expect(
      section.projects.find((p) => p.projectId === OWNED_PROJECT)?.trafficLight,
    ).toBe("red");
  });

  // A risk on a stage the author does NOT own never floors the product (the
  // floor folds risks through OWNED stages only), so excluding the vacant stage
  // changes no health number — the risk stays listed, explaining the severity.
  it("a risk on a non-owned (vacant) stage does not floor health and stays listed", () => {
    const section = mapRow(
      baseRow({
        projectStatuses: [
          fullProjectStatus({ projectId: OWNED_PROJECT, status: "green" }),
        ],
        // Author owns Development; this blocked risk names Testing only.
        risks: [coveringRisk("blocked", ["Testing"])],
      }),
    );

    const project = section.projects.find((p) => p.projectId === OWNED_PROJECT);
    // Health is unchanged — the vacant Testing stage never drove the light.
    expect(project?.trafficLight).toBe("green");
    // The covering risk is still listed (explains any severity without a chip).
    expect(section.risks.map((r) => r.risk)).toContain("Own covering risk");
  });
});

// Activity pill floors from own records without rewriting stored status.
describe("mapPrismaToReportSection — activity derived-status floor", () => {
  const ACTIVITY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const LINKED_PRODUCT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  const activityItem = (
    workflowStatus: "planned" | "in_progress" | "paused" | "postponed" | "done",
  ) =>
    fullItem({
      activityId: ACTIVITY_ID,
      text: "Activity item",
      workflowStatus,
    });

  const activityRisk = (severity: string) =>
    fullRisk({ activityId: ACTIVITY_ID, risk: "Activity risk", severity });

  const activityRow = (over: {
    items?: ReturnType<typeof fullItem>[];
    risks?: ReturnType<typeof fullRisk>[];
    storedStatus?: TrafficLightStatus | null;
  }): FabricatedRow =>
    baseRow({
      items: over.items ?? [],
      risks: over.risks ?? [],
      activityStatuses: [
        {
          id: `${ACTIVITY_ID}-status`,
          reportSectionId: SECTION_ID,
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
          activityId: ACTIVITY_ID,
          status: over.storedStatus ?? "green",
          note: null,
          activity: {
            name: "Jira triage duty",
            activityProducts: [
              { product: { id: LINKED_PRODUCT, name: "CRM Portal" } },
            ],
          },
        },
      ],
    });

  it("keeps an activity-parented item in the flat items array, product FK null", () => {
    const section = mapRow(
      activityRow({ items: [activityItem("in_progress")] }),
    );
    expect(section.items).toHaveLength(1);
    expect(section.items[0]?.activityId).toBe(ACTIVITY_ID);
    expect(section.items[0]?.projectId ?? null).toBeNull();
  });

  it("joins linkedProducts (id + name) onto the activity", () => {
    const section = mapRow(activityRow({}));
    expect(section.activities[0]?.linkedProducts).toEqual([
      { productId: LINKED_PRODUCT, productName: "CRM Portal" },
    ]);
  });

  it("an item's progress status never floors the pill (alarms are risks)", () => {
    const section = mapRow(
      activityRow({ storedStatus: "green", items: [activityItem("paused")] }),
    );
    expect(section.activities[0]?.status).toBe("green");
    expect(section.activities[0]?.derivedStatus).toBe("green");
  });

  it("floors at least yellow for a covering at-risk own risk", () => {
    const section = mapRow(
      activityRow({ storedStatus: "green", risks: [activityRisk("at-risk")] }),
    );
    expect(section.activities[0]?.derivedStatus).toBe("yellow");
  });

  it("floors red for a blocked own risk on a green pill", () => {
    const section = mapRow(
      activityRow({ storedStatus: "green", risks: [activityRisk("blocked")] }),
    );
    expect(section.activities[0]?.derivedStatus).toBe("red");
  });

  it("passes the stored status through when no own record floors it", () => {
    const section = mapRow(activityRow({ storedStatus: "green" }));
    expect(section.activities[0]?.derivedStatus).toBe("green");
  });
});
