import {
  buildPortfolioProductsFromSnapshotSections,
  computePortfolioOverviewFromReadSections,
} from "@customreport/report-persistence";
import {
  buildEscalationsFromReadSections,
  type ReportSectionReadModel,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  makeSection,
  OWNED_PRODUCT,
  OWNED_STAGE_ID,
  OWNED_STAGE_NAME,
  SECOND_STAGE_ID,
} from "./__tests__/published-section-fixture";

const REFERENCED_PRODUCT = "eeb16c80-2f85-48a0-b838-d8096981ddba";
const SECOND_SECTION_ID = "3b334e9c-d5c3-484d-9b8c-26fdd63206d8";
const SECOND_AUTHOR_ID = "7faa772b-dbd6-4a17-a4eb-85f006fcd0e1";
const FIRST_STAGE = {
  stageId: OWNED_STAGE_ID,
  stageName: OWNED_STAGE_NAME,
  sortOrder: 0,
};
const SECOND_STAGE = {
  stageId: SECOND_STAGE_ID,
  stageName: "Testing",
  sortOrder: 1,
};
const CO_OWNED_STAGE_SET = [FIRST_STAGE, SECOND_STAGE];

function makeCoOwnedProductSections(): ReportSectionReadModel[] {
  return [
    makeSection({
      authorName: "Alice Lead",
      projects: [
        {
          projectId: OWNED_PRODUCT,
          projectName: "CRM Portal",
          trafficLight: "green",
          ownedStages: [{ ...FIRST_STAGE, status: "green" }],
          stageSet: CO_OWNED_STAGE_SET,
        },
      ],
    }),
    makeSection({
      reportSectionId: SECOND_SECTION_ID,
      authorId: SECOND_AUTHOR_ID,
      authorName: "Bob Lead",
      projects: [
        {
          projectId: OWNED_PRODUCT,
          projectName: "CRM Portal",
          trafficLight: "red",
          ownedStages: [{ ...SECOND_STAGE, status: "red" }],
          stageSet: CO_OWNED_STAGE_SET,
        },
      ],
    }),
  ];
}

describe("published portfolio math for a co-owned product", () => {
  const sections = makeCoOwnedProductSections();

  it("counts the worst status once per distinct product", () => {
    const { totals } = computePortfolioOverviewFromReadSections(sections);
    const countedProducts = totals.green + totals.yellow + totals.red;

    expect(totals).toEqual({ green: 0, yellow: 0, red: 1 });
    expect(countedProducts).toBe(1);
  });

  it("counts the product-wide stage union", () => {
    const products = buildPortfolioProductsFromSnapshotSections(sections);

    expect(products[0]?.stageCount).toBe(2);
  });
});

describe("published portfolio display membership", () => {
  it("includes a referenced-only product without inventing health or ownership", () => {
    const sections = [
      makeSection({
        projects: [],
        referencedProjects: [
          {
            projectId: REFERENCED_PRODUCT,
            projectName: "Retired Product",
          },
        ],
      }),
    ];

    expect(buildPortfolioProductsFromSnapshotSections(sections)).toEqual([
      {
        productId: REFERENCED_PRODUCT,
        productName: "Retired Product",
        worstStatus: null,
        stageCount: 0,
        leadIds: [],
        leadNames: [],
      },
    ]);
    expect(computePortfolioOverviewFromReadSections(sections)).toEqual({
      status: "green",
      totals: { green: 0, yellow: 0, red: 0 },
    });
  });

  it("deduplicates mixed membership with owned metadata and health taking precedence", () => {
    const sections = [
      makeSection({
        projects: [],
        referencedProjects: [
          {
            projectId: OWNED_PRODUCT,
            projectName: "Stale Referenced Name",
          },
        ],
      }),
      makeSection({
        reportSectionId: SECOND_SECTION_ID,
        authorId: SECOND_AUTHOR_ID,
        authorName: "Bob Lead",
        projects: [
          {
            projectId: OWNED_PRODUCT,
            projectName: "CRM Portal",
            trafficLight: "yellow",
            ownedStages: [{ ...FIRST_STAGE, status: "yellow" }],
            stageSet: [FIRST_STAGE],
          },
        ],
      }),
    ];

    expect(buildPortfolioProductsFromSnapshotSections(sections)).toEqual([
      {
        productId: OWNED_PRODUCT,
        productName: "CRM Portal",
        worstStatus: "yellow",
        stageCount: 1,
        leadIds: [SECOND_AUTHOR_ID],
        leadNames: ["Bob Lead"],
      },
    ]);
    expect(computePortfolioOverviewFromReadSections(sections).totals).toEqual({
      green: 0,
      yellow: 1,
      red: 0,
    });
  });
});

