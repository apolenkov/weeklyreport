import type {
  MyHistoryEntry,
  ReportSectionReadModel,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  mapLeadDecisions,
  mapLeadFormData,
  mapLeadItems,
  mapLeadPeriods,
  mapLeadPriorities,
  mapLeadProducts,
  mapLeadRisks,
  ownedStagesForProject,
  stageNamesMatch,
} from "./lead-form";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_A = "44444444-4444-4444-8444-444444444444";
const PROJECT_B = "55555555-5555-4555-8555-555555555555";

function baseSection(
  overrides: Partial<ReportSectionReadModel> = {},
): ReportSectionReadModel {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Тимлид 1",
    status: "draft",
    submittedAt: null,
    projects: [],
    items: [],
    risks: [],
    decisions: [],
    ...overrides,
  };
}

describe("mapLeadProducts", () => {
  it("marks a stage as `mine` when it appears in ownedStages and renders the rest as unassigned", () => {
    // 35-04: the lead owns the Dev stage on this project (real
    // StageAssignment data), so the chip surfaces as `mine` with the
    // project's traffic-light status. Pre-35-04 this was synthesized
    // unconditionally — the bug was that the synthesized "Dev" chip
    // didn't reflect actual assignments.
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM Platform",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "stage-dev",
              stageName: "Development",
              sortOrder: 3,
              status: "green",
            },
          ],
        },
      ],
    });

    const products = mapLeadProducts(section);

    expect(products).toHaveLength(1);
    expect(expectDefined(products[0]).id).toBe(PROJECT_A);
    expect(expectDefined(products[0]).name).toBe("CRM Platform");
    expect(expectDefined(products[0]).overallStatus).toBe("on-track");
    expect(expectDefined(products[0]).stages).toHaveLength(7);
    // "Development" in the seed maps to the compact "Dev" pipeline label
    // via the alias in buildStageGrid.
    const devStage = expectDefined(products[0]).stages.find(
      (s) => s.stageName === "Dev",
    );
    expect(devStage?.ownership).toBe("mine");
    expect(devStage?.assignee).toBe("Тимлид 1");
    expect(devStage?.status).toBe("on-track");
    // Stages outside ownedStages render as unassigned with no assignee.
    const planningStage = expectDefined(products[0]).stages.find(
      (s) => s.stageName === "Planning",
    );
    expect(planningStage?.ownership).toBe("unassigned");
    expect(planningStage?.assignee).toBeNull();
  });

  it("maps a null trafficLight project to overallStatus empty", () => {
    const section = baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: "Stale", trafficLight: null },
      ],
    });

    const product = mapLeadProducts(section).at(0);
    expect(product?.overallStatus).toBe("empty");
  });

  it("uses per-stage statuses instead of copying the product status to every owned stage", () => {
    // rethink-pipeline-state-vs-completeness: status is now derived from risks.
    // The Testing severity must come from a covering blocker, not a persisted
    // red with nothing to back it (that would collapse to on-track). The point
    // of the test — stages carry DISTINCT statuses, not the product-wide red —
    // still holds: Dev=on-track, Testing=blocked, DevOps=empty.
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM Platform",
          trafficLight: "red",
          ownedStages: [
            {
              stageId: "11111111-1111-4111-8111-111111111111",
              stageName: "Development",
              sortOrder: 3,
              status: "green",
            },
            {
              stageId: "22222222-2222-4222-8222-222222222222",
              stageName: "Testing",
              sortOrder: 4,
              status: "red",
            },
            {
              stageId: "33333333-3333-4333-8333-333333333333",
              stageName: "DevOps",
              sortOrder: 5,
              status: null,
            },
          ],
        },
      ],
      risks: [
        {
          projectId: PROJECT_A,
          risk: "Testing environment is down",
          impact: "blocks release",
          mitigation: "restore infra",
          severity: "blocked",
          stageIds: ["Testing"],
        },
      ],
    });

    const product = mapLeadProducts(section).at(0);
    const stages = new Map(product?.stages.map((s) => [s.stageName, s.status]));

    expect(stages.get("Dev")).toBe("on-track");
    expect(stages.get("Testing")).toBe("blocked");
    expect(stages.get("DevOps")).toBe("empty");
  });

  it("collapses a persisted at-risk/blocked stage with no covering risk to on-track", () => {
    // rethink-pipeline-state-vs-completeness (supersedes PRJ-2 "explicit wins"):
    // a stale persisted severity that no risk backs can no longer survive.
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM Platform",
          trafficLight: "red",
          ownedStages: [
            {
              stageId: "22222222-2222-4222-8222-222222222222",
              stageName: "Testing",
              sortOrder: 4,
              status: "red",
            },
          ],
        },
      ],
    });

    const product = mapLeadProducts(section).at(0);
    const stages = new Map(product?.stages.map((s) => [s.stageName, s.status]));
    expect(stages.get("Testing")).toBe("on-track");
  });

  it("returns empty array when the section has no projects", () => {
    expect(mapLeadProducts(baseSection())).toEqual([]);
  });

  it("renders all 7 stages as `mine` when the lead owns every stage on the project (BUG-143 reproducer)", () => {
    // The user-reported bug: assigning the lead to all 7 SDLC stages on
    // the Products admin tab should surface every stage as `mine` on
    // /lead/report. Pre-35-04 the synthesized grid only ever marked
    // "Dev" as mine, dropping the other six.
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM Platform",
          trafficLight: "green",
          ownedStages: [
            { stageId: "s1", stageName: "Planning", sortOrder: 0 },
            { stageId: "s2", stageName: "Analysis", sortOrder: 1 },
            { stageId: "s3", stageName: "Design", sortOrder: 2 },
            { stageId: "s4", stageName: "Development", sortOrder: 3 },
            { stageId: "s5", stageName: "Testing", sortOrder: 4 },
            { stageId: "s6", stageName: "DevOps", sortOrder: 5 },
            { stageId: "s7", stageName: "Support", sortOrder: 6 },
          ],
        },
      ],
    });

    const product = mapLeadProducts(section).at(0);
    expect(product?.stages.every((s) => s.ownership === "mine")).toBe(true);
  });

  it("without ownedStages, every stage is unassigned (the lead has no stake on this project)", () => {
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM Platform",
          trafficLight: "green",
          ownedStages: [],
        },
      ],
    });

    const product = mapLeadProducts(section).at(0);
    expect(product?.stages.every((s) => s.ownership === "unassigned")).toBe(
      true,
    );
  });

  it("a covering risk floors a stale persisted on-track status (unify-risk-stage-status D1, supersedes PRJ-2)", () => {
    // The PRJ-2 test that lived here pinned the opposite: risks were
    // disconnected so explicit chip status always won. D1 re-connects the
    // derivation — a chip can never show on-track while a non-empty
    // covering risk exists, on any surface fed by this mapper.
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM Platform",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "stage-dev",
              stageName: "Development",
              sortOrder: 3,
              status: "green",
            },
          ],
        },
      ],
      risks: [
        {
          projectId: PROJECT_A,
          risk: "Integration blocker",
          impact: "Delays release",
          mitigation: "Escalate to PM",
          severity: "at-risk",
          stageIds: ["Development"],
        },
      ],
    });

    const products = mapLeadProducts(section);
    const devStage = products[0]?.stages.find((s) => s.stageName === "Dev");
    expect(devStage?.status).toBe("at-risk");
  });

  it("a blocked covering risk beats an at-risk one (severity floor precedence)", () => {
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM Platform",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "stage-dev",
              stageName: "Development",
              sortOrder: 3,
              status: "yellow",
            },
          ],
        },
      ],
      risks: [
        {
          projectId: PROJECT_A,
          risk: "Minor slip",
          impact: "Schedule",
          mitigation: "Replan",
          severity: "at-risk",
          stageIds: ["Development"],
        },
        {
          projectId: PROJECT_A,
          risk: "Vendor outage",
          impact: "Work stopped",
          mitigation: "Escalate",
          severity: "blocked",
          stageIds: ["Development"],
        },
      ],
    });

    const devStage = mapLeadProducts(section)[0]?.stages.find(
      (s) => s.stageName === "Dev",
    );
    expect(devStage?.status).toBe("blocked");
  });

  it("a stage-less (empty stageIds) risk floors every owned chip (unify-risk-stage-status review-fix)", () => {
    // Empty/undefined stageIds means "covers all stages" — the same rule the
    // live form applies. Before the fix the read model used `stageIds?.some`
    // and floored nothing on `[]`, diverging silently from the form.
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM Platform",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "stage-dev",
              stageName: "Development",
              sortOrder: 3,
              status: "green",
            },
            {
              stageId: "stage-test",
              stageName: "Testing",
              sortOrder: 4,
              status: "green",
            },
          ],
        },
      ],
      risks: [
        {
          projectId: PROJECT_A,
          risk: "Legacy stage-less blocker",
          impact: "Everything stalls",
          mitigation: "Escalate",
          severity: "blocked",
          stageIds: [],
        },
      ],
    });

    const stages = mapLeadProducts(section)[0]?.stages ?? [];
    expect(stages.find((s) => s.stageName === "Dev")?.status).toBe("blocked");
    expect(stages.find((s) => s.stageName === "Testing")?.status).toBe(
      "blocked",
    );
  });

  it("an UNTOUCHED owned stage covered by a risk stays empty (rethink-pipeline completeness fix)", () => {
    // rethink-pipeline-state-vs-completeness (D1): the read model feeds the live
    // form's own-input completeness counter via the raw, pre-floor status. A
    // covering risk (the Add-Risk dialog defaults to all stages checked) must
    // NOT floor a stage the lead never set — otherwise an empty stage would
    // count as "filled" and inflate the counter to "your input is complete".
    // The DISPLAY floor is re-applied at render by applyRiskSeverityFloor; this
    // mapper output is the completeness source, so the empty stays empty.
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM Platform",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "stage-dev",
              stageName: "Development",
              sortOrder: 3,
              // No status: the lead never touched this stage.
              status: null,
            },
          ],
        },
      ],
      risks: [
        {
          projectId: PROJECT_A,
          risk: "Product-wide blocker",
          impact: "Everything stalls",
          mitigation: "Escalate",
          severity: "blocked",
          stageIds: [],
        },
      ],
    });

    const devStage = mapLeadProducts(section)[0]?.stages.find(
      (s) => s.stageName === "Dev",
    );
    expect(devStage?.status).toBe("empty");
    // W11: a covers-all (stageIds: []) legacy risk does NOT explicitly name the
    // stage, so it must NOT mark it covered-by-own-risk (else the counter would
    // inflate for every empty stage — the original "6/7" defect's root cause).
    expect(devStage?.coveredByOwnRisk ?? false).toBe(false);
  });

  it("W11: an empty owned stage covered by an OWN risk that names it stays empty but is coveredByOwnRisk", () => {
    // fix-report-surface-integrity W11 reload-stability: the mapper derives the
    // flag from PERSISTED risks + raw status (no transient display state), so a
    // reload reproduces it. Raw status stays "empty" (chip distinction relies on
    // it); coveredByOwnRisk=true makes the stage count toward completeness.
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM Platform",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "stage-dev",
              stageName: "Development",
              sortOrder: 3,
              status: null,
            },
            {
              stageId: "stage-testing",
              stageName: "Testing",
              sortOrder: 5,
              status: null,
            },
          ],
        },
      ],
      risks: [
        {
          projectId: PROJECT_A,
          risk: "Dev environment blocked",
          impact: "Cannot ship",
          mitigation: "Escalate to ops",
          severity: "blocked",
          stageIds: ["Development"],
        },
      ],
    });

    const stages = mapLeadProducts(section)[0]?.stages ?? [];
    const dev = stages.find((s) => s.stageName === "Dev");
    const testing = stages.find((s) => s.stageName === "Testing");
    // The named stage: raw status preserved empty, but flagged covered.
    expect(dev?.status).toBe("empty");
    expect(dev?.coveredByOwnRisk).toBe(true);
    // A sibling owned stage the risk did NOT name: not covered.
    expect(testing?.status).toBe("empty");
    expect(testing?.coveredByOwnRisk ?? false).toBe(false);
  });

  it("an empty-text risk does not floor the chip (only non-empty risks count)", () => {
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM Platform",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "stage-dev",
              stageName: "Development",
              sortOrder: 3,
              status: "green",
            },
          ],
        },
      ],
      risks: [
        {
          projectId: PROJECT_A,
          risk: " ".repeat(3),
          impact: "tbd",
          mitigation: "tbd",
          severity: "blocked",
          stageIds: ["Development"],
        },
      ],
    });

    const devStage = mapLeadProducts(section)[0]?.stages.find(
      (s) => s.stageName === "Dev",
    );
    expect(devStage?.status).toBe("on-track");
  });

  it("items stay disconnected from chip status (risk-only contract)", () => {
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM Platform",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "stage-dev",
              stageName: "Development",
              sortOrder: 3,
              status: "green",
            },
          ],
        },
      ],
      items: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          projectId: PROJECT_A,
          type: "current",
          text: "Blocked item",
          tag: "tag",
          workflowStatus: "blocked",
          carriedOver: false,
          stageIds: ["Development"],
        },
      ],
    });

    const devStage = mapLeadProducts(section)[0]?.stages.find(
      (s) => s.stageName === "Dev",
    );
    expect(devStage?.status).toBe("on-track");
  });

  it("risks for project A do not affect project B chip status (cross-project isolation)", () => {
    // Regression guard: projectId filter in mapLeadProducts must ensure
    // a risk scoped to project A never leaks into project B's stage grid.
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM Platform",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "s-dev-a",
              stageName: "Development",
              sortOrder: 3,
              status: "green",
            },
          ],
        },
        {
          projectId: PROJECT_B,
          projectName: "Portal",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "s-dev-b",
              stageName: "Development",
              sortOrder: 3,
              status: "green",
            },
          ],
        },
      ],
      risks: [
        {
          projectId: PROJECT_A,
          risk: "Critical path issue",
          impact: "Blocks delivery",
          mitigation: "Rescheduling",
          severity: "blocked",
          stageIds: ["Development"],
        },
      ],
    });

    const products = mapLeadProducts(section);
    const productB = products.find((p) => p.id === PROJECT_B);
    const devStageB = productB?.stages.find((s) => s.stageName === "Dev");
    expect(devStageB?.status).toBe("on-track");
  });
});

