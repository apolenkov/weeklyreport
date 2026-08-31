import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  makeReportSectionFixture,
  type ReportSectionFixture,
} from "../../../test-utils/report-section-fixtures";
import type { CrossAuthorContentRow } from "../../report-sections";
import type { SlideProduct } from "./section-slide-contracts";
import {
  applyForeignProductHealth,
  crossAuthorContentToSlideForeign,
  mergeForeignSlideContent,
  type SlideForeignContent,
} from "./section-slide-foreign";

// Test-local empty-content fixture for merge/apply cases.
const EMPTY_SLIDE_FOREIGN_CONTENT: SlideForeignContent = {
  currentItems: [],
  nextItems: [],
  risks: [],
  decisions: [],
};
import { buildSectionSlideModel } from "./section-slide-model";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const SECTION_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PRODUCT_ID = "44444444-4444-4444-8444-444444444444";
const PRODUCT_TWO_ID = "88888888-8888-4888-8888-888888888888";

function makeSection(
  overrides: ReportSectionFixture = {},
): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Alex Lead",
    projects: [
      {
        projectId: PRODUCT_ID,
        projectName: "Core Product",
        trafficLight: "green",
        ownedStages: [
          {
            stageId: "99999999-9999-4999-8999-999999999999",
            stageName: "Build",
            sortOrder: 2,
            status: "green",
          },
          {
            stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            stageName: "Discovery",
            sortOrder: 1,
            status: "yellow",
          },
        ],
      },
    ],
    items: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        projectId: PRODUCT_ID,
        type: "current",
        text: "Closed release blockers",
        tag: "delivery",
        workflowStatus: "done",
        carriedOver: false,
        priorityRank: 1,
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        projectId: PRODUCT_ID,
        type: "next",
        text: "Prepare rollout notes",
        tag: "delivery",
        workflowStatus: "planned",
        carriedOver: false,
      },
    ],
    ...overrides,
  });
}

const FOREIGN_AUTHOR_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function makeForeignRow(
  overrides: Partial<CrossAuthorContentRow> = {},
): CrossAuthorContentRow {
  return {
    authorId: FOREIGN_AUTHOR_ID,
    authorName: "Bria Co-owner",
    authorRole: "lead",
    items: [],
    risks: [],
    decisions: [],
    ...overrides,
  };
}

// scope-lead-report-to-own-contribution: slides keep honest, status-only
// product health for co-owned products without rendering any foreign record.
describe("applyForeignProductHealth", () => {
  function makeProduct(overrides: Partial<SlideProduct> = {}): SlideProduct {
    return {
      id: PRODUCT_ID,
      name: "Mobile",
      status: "green",
      stages: [],
      currentItems: [],
      nextItems: [],
      risks: [],
      decisions: [],
      priorities: [],
      ...overrides,
    };
  }

  it("raises a green product to red when a co-lead's foreign stage is red", () => {
    const result = applyForeignProductHealth(
      [makeProduct({ status: "green" })],
      [{ projectId: PRODUCT_ID, stages: [{ status: "red" }] }],
    );
    expect(result[0]?.status).toBe("red");
  });

  it("keeps the worse own status when foreign is milder", () => {
    const result = applyForeignProductHealth(
      [makeProduct({ status: "red" })],
      [{ projectId: PRODUCT_ID, stages: [{ status: "yellow" }] }],
    );
    expect(result[0]?.status).toBe("red");
  });

  it("ignores foreign stages on a different product", () => {
    const result = applyForeignProductHealth(
      [makeProduct({ id: PRODUCT_ID, status: "green" })],
      [{ projectId: PRODUCT_TWO_ID, stages: [{ status: "red" }] }],
    );
    expect(result[0]?.status).toBe("green");
  });

  it("returns products unchanged when there are no cross-authors", () => {
    const products = [makeProduct({ status: "green" })];
    expect(applyForeignProductHealth(products, [])).toEqual(products);
  });
});

// ---- slides-record-visibility: Everyone foreign-content merge ----

describe("crossAuthorContentToSlideForeign", () => {
  it("classifies items by week, and flattens risks/decisions", () => {
    const out = crossAuthorContentToSlideForeign([
      makeForeignRow({
        items: [
          {
            id: "i1",
            projectId: PRODUCT_ID,
            type: "current",
            text: "Foreign current",
            workflowStatus: "in_progress",
            stageNames: ["Build"],
          },
          {
            id: "i2",
            projectId: PRODUCT_ID,
            type: "next",
            text: "Foreign next",
            workflowStatus: "in_progress",
            stageNames: ["Build"],
          },
        ],
        risks: [
          {
            id: "r1",
            projectId: PRODUCT_ID,
            risk: "Foreign risk",
            impact: "x",
            mitigation: "y",
            severity: "at-risk",
            stageNames: ["Build"],
          },
        ],
        decisions: [
          {
            id: "d1",
            productId: PRODUCT_ID,
            text: "Foreign decision",
            owner: "Bria",
            impact: "z",
            deadline: null,
            stageNames: ["Build"],
          },
        ],
      }),
    ]);
    expect(out.currentItems).toEqual([
      { projectId: PRODUCT_ID, text: "Foreign current", blocked: false },
    ]);
    expect(out.nextItems).toEqual([
      { projectId: PRODUCT_ID, text: "Foreign next", blocked: false },
    ]);
    expect(out.risks).toEqual([
      { projectId: PRODUCT_ID, text: "Foreign risk", blocked: false },
    ]);
    expect(out.decisions).toEqual([
      { projectId: PRODUCT_ID, text: "Foreign decision" },
    ]);
  });
});