describe("buildEscalationsFromReadSections", () => {
  it("emits a blocked escalation from a blocked-severity risk (with its stage)", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        risks: [
          {
            id: "0e4f5947-bab4-4e24-a9f3-5cd3d0b1fb42",
            projectId: OWNED_PRODUCT,
            risk: "ETL pipeline blocked",
            impact: "High",
            mitigation: "Await vendor fix",
            severity: "blocked",
            stageNames: ["Development"],
          },
        ],
      }),
    ]);

    expect(escalations).toHaveLength(1);
    expect(escalations[0]).toMatchObject({
      type: "blocked",
      productName: "CRM Portal",
      stageName: "Development",
    });
  });

  it("joins multiple stage names for a multi-stage risk", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        risks: [
          {
            id: "0e4f5947-bab4-4e24-a9f3-5cd3d0b1fb42",
            projectId: OWNED_PRODUCT,
            risk: "Cross-stage regression",
            impact: "High",
            mitigation: "Backport",
            severity: "at-risk",
            stageNames: ["Development", "Testing"],
          },
        ],
      }),
    ]);

    const risk = escalations.find((e) => e.type === "unresolved_risk");
    expect(risk?.stageName).toBe("Development, Testing");
  });

  it("returns the canonical stage for a blocked risk", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        risks: [
          {
            id: "f57e03c5-ed65-4b82-8c58-74cb6f1931de",
            projectId: OWNED_PRODUCT,
            risk: "Legacy blocker",
            impact: "High",
            mitigation: "Escalated",
            severity: "blocked",
            stageNames: ["Development"],
          },
        ],
      }),
    ]);

    expect(escalations[0]?.type).toBe("blocked");
    expect(escalations[0]?.stageName).toBe("Development");
  });

  it("a blocked-severity risk yields ONE escalation, never also unresolved_risk", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        risks: [
          {
            id: "aa514484-bbd6-4583-926f-dc20e922421b",
            projectId: OWNED_PRODUCT,
            risk: "Blocking dependency",
            impact: "High",
            mitigation: "Escalated",
            severity: "blocked",
            stageNames: ["Development"],
          },
        ],
      }),
    ]);

    expect(escalations).toHaveLength(1);
    expect(escalations[0]?.type).toBe("blocked");
    expect(escalations.some((e) => e.type === "unresolved_risk")).toBe(false);
  });

  it("an item's own workflowStatus is never an escalation source", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        items: [
          {
            id: "5b2fe575-86c3-422e-b7ed-5fe858cab7f7",
            projectId: OWNED_PRODUCT,
            type: "current",
            text: "In progress, no covering risk",
            tag: "infra",
            workflowStatus: "in_progress",
            carriedOver: false,
            priorityRank: null,
            stageNames: ["Development"],
          },
        ],
      }),
    ]);

    expect(escalations).toHaveLength(0);
  });

  it("resolves a product name referenced but not owned (never 'Unknown')", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        referencedProjects: [
          { projectId: REFERENCED_PRODUCT, projectName: "Shared Platform" },
        ],
        risks: [
          {
            id: "aa514484-bbd6-4583-926f-dc20e922421b",
            projectId: REFERENCED_PRODUCT,
            risk: "Dependency risk",
            impact: "Medium",
            mitigation: "Coordinate",
            severity: "at-risk",
            stageNames: ["Discovery"],
          },
        ],
      }),
    ]);

    const risk = escalations.find((e) => e.type === "unresolved_risk");
    expect(risk?.productName).toBe("Shared Platform");
    expect(risk?.productName).not.toBe("Unknown");
  });
});