describe("mapLeadItems", () => {
  it("returns 'in-progress' for a current-type item with workflowStatus='in_progress'", () => {
    const section = baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: "CRM", trafficLight: "green" },
      ],
      items: [
        {
          id: "item-1",
          projectId: PROJECT_A,
          type: "current",
          text: "Wire OAuth2 callback",
          tag: "auth",
          workflowStatus: "in_progress",
          carriedOver: false,
        },
      ],
    });

    const mapped = mapLeadItems(section, "current").at(0);
    expect(mapped?.status).toBe("in-progress");
    expect(mapped?.text).toBe("Wire OAuth2 callback");
    expect(mapped?.productName).toBe("CRM");
    expect(mapped?.author).toBe("Тимлид 1");
  });

  it("filters items by 'next' type and resolves project name", () => {
    const section = baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: "CRM", trafficLight: "green" },
        { projectId: PROJECT_B, projectName: "Mobile", trafficLight: "yellow" },
      ],
      items: [
        {
          id: "i1",
          projectId: PROJECT_A,
          type: "current",
          text: "this week",
          tag: "a",
          workflowStatus: "in_progress",
          carriedOver: false,
        },
        {
          id: "i2",
          projectId: PROJECT_B,
          type: "next",
          text: "next week",
          tag: "b",
          workflowStatus: "in_progress",
          carriedOver: false,
        },
      ],
    });

    const next = mapLeadItems(section, "next");
    expect(next).toHaveLength(1);
    expect(expectDefined(next[0]).text).toBe("next week");
    expect(expectDefined(next[0]).productName).toBe("Mobile");
  });

  it('falls back to "Unknown" product name when projectId is unmapped', () => {
    const section = baseSection({
      items: [
        {
          id: "orphan",
          projectId: "99999999-9999-4999-8999-999999999999",
          type: "current",
          text: "orphan item",
          tag: "x",
          workflowStatus: "in_progress",
          carriedOver: false,
        },
      ],
    });

    const mapped = mapLeadItems(section, "current").at(0);
    expect(mapped?.productName).toBe("Unknown");
  });
});

