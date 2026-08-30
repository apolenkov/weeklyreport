import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  makeReportSectionFixture,
  type ReportSectionFixture,
} from "../../../test-utils/report-section-fixtures";
import { mapLeadProducts } from "./lead-form";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_A = "44444444-4444-4444-8444-444444444444";
const PROJECT_B = "55555555-5555-4555-8555-555555555555";
function baseSection(
  overrides: ReportSectionFixture = {},
): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Тимлид 1",
    ...overrides,
  });
}

describe("mapLeadProducts", () => {
  it("marks a stage `mine` and excludes vacant stages when no stageSet is provided", () => {
    // The lead owns the Dev stage on this project (real StageAssignment
    // data), so the chip surfaces as `mine` with the project's traffic-light
    // status. With no `stageSet`, the grid is the owned stages only — every
    // other canonical stage is vacant on this product and is EXCLUDED (no
    // chip), not rendered as a grey "unassigned" placeholder.
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
    // Only the owned stage renders — vacant stages are excluded entirely.
    expect(expectDefined(products[0]).stages).toHaveLength(1);
    // stage-label-canonicalization: the grid carries the canonical "Development"
    // stage name; the compact "Dev" is a pipeline-chip display label only.
    const devStage = expectDefined(products[0]).stages.find(
      (s) => s.stageName === "Development",
    );
    expect(devStage?.ownership).toBe("mine");
    expect(devStage?.assignee).toBe("Тимлид 1.");
    expect(devStage?.status).toBe("on-track");
    // A vacant stage (no assignment) produces NO chip at all.
    const planningStage = expectDefined(products[0]).stages.find(
      (s) => s.stageName === "Planning",
    );
    expect(planningStage).toBeUndefined();
  });

  it("renders a stageSet stage the lead does not own as foreign-owned (locked) and excludes stages absent from the set", () => {
    // Grid from product `stageSet`: own → mine, other lead → locked (read-only),
    // absent from set → excluded.
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
          stageSet: [
            { stageId: "stage-dev", stageName: "Development", sortOrder: 3 },
            { stageId: "stage-test", stageName: "Testing", sortOrder: 4 },
          ],
        },
      ],
    });

    const stages = expectDefined(mapLeadProducts(section)[0]).stages;
    // Development (mine) + Testing (foreign-owned); Planning is absent.
    expect(stages).toHaveLength(2);
    expect(stages.find((s) => s.stageName === "Development")?.ownership).toBe(
      "mine",
    );
    const testing = stages.find((s) => s.stageName === "Testing");
    expect(testing?.ownership).toBe("locked");
    expect(testing?.assignee).toBeNull();
    expect(stages.find((s) => s.stageName === "Planning")).toBeUndefined();
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
    // Status derives from risks: Testing severity must come from a covering
    // blocker, not a bare persisted red. Stages stay distinct
    // (Dev=on-track, Testing=blocked, DevOps=empty).
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
          stageNames: ["Testing"],
        },
      ],
    });

    const product = mapLeadProducts(section).at(0);
    const stages = new Map(product?.stages.map((s) => [s.stageName, s.status]));

    expect(stages.get("Development")).toBe("on-track");
    expect(stages.get("Testing")).toBe("blocked");
    expect(stages.get("DevOps")).toBe("empty");
  });

  it("collapses a persisted at-risk/blocked stage with no covering risk to on-track", () => {
    // A stale persisted severity that no risk backs cannot survive: status
    // always derives from the current covering risk, never from what was
    // last saved.
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

  it("renders all 7 stages as `mine` when the lead owns every stage on the project", () => {
    // Assigning the lead to all 7 SDLC stages on the Products admin tab
    // must surface every stage as `mine` on /lead/report — not just a
    // single hardcoded stage.
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
    // Length guard first: `[].every(...)` is vacuously true, so without it a
    // regression that empties the grid would pass this test silently.
    expect(product?.stages).toHaveLength(7);
    expect(product?.stages.every((s) => s.ownership === "mine")).toBe(true);
  });

  it("without ownedStages or stageSet, the grid is empty (the lead has no stake and no stage is assigned)", () => {
    // No owned stages and no assigned-stage set → nothing to render; vacant
    // stages are excluded rather than grey "unassigned" placeholders.
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
    expect(product?.stages).toHaveLength(0);
  });

  it("a covering risk floors a stale persisted on-track status", () => {
    // A chip can never show on-track while a non-empty covering risk
    // exists, on any surface fed by this mapper.
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
          stageNames: ["Development"],
        },
      ],
    });

    const products = mapLeadProducts(section);
    const devStage = products[0]?.stages.find(
      (s) => s.stageName === "Development",
    );
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
          stageNames: ["Development"],
        },
        {
          projectId: PROJECT_A,
          risk: "Vendor outage",
          impact: "Work stopped",
          mitigation: "Escalate",
          severity: "blocked",
          stageNames: ["Development"],
        },
      ],
    });

    const devStage = mapLeadProducts(section)[0]?.stages.find(
      (s) => s.stageName === "Development",
    );
    expect(devStage?.status).toBe("blocked");
  });

  it("ignores a product risk without an explicit stage", () => {
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
          risk: "Unscoped blocker",
          impact: "Everything stalls",
          mitigation: "Escalate",
          severity: "blocked",
          stageNames: [],
        },
      ],
    });

    const stages = mapLeadProducts(section)[0]?.stages ?? [];
    expect(stages.find((s) => s.stageName === "Development")?.status).toBe(
      "on-track",
    );
    expect(stages.find((s) => s.stageName === "Testing")?.status).toBe(
      "on-track",
    );
  });

  it("does not count a product risk without an explicit stage", () => {
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
          risk: "Unscoped blocker",
          impact: "Everything stalls",
          mitigation: "Escalate",
          severity: "blocked",
          stageNames: [],
        },
      ],
    });

    const devStage = mapLeadProducts(section)[0]?.stages.find(
      (s) => s.stageName === "Development",
    );
    expect(devStage?.status).toBe("empty");
    expect(devStage?.coveredByOwnRisk ?? false).toBe(false);
  });

  it("an empty owned stage covered by an OWN risk that names it stays empty but is coveredByOwnRisk", () => {
    // The mapper derives the flag from PERSISTED risks + raw status (no
    // transient display state), so a reload reproduces it. Raw status stays
    // "empty" (chip distinction relies on it); coveredByOwnRisk=true makes
    // the stage count toward completeness.
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
          stageNames: ["Development"],
        },
      ],
    });

    const stages = mapLeadProducts(section)[0]?.stages ?? [];
    const dev = stages.find((s) => s.stageName === "Development");
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
          stageNames: ["Development"],
        },
      ],
    });

    const devStage = mapLeadProducts(section)[0]?.stages.find(
      (s) => s.stageName === "Development",
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
          text: "Item in progress",
          tag: "tag",
          workflowStatus: "in_progress",
          carriedOver: false,
          stageNames: ["Development"],
        },
      ],
    });

    const devStage = mapLeadProducts(section)[0]?.stages.find(
      (s) => s.stageName === "Development",
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
          stageNames: ["Development"],
        },
      ],
    });

    const products = mapLeadProducts(section);
    const productB = products.find((p) => p.id === PROJECT_B);
    const devStageB = productB?.stages.find(
      (s) => s.stageName === "Development",
    );
    expect(devStageB?.status).toBe("on-track");
  });
});