describe("mergeForeignSlideContent", () => {
  const foreign: SlideForeignContent = {
    currentItems: [
      { projectId: PRODUCT_ID, text: "Foreign current", blocked: true },
    ],
    nextItems: [
      { projectId: PRODUCT_ID, text: "Foreign next", blocked: false },
    ],
    risks: [{ projectId: PRODUCT_ID, text: "Foreign risk", blocked: false }],
    decisions: [{ projectId: PRODUCT_ID, text: "Foreign decision" }],
  };

  it("folds foreign content into the product grid and KPI counters", () => {
    const base = buildSectionSlideModel(makeSection());
    const merged = mergeForeignSlideContent(base, foreign);

    // Counters reflect own + foreign.
    expect(merged.currentCount).toBe(base.currentCount + 1);
    expect(merged.nextCount).toBe(base.nextCount + 1);
    expect(merged.riskCount).toBe(base.riskCount + 1);
    expect(merged.decisionCount).toBe(base.decisionCount + 1);
    // Foreign blocked current item lifts the blocked KPI; foreign at-risk risk
    // lifts at-risk. Health-derived priorities stay own-only.
    expect(merged.blockedCount).toBe(base.blockedCount + 1);
    expect(merged.atRiskCount).toBe(base.atRiskCount + 1);
    expect(merged.priorityCount).toBe(base.priorityCount);

    const product = merged.productSlides.find((p) => p.id === PRODUCT_ID);
    expect(product?.currentItems).toContain("Foreign current");
    expect(product?.nextItems).toContain("Foreign next");
    expect(product?.risks).toContain("Foreign risk");
    expect(product?.decisions).toContain("Foreign decision");
  });

  it("counts a foreign blocked item exactly like an own blocked risk (parity)", () => {
    // Blocked-ness lives only on risks now (rework-item-status-model), so the
    // "own" side of the parity is a blocked-severity risk, not an item status.
    const ownBlocked = buildSectionSlideModel(
      makeSection({
        risks: [
          {
            id: "own-b",
            projectId: PRODUCT_ID,
            risk: "Own blocked risk",
            impact: "x",
            mitigation: "y",
            severity: "blocked",
            // A stage OUTSIDE the fixture's grid: empty stageNames is the
            // covers-everything wildcard and a covering risk would floor a
            // stage red, adding a derived-project count and breaking the
            // 1:1 parity this test pins.
            stageNames: ["Deploy"],
          },
        ],
      }),
    );
    const base = buildSectionSlideModel(makeSection());
    const mergedBlocked = mergeForeignSlideContent(base, {
      ...EMPTY_SLIDE_FOREIGN_CONTENT,
      currentItems: [
        { projectId: PRODUCT_ID, text: "Foreign blocked", blocked: true },
      ],
    });
    // own blocked risk vs foreign blocked item contribute the same +1 to the blocked KPI.
    expect(mergedBlocked.blockedCount).toBe(ownBlocked.blockedCount);
  });

  it("NEVER mutates the input model or its section (view-only invariant)", () => {
    const section = makeSection();
    const itemsRef = section.items;
    const itemsLenBefore = section.items.length;
    const base = buildSectionSlideModel(section);
    const baseProductsRef = base.productSlides;
    const baseCurrentBefore = base.currentCount;

    mergeForeignSlideContent(base, foreign);

    // The cached section the draft serializes is byte-for-byte unchanged.
    expect(section.items).toBe(itemsRef);
    expect(section.items).toHaveLength(itemsLenBefore);
    // The base slide model is not mutated either (new objects only).
    expect(base.productSlides).toBe(baseProductsRef);
    expect(base.currentCount).toBe(baseCurrentBefore);
    const baseProduct = base.productSlides.find((p) => p.id === PRODUCT_ID);
    expect(baseProduct?.currentItems).not.toContain("Foreign current");
  });

  it("drops a foreign row whose product is not in the deck (no orphan count)", () => {
    const base = buildSectionSlideModel(makeSection());
    const merged = mergeForeignSlideContent(base, {
      ...EMPTY_SLIDE_FOREIGN_CONTENT,
      currentItems: [
        { projectId: PRODUCT_TWO_ID, text: "Off-deck foreign", blocked: false },
      ],
    });
    expect(merged.currentCount).toBe(base.currentCount);
    expect(merged).toBe(base); // nothing landed → same reference
  });

  it("returns the same model reference when there is no foreign content", () => {
    const base = buildSectionSlideModel(makeSection());
    expect(mergeForeignSlideContent(base, EMPTY_SLIDE_FOREIGN_CONTENT)).toBe(
      base,
    );
  });
});