describe("mapLeadRisks / mapLeadDecisions / mapLeadPriorities", () => {
  it("exposes risk + impact + mitigation as separate fields and resolves productName", () => {
    const section = baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: "CRM", trafficLight: "yellow" },
      ],
      risks: [
        {
          id: "r1",
          projectId: PROJECT_A,
          risk: "OAuth delay",
          impact: "SSO slips",
          mitigation: "Escalate vendor",
          severity: "blocked",
        },
      ],
    });

    const mapped = mapLeadRisks(section).at(0);
    expect(mapped?.productName).toBe("CRM");
    expect(mapped?.severity).toBe("blocked");
    // Phase 22+: text holds raw `risk` only; impact/mitigation surface as
    // separate fields in the edit dialog (avoids double-concat on save).
    expect(mapped?.text).toBe("OAuth delay");
    expect(mapped?.impact).toBe("SSO slips");
    expect(mapped?.mitigation).toBe("Escalate vendor");
  });

  it("passes decisions through with department-scope productName", () => {
    const section = baseSection({
      decisions: [
        {
          id: "d1",
          text: "Approve Redis cluster",
          owner: "Head",
          impact: "Caching",
        },
      ],
    });

    const mapped = mapLeadDecisions(section).at(0);
    expect(mapped?.text).toBe("Approve Redis cluster");
    expect(mapped?.productName).toBe("Group");
  });

  it("derives priorities from items with priorityRank, sorted by rank, floors invalid ranks to 1", () => {
    const section = baseSection({
      items: [
        {
          id: "i1",
          projectId: PROJECT_A,
          type: "current",
          text: "P1",
          tag: "feature",
          workflowStatus: "in_progress",
          carriedOver: false,
          priorityRank: 1,
        },
        {
          id: "i2",
          projectId: PROJECT_A,
          type: "current",
          text: "P5",
          tag: "feature",
          workflowStatus: "in_progress",
          carriedOver: false,
          priorityRank: 5,
        },
        {
          id: "i3",
          projectId: PROJECT_A,
          type: "current",
          text: "invalid-zero",
          tag: "feature",
          workflowStatus: "in_progress",
          carriedOver: false,
          priorityRank: 0,
        },
      ],
    });

    const mapped = mapLeadPriorities(section);
    expect(expectDefined(mapped[0]).rank).toBe(1);
    // Variable-length list keeps rank as-is when ≥ 1.
    expect(expectDefined(mapped[1]).rank).toBe(5);
    expect(expectDefined(mapped[1]).text).toBe("P5");
    // rank=0 is clamped to 1 (clampRank guard).
    expect(expectDefined(mapped[2]).rank).toBe(1);
  });
});