// Co-owned red products appear once per co-owner section; dedupe to ONE at_risk
// per projectId. Per-record blocked/unresolved_risk stay untouched.
describe("buildEscalationsFromReadSections — flagged-red dedupe", () => {
  const SECOND_SECTION_ID = "3b334e9c-d5c3-484d-9b8c-26fdd63206d8";

  function coOwnedRedSections(): ReportSectionReadModel[] {
    const redProject = {
      projectId: OWNED_PRODUCT,
      projectName: "CRM Portal",
      trafficLight: "red" as const,
      ownedStages: [],
    };
    return [
      makeSection({
        authorName: "Alice Lead",
        projects: [redProject],
        // The blocker is a blocked-severity risk, not a blocked item.
        risks: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            projectId: OWNED_PRODUCT,
            risk: "Alice blocker",
            impact: "High",
            mitigation: "Escalated",
            severity: "blocked",
            stageNames: ["Development"],
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            projectId: OWNED_PRODUCT,
            risk: "Alice risk",
            impact: "High",
            mitigation: "Mitigate",
            severity: "at-risk",
            stageNames: ["Development"],
          },
        ],
      }),
      makeSection({
        reportSectionId: SECOND_SECTION_ID,
        authorName: "Bob Lead",
        projects: [redProject],
        risks: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            projectId: OWNED_PRODUCT,
            risk: "Bob blocker",
            impact: "Medium",
            mitigation: "Escalated",
            severity: "blocked",
            stageNames: ["Testing"],
          },
          {
            id: "44444444-4444-4444-8444-444444444444",
            projectId: OWNED_PRODUCT,
            risk: "Bob risk",
            impact: "Medium",
            mitigation: "Mitigate",
            severity: "at-risk",
            stageNames: ["Testing"],
          },
        ],
      }),
    ];
  }

  it("collapses a co-owned flagged-red product to a single at_risk escalation", () => {
    const atRisk = buildEscalationsFromReadSections(
      coOwnedRedSections(),
    ).filter((e) => e.type === "at_risk");

    expect(atRisk).toHaveLength(1);
    expect(atRisk[0]).toMatchObject({
      productName: "CRM Portal",
      description: "Project CRM Portal is flagged red.",
    });
    // leadName is non-nullable and deterministically the first contributor.
    expect(atRisk[0]?.leadName).toBe("Alice Lead");
  });

  it("does not dedupe per-record blocked or unresolved risks", () => {
    const escalations = buildEscalationsFromReadSections(coOwnedRedSections());

    // Each lead's own blocked-severity risk and at-risk risk stays a distinct
    // row — only the product-level flagged-red signal collapses.
    expect(
      escalations.filter((e) => e.type === "blocked").map((e) => e.description),
    ).toEqual(["Alice blocker", "Bob blocker"]);
    expect(
      escalations
        .filter((e) => e.type === "unresolved_risk")
        .map((e) => e.description),
    ).toEqual(["Alice risk", "Bob risk"]);
  });

  it("emits one flagged-red per product on each independent call", () => {
    // A second invocation on the same read model must yield the same single
    // escalation, with no leaked dedupe state across calls.
    const first = buildEscalationsFromReadSections(coOwnedRedSections());
    const second = buildEscalationsFromReadSections(coOwnedRedSections());

    expect(first.filter((e) => e.type === "at_risk")).toHaveLength(1);
    expect(second).toEqual(first);
  });
});
