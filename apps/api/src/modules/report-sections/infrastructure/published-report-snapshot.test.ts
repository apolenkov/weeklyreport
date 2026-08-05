import {
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  makeProjectReadModel,
  makeReportSectionReadModel,
  makeSectionActivity,
} from "../../../test-utils/report-section-fixtures.js";
import {
  buildPortfolioProductsFromSnapshotSections,
  computePortfolioOverviewFromReadSections,
} from "./published-report-snapshot";
import { buildEscalationsFromReadSections } from "./report-escalations";

const REPORT_ID = "659b2767-0f86-41e2-b025-49730ca010e4";
const SECTION_ID = "2a223d8b-c4b2-473c-8a7b-15ecc52195c7";
const AUTHOR_ID = "6f99661a-cac6-4d06-bf08-2a14cced554d";
const OWNED_PRODUCT = "4ff69d14-ec8c-4f1c-b62b-73bee530fc7d";
const REFERENCED_PRODUCT = "eeb16c80-2f85-48a0-b838-d8096981ddba";
const OWNED_STAGE_ID = "6366e7ef-e694-454f-863a-7e112ebbc48f";
const SECOND_STAGE_ID = "71e9d6a6-7455-4864-8de9-a48b2f25b13f";
const OWNED_STAGE_NAME = "Development";
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

type ProjectFixture = Partial<ReportSectionReadModel["projects"][number]> &
  Pick<
    ReportSectionReadModel["projects"][number],
    "projectId" | "projectName" | "trafficLight"
  >;
type ActivityFixture = Partial<ReportSectionReadModel["activities"][number]> &
  Pick<
    ReportSectionReadModel["activities"][number],
    "activityId" | "activityName" | "status"
  >;
type SectionFixture = Omit<
  Partial<ReportSectionReadModel>,
  "activities" | "projects"
> & {
  activities?: ActivityFixture[];
  projects?: ProjectFixture[];
};

function makeSection(overrides: SectionFixture = {}): ReportSectionReadModel {
  const { activities = [], projects, ...sectionOverrides } = overrides;
  return reportSectionReadModelSchema.parse(
    makeReportSectionReadModel({
      reportSectionId: SECTION_ID,
      reportId: REPORT_ID,
      authorId: AUTHOR_ID,
      authorName: "Alice Lead",
      status: "submitted",
      submittedAt: null,
      projects: (
        projects ?? [
          {
            projectId: OWNED_PRODUCT,
            projectName: "CRM Portal",
            trafficLight: "green",
          },
        ]
      ).map(makeProjectReadModel),
      activities: activities.map(makeSectionActivity),
      ...sectionOverrides,
    }),
  );
}

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

  it("returns a null stage for a stage-less blocked risk", () => {
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
            stageNames: undefined,
          },
        ],
      }),
    ]);

    expect(escalations[0]?.type).toBe("blocked");
    expect(escalations[0]?.stageName).toBeNull();
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

  it("emits one flagged-red per product regardless of call (live/snapshot parity)", () => {
    // Both surfaces call this same builder, so a second invocation on the same
    // read model must yield the identical single escalation — no leaked dedupe
    // state across calls.
    const first = buildEscalationsFromReadSections(coOwnedRedSections());
    const second = buildEscalationsFromReadSections(coOwnedRedSections());

    expect(first.filter((e) => e.type === "at_risk")).toHaveLength(1);
    expect(second).toEqual(first);
  });
});