// fix-lead-surface-name-resolution: cards referencing a project the section
// author owns no stage on must resolve the real name from the read model's
// name-only `referencedProjects`, never the placeholder. The placeholder
// survives only for an id the entire name source cannot resolve.
describe("report-wide name resolution (referencedProjects)", () => {
  const FOREIGN_PROJECT = "66666666-6666-4666-8666-666666666666";
  const TRULY_UNKNOWN = "99999999-9999-4999-8999-999999999999";

  function crossStageSection(
    overrides: Partial<ReportSectionReadModel> = {},
  ): ReportSectionReadModel {
    return baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: "CRM", trafficLight: "green" },
      ],
      referencedProjects: [
        { projectId: FOREIGN_PROJECT, projectName: "Payments Gateway" },
      ],
      ...overrides,
    });
  }

  it("resolves a risk's product name from referencedProjects when the author owns no stage on it", () => {
    const section = crossStageSection({
      risks: [
        {
          id: "r1",
          projectId: FOREIGN_PROJECT,
          risk: "Cross-stage risk",
          impact: "Impact",
          mitigation: "Mitigation",
        },
      ],
    });

    expect(mapLeadRisks(section).at(0)?.productName).toBe("Payments Gateway");
  });

  it("resolves a decision's product name from referencedProjects instead of 'Group'", () => {
    const section = crossStageSection({
      decisions: [
        {
          id: "d1",
          text: "Cross-stage decision",
          owner: "Owner",
          impact: "Impact",
          productId: FOREIGN_PROJECT,
        },
      ],
    });

    expect(mapLeadDecisions(section).at(0)?.productName).toBe(
      "Payments Gateway",
    );
  });

  it("resolves item and priority product names from referencedProjects", () => {
    const section = crossStageSection({
      items: [
        {
          id: "i1",
          projectId: FOREIGN_PROJECT,
          type: "current",
          text: "Cross-stage item",
          tag: "x",
          workflowStatus: "in_progress",
          carriedOver: false,
          priorityRank: 1,
        },
      ],
    });

    expect(mapLeadItems(section, "current").at(0)?.productName).toBe(
      "Payments Gateway",
    );
    expect(mapLeadPriorities(section).at(0)?.productName).toBe(
      "Payments Gateway",
    );
  });

  it("keeps the placeholder for an id the entire name source cannot resolve", () => {
    const section = crossStageSection({
      risks: [
        {
          id: "r1",
          projectId: TRULY_UNKNOWN,
          risk: "Foreign risk",
          impact: "Impact",
          mitigation: "Mitigation",
        },
      ],
      decisions: [
        {
          id: "d1",
          text: "Foreign decision",
          owner: "Owner",
          impact: "Impact",
          productId: TRULY_UNKNOWN,
        },
      ],
    });

    expect(mapLeadRisks(section).at(0)?.productName).toBe("Unknown");
    expect(mapLeadDecisions(section).at(0)?.productName).toBe("Group");
  });

  it("prefers the stage-owned entry when the same id is also referenced (Decision 3)", () => {
    const section = crossStageSection({
      referencedProjects: [{ projectId: PROJECT_A, projectName: "Stale Copy" }],
      risks: [
        {
          id: "r1",
          projectId: PROJECT_A,
          risk: "Owned-project risk",
          impact: "Impact",
          mitigation: "Mitigation",
        },
      ],
    });

    expect(mapLeadRisks(section).at(0)?.productName).toBe("CRM");
  });

  it("does not add a stray product card for a referenced-only project", () => {
    const section = crossStageSection();
    const products = mapLeadProducts(section);

    expect(products).toHaveLength(1);
    expect(products.at(0)?.id).toBe(PROJECT_A);
  });
});

