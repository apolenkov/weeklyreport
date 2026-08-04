import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined";
import {
  makeReportSectionFixture,
  type ReportSectionFixture,
} from "../../../test-utils/report-section-fixtures";
import type { CrossAuthorContentRow } from "../../report-sections";
import { buildActivitySlideModel } from "./activity-slide-model";
import { buildProductScopedSlides } from "./product-scoped-slides";
import { buildSectionSlideModel } from "./section-slide-model";
import { sortSlidesForReview } from "./section-slide-pagination";
import {
  paginateSectionSlides,
  slidesForDensity,
} from "./slide-density-pagination";
import { slideRecordIdentities } from "./slide-record-identities";

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
    items: [],
    risks: [],
    decisions: [],
    ...overrides,
  };
}

describe("section slide utilities — paging, risk stories & transposition", () => {
  it("paginates product-first and preserves every stable record identity", () => {
    const model = buildSectionSlideModel(
      makeSection({
        projects: [
          ...makeSection().projects,
          {
            projectId: PRODUCT_TWO_ID,
            projectName: "Second Product",
            trafficLight: "yellow",
            ownedStages: [],
          },
        ],
      }),
    );

    const pages = paginateSectionSlides(model, 2);
    const sourceIdentities = slideRecordIdentities(model);
    const pageIdentities = pages.flatMap(slideRecordIdentities);

    expect(pages.map((page) => page.pageLabel)).toEqual([
      "Core Product — 1 of 2",
      "Core Product — continuation 2 of 2",
      "Second Product",
    ]);
    expect(pageIdentities).toEqual(sourceIdentities);
    expect(new Set(pageIdentities).size).toBe(pageIdentities.length);
    expect(pages.every((page) => slideRecordIdentities(page).length <= 2)).toBe(
      true,
    );
    expect(pages.every((page) => page.grid?.products.length === 1)).toBe(true);
    expect(
      pages.every((page) => page.grid?.authors === model.grid?.authors),
    ).toBe(true);
  });

  it("keeps document density as the unchanged all-content model", () => {
    const model = buildSectionSlideModel(makeSection());
    const document = expectDefined(slidesForDensity([model], "document")[0]);

    expect(document).toBe(model);
    expect(document.grid?.products).toHaveLength(1);
    expect(slideRecordIdentities(document)).toEqual(
      slideRecordIdentities(model),
    );
  });

  it("preserves Everyone-scoped author, status, and row objects while paging", () => {
    const mine = buildSectionSlideModel(makeSection());
    const everyone = buildSectionSlideModel(makeSection(), {
      foreign: [
        makeForeignRow({
          items: [
            {
              id: "foreign-current",
              projectId: PRODUCT_ID,
              type: "current",
              text: "Foreign current",
              workflowStatus: "in_progress",
              stageNames: ["Build"],
            },
          ],
        }),
      ],
    });
    const sourceRows = everyone.grid?.products.flatMap((product) =>
      product.subsections.flatMap((subsection) => [
        ...subsection.columns.current,
        ...subsection.columns.next,
        ...subsection.columns.risks,
        ...subsection.columns.decisions,
      ]),
    );
    const pages = paginateSectionSlides(everyone, 2);
    const pageRows = pages.flatMap(
      (page) =>
        page.grid?.products.flatMap((product) =>
          product.subsections.flatMap((subsection) => [
            ...subsection.columns.current,
            ...subsection.columns.next,
            ...subsection.columns.risks,
            ...subsection.columns.decisions,
          ]),
        ) ?? [],
    );
    const foreignRow = sourceRows?.find(
      (row) => row.authorId === FOREIGN_AUTHOR_ID,
    );

    expect(slideRecordIdentities(everyone)).toHaveLength(
      slideRecordIdentities(mine).length + 1,
    );
    expect(pageRows).toEqual(sourceRows);
    expect(pageRows.find((row) => row.id === foreignRow?.id)).toBe(foreignRow);
    expect(
      pages.every((page) => page.grid?.authors === everyone.grid?.authors),
    ).toBe(true);
  });

  it("requires a risk story when a severity-flagged risk carries no text yet", () => {
    // The red/yellow signal that demands an explanation must itself be
    // risk-derived: a draft risk flagged blocked but not yet written up
    // counts as a signal without a story.
    const slide = buildSectionSlideModel(
      makeSection({
        risks: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            projectId: PRODUCT_ID,
            risk: "",
            impact: "",
            mitigation: "",
            severity: "blocked",
            stageNames: [],
          },
        ],
      }),
    );

    expect(slide.tone).toBe("blocked");
    expect(slide.readiness).toContainEqual(
      expect.objectContaining({
        id: "risks",
        status: "needs-work",
        required: true,
      }),
    );
    expect(slide.score).toBeLessThan(100);
  });

  it("stale persisted red with zero risks derives green and demands no risk story", () => {
    // The confirmed bug: a persisted red traffic light and red owned stage
    // with NO backing risk must not drive readiness — the visible badge
    // derives green (unbacked severity collapses), so the deck cannot demand
    // "Explain the red or yellow signal" for a signal it does not show.
    const slide = buildSectionSlideModel(
      makeSection({
        projects: [
          {
            projectId: PRODUCT_ID,
            projectName: "Core Product",
            trafficLight: "red",
            ownedStages: [
              {
                stageId: "99999999-9999-4999-8999-999999999999",
                stageName: "Build",
                sortOrder: 1,
                status: "red",
              },
            ],
          },
        ],
        risks: [],
      }),
    );

    const product = expectDefined(slide.productSlides[0]);
    expect(product.status).toBe("green");
    expect(slide.blockedCount).toBe(0);
    expect(slide.atRiskCount).toBe(0);
    expect(slide.tone).not.toBe("blocked");
    expect(slide.readiness).toContainEqual(
      expect.objectContaining({
        id: "risks",
        status: "optional",
        required: false,
        detail: "No active risk signal",
      }),
    );
  });

  it("risk-backed red counts the derived project and the blocked risk independently", () => {
    const slide = buildSectionSlideModel(
      makeSection({
        projects: [
          {
            projectId: PRODUCT_ID,
            projectName: "Core Product",
            trafficLight: "green",
            ownedStages: [
              {
                stageId: "99999999-9999-4999-8999-999999999999",
                stageName: "Build",
                sortOrder: 1,
                status: "red",
              },
            ],
          },
        ],
        risks: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            projectId: PRODUCT_ID,
            risk: "Vendor outage",
            impact: "Build stopped",
            mitigation: "Escalate",
            severity: "blocked",
            stageNames: ["Build"],
          },
        ],
      }),
    );

    const product = expectDefined(slide.productSlides[0]);
    expect(product.status).toBe("red");
    // Derived-red project (1) + blocked project risk (1) stay independent.
    expect(slide.blockedCount).toBe(2);
    expect(slide.tone).toBe("blocked");
    expect(slide.readiness).toContainEqual(
      expect.objectContaining({ id: "risks", status: "ready", required: true }),
    );
  });

  it("cross-product slide always carries a null status, so it never enters severity counts", () => {
    // statusCounts relies on this invariant INSTEAD of filtering by real
    // project id: if the synthetic slide ever gains a derived status, this
    // pin fires and statusCounts must be revisited.
    const slide = buildSectionSlideModel(
      makeSection({
        items: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            projectId: null,
            type: "current",
            text: "Org-wide incident follow-up",
            tag: "delivery",
            workflowStatus: "in_progress",
            carriedOver: false,
          },
        ],
      }),
    );

    const cross = expectDefined(
      slide.productSlides.find((p) => p.id === "cross-product"),
    );
    expect(cross.currentItems).toEqual(["Org-wide incident follow-up"]);
    expect(cross.status).toBeNull();
    expect(slide.blockedCount).toBe(0);
    expect(slide.atRiskCount).toBe(0);
  });

  it("sorts head review slides by risk before score", () => {
    const ready = buildSectionSlideModel(makeSection({ authorName: "Ready" }));
    const warning = buildSectionSlideModel(
      makeSection({
        authorName: "Warning",
        items: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            projectId: PRODUCT_ID,
            type: "current",
            text: "Closed release blockers",
            tag: "delivery",
            workflowStatus: "done",
            carriedOver: false,
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
      }),
    );
    const blocked = buildSectionSlideModel(
      makeSection({
        authorName: "Blocked",
        // Blocked tone must be risk-backed: a bare persisted red without a
        // risk derives green and no longer sorts first.
        risks: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            projectId: PRODUCT_ID,
            risk: "Vendor outage",
            impact: "Build stopped",
            mitigation: "Escalate",
            severity: "blocked",
            stageNames: ["Build"],
          },
        ],
      }),
    );

    expect(
      sortSlidesForReview([ready, warning, blocked]).map((s) => s.tone),
    ).toEqual(["blocked", "warning", "ready"]);
  });

  it("transposes per-lead sections into one slide per product (product scope)", () => {
    const SECTION_TWO_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const AUTHOR_TWO_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

    const alice = makeSection({
      reportSectionId: SECTION_ID,
      authorId: AUTHOR_ID,
      authorName: "Alice",
      status: "submitted",
      submittedAt: new Date("2026-05-20T10:00:00Z"),
      projects: [
        {
          projectId: PRODUCT_ID,
          projectName: "Core Product",
          trafficLight: "green",
          ownedStages: [],
        },
        {
          projectId: PRODUCT_TWO_ID,
          projectName: "Data Portal",
          trafficLight: "yellow",
          ownedStages: [],
        },
      ],
      items: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001",
          projectId: PRODUCT_ID,
          type: "current",
          text: "Alice core work",
          tag: "delivery",
          workflowStatus: "done",
          carriedOver: false,
        },
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002",
          projectId: PRODUCT_TWO_ID,
          type: "next",
          text: "Alice portal next",
          tag: "delivery",
          workflowStatus: "planned",
          carriedOver: false,
        },
      ],
      risks: [],
      decisions: [],
    });

    const bob = makeSection({
      reportSectionId: SECTION_TWO_ID,
      authorId: AUTHOR_TWO_ID,
      authorName: "Bob",
      status: "draft",
      submittedAt: null,
      projects: [
        {
          projectId: PRODUCT_ID,
          projectName: "Core Product",
          trafficLight: "red",
          ownedStages: [],
        },
      ],
      items: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0003",
          projectId: PRODUCT_ID,
          type: "current",
          text: "Bob core work",
          tag: "delivery",
          workflowStatus: "in_progress",
          carriedOver: false,
        },
      ],
      // The blocked tone must come from a risk: Bob's persisted red alone
      // derives green under status-risk-unification.
      risks: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0005",
          projectId: PRODUCT_ID,
          risk: "Core rollout blocked",
          impact: "Release slips",
          mitigation: "Escalate to head",
          severity: "blocked",
          stageNames: [],
        },
      ],
      decisions: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0004",
          text: "Shared roadmap call",
          owner: "Head",
          deadline: null,
          impact: "Cross-product",
          resolvedAt: null,
          productId: null,
        },
      ],
    });

    const slides = buildProductScopedSlides([alice, bob]);
    const byName = Object.fromEntries(slides.map((s) => [s.ownerName, s]));

    expect(slides.map((s) => s.ownerName).sort()).toEqual([
      "Core Product",
      "Data Portal",
      "Shared context",
    ]);

    // Shared product aggregates both leads' items; Bob's blocked risk drives
    // the blocked tone; contributing leads replace the product subtitle.
    const core = expectDefined(byName["Core Product"]);
    expect(core.ownerRole).toBe("product");
    expect(core.products).toEqual(["Alice", "Bob"]);
    expect([...core.currentItems].sort()).toEqual([
      "Alice core work",
      "Bob core work",
    ]);
    expect(core.tone).toBe("blocked");

    // Single-owner product carries only that lead's content.
    const portal = expectDefined(byName["Data Portal"]);
    expect(portal.products).toEqual(["Alice"]);
    expect(portal.nextItems).toEqual(["Alice portal next"]);

    // Cross-product decisions land in a synthetic Shared context slide.
    const shared = expectDefined(byName["Shared context"]);
    expect(shared.decisions).toEqual(["Shared roadmap call"]);
    expect(shared.products).toEqual(["Bob"]);
  });

  it("builds an empty owner slide from activity rows before a section exists", () => {
    const slide = buildActivitySlideModel({
      reportId: REPORT_ID,
      reportSectionId: null,
      leadId: AUTHOR_ID,
      leadName: "Alex Lead",
      email: "alex@example.com",
      status: "draft",
      itemCount: 0,
      riskCount: 0,
      decisionCount: 0,
      priorityCount: 0,
      lastEditAt: null,
      submittedAt: null,
    });

    expect(slide.ownerName).toBe("Alex L.");
    expect(slide.tone).toBe("empty");
    expect(slide.score).toBe(0);
    expect(slide.readiness).toContainEqual(
      expect.objectContaining({
        id: "scope",
        status: "needs-work",
      }),
    );
  });
});