describe("mapLeadPeriods", () => {
  it("flags the active report id as isCurrent and submitted sections as isSubmitted", () => {
    const history: MyHistoryEntry[] = [
      {
        sectionId: SECTION_ID,
        reportId: REPORT_ID,
        periodStart: new Date("2026-04-14T00:00:00Z"),
        periodEnd: new Date("2026-04-20T00:00:00Z"),
        reportStatus: "draft",
        sectionStatus: "draft",
        submittedAt: null,
        publishedAt: null,
        itemCount: 7,
        riskCount: 2,
        productCount: 4,
      },
      {
        sectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        reportId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        periodStart: new Date("2026-04-07T00:00:00Z"),
        periodEnd: new Date("2026-04-13T00:00:00Z"),
        reportStatus: "published",
        sectionStatus: "submitted",
        submittedAt: new Date("2026-04-13T17:42:00Z"),
        publishedAt: new Date("2026-04-13T18:00:00Z"),
      },
    ];

    const periods = mapLeadPeriods(history, REPORT_ID);

    expect(expectDefined(periods[0]).isCurrent).toBe(true);
    expect(expectDefined(periods[0]).isSubmitted).toBe(false);
    expect(expectDefined(periods[1]).isCurrent).toBe(false);
    expect(expectDefined(periods[1]).isSubmitted).toBe(true);
    expect(expectDefined(periods[0]).dateRange).toBe("Apr 14–20, 2026");
    expect(expectDefined(periods[0]).itemCount).toBe(7);
    expect(expectDefined(periods[0]).riskCount).toBe(2);
    expect(expectDefined(periods[0]).productCount).toBe(4);
  });
});

describe("mapLeadFormData", () => {
  it("returns all empty collections when the section is empty", () => {
    const section = baseSection();
    const result = mapLeadFormData({
      active: section,
      byPeriod: { section, readOnly: false },
      history: [],
    });
    expect(result.products).toEqual([]);
    expect(result.currentWeekItems).toEqual([]);
    expect(result.nextWeekItems).toEqual([]);
    expect(result.risks).toEqual([]);
    expect(result.decisions).toEqual([]);
    expect(result.priorities).toEqual([]);
    expect(result.periods).toEqual([]);
    expect(result.readOnly).toBe(false);
    expect(result.currentUser.name).toBe("Тимлид 1");
    expect(result.currentUser.initials).toBe("Т1");
  });

  it("locks readOnly when section status is submitted", () => {
    const section = baseSection({
      status: "submitted",
      submittedAt: new Date("2026-04-20T18:00:00Z"),
    });
    const result = mapLeadFormData({
      active: section,
      byPeriod: { section, readOnly: false },
      history: [],
    });
    expect(result.readOnly).toBe(true);
  });

  it("locks readOnly when byPeriod marks the period as read-only", () => {
    const section = baseSection();
    const result = mapLeadFormData({
      active: section,
      byPeriod: { section, readOnly: true },
      history: [],
    });
    expect(result.readOnly).toBe(true);
  });
});

describe("stageNamesMatch", () => {
  it("treats 'Development' and 'Dev' as equivalent (alias)", () => {
    expect(stageNamesMatch("Development", "Dev")).toBe(true);
    expect(stageNamesMatch("Dev", "Development")).toBe(true);
    expect(stageNamesMatch("development", "dev")).toBe(true);
  });

  it("matches identical names case-insensitively", () => {
    expect(stageNamesMatch("Planning", "Planning")).toBe(true);
    expect(stageNamesMatch("TESTING", "testing")).toBe(true);
  });

  it("does not match unrelated names", () => {
    expect(stageNamesMatch("Planning", "Testing")).toBe(false);
    expect(stageNamesMatch("Dev", "DevOps")).toBe(false);
  });
});

describe("ownedStagesForProject", () => {
  it("returns canonical pipeline name 'Dev' when DB stores 'Development'", () => {
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "s1",
              stageName: "Development",
              sortOrder: 3,
              status: "green",
            },
          ],
        },
      ],
    });
    const result = ownedStagesForProject(section, PROJECT_A);
    expect(result).toContain("Dev");
    expect(result).not.toContain("Development");
  });

  it("returns canonical names for all owned stages scoped to a project", () => {
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "s1",
              stageName: "Development",
              sortOrder: 3,
              status: "green",
            },
            { stageId: "s2", stageName: "Testing", sortOrder: 4, status: null },
          ],
        },
        {
          projectId: PROJECT_B,
          projectName: "ERP",
          trafficLight: "yellow",
          ownedStages: [
            {
              stageId: "s3",
              stageName: "Planning",
              sortOrder: 1,
              status: null,
            },
          ],
        },
      ],
    });
    const resultA = ownedStagesForProject(section, PROJECT_A);
    expect([...resultA].sort()).toEqual(["Dev", "Testing"]);

    const resultB = ownedStagesForProject(section, PROJECT_B);
    expect(resultB).toEqual(["Planning"]);
  });

  it("returns union across all projects when projectId is undefined", () => {
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM",
          trafficLight: "green",
          ownedStages: [
            { stageId: "s1", stageName: "Dev", sortOrder: 3, status: "green" },
          ],
        },
        {
          projectId: PROJECT_B,
          projectName: "ERP",
          trafficLight: null,
          ownedStages: [
            {
              stageId: "s2",
              stageName: "Planning",
              sortOrder: 1,
              status: null,
            },
          ],
        },
      ],
    });
    const result = ownedStagesForProject(section, undefined);
    expect([...result].sort()).toEqual(["Dev", "Planning"]);
  });

  it("agrees with mapLeadProducts on which stages are 'mine'", () => {
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "s1",
              stageName: "Development",
              sortOrder: 3,
              status: "green",
            },
            { stageId: "s2", stageName: "Testing", sortOrder: 4, status: null },
          ],
        },
      ],
    });
    const ownedNames = ownedStagesForProject(section, PROJECT_A);
    const products = mapLeadProducts(section);
    const mineInGrid =
      products[0]?.stages
        .filter((s) => s.ownership === "mine")
        .map((s) => s.stageName) ?? [];
    expect([...ownedNames].sort()).toEqual([...mineInGrid].sort());
  });
});
