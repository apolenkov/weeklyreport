import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  buildActivitySlideModel,
  buildProductScopedSlides,
  buildSectionSlideModel,
  buildUnifiedSlideModel,
  scopeSlideToProduct,
  sortSlidesForReview,
} from "./section-slide-utils";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const SECTION_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PRODUCT_ID = "44444444-4444-4444-8444-444444444444";
const PRODUCT_TWO_ID = "88888888-8888-4888-8888-888888888888";

function makeSection(
  overrides: Partial<ReportSectionReadModel> = {},
): ReportSectionReadModel {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Alex Lead",
    authorRole: "lead",
    status: "draft",
    submittedAt: null,
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
        completed: true,
        priorityRank: 1,
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        projectId: PRODUCT_ID,
        type: "next",
        text: "Prepare rollout notes",
        tag: "delivery",
        workflowStatus: "in_progress",
        carriedOver: false,
        completed: null,
      },
    ],
    risks: [],
    decisions: [],
    ...overrides,
  };
}

describe("section slide utilities", () => {
  it("builds a ready owner slide from a complete section", () => {
    const slide = buildSectionSlideModel(makeSection());

    expect(slide.ownerName).toBe("Alex Lead");
    expect(slide.products).toEqual(["Core Product"]);
    expect(slide.currentCount).toBe(1);
    expect(slide.nextCount).toBe(1);
    expect(slide.priorityCount).toBe(1);
    expect(slide.score).toBe(100);
    expect(slide.tone).toBe("ready");
    expect(slide.productSlides).toEqual([
      expect.objectContaining({
        id: PRODUCT_ID,
        name: "Core Product",
        currentItems: ["Closed release blockers"],
        nextItems: ["Prepare rollout notes"],
        priorities: ["Closed release blockers"],
        stages: [
          // rethink-pipeline-state-vs-completeness: Discovery is persisted
          // yellow but has NO covering risk, so the shared derivation collapses
          // it to green — the slide now agrees with the card (which collapses an
          // unbacked severity to on-track). Build stays green.
          expect.objectContaining({ name: "Discovery", status: "green" }),
          expect.objectContaining({ name: "Build", status: "green" }),
        ],
      }),
    ]);
  });

  it("floors stage statuses by covering risk severity (unify-risk-stage-status D1)", () => {
    // A stale persisted green/yellow stage covered by a risk must render at
    // the risk's severity on the slides surface too — same floor as the
    // lead form and head review (spec: status-risk-unification).
    const slide = buildSectionSlideModel(
      makeSection({
        risks: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            projectId: PRODUCT_ID,
            risk: "Vendor outage",
            impact: "Build stopped",
            mitigation: "Escalate",
            severity: "blocked",
            stageIds: ["Build"],
          },
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            projectId: PRODUCT_ID,
            risk: "Scope unclear",
            impact: "Rework",
            mitigation: "Clarify",
            severity: "at-risk",
            stageIds: ["Discovery"],
          },
        ],
      }),
    );

    expect(slide.productSlides[0]?.stages).toEqual([
      // at-risk floor keeps the already-yellow stage yellow.
      expect.objectContaining({ name: "Discovery", status: "yellow" }),
      // blocked risk floors the stale green stage to red.
      expect.objectContaining({ name: "Build", status: "red" }),
    ]);
  });

  it("collapses a persisted red stage with no covering risk to green, and a red stage with an at-risk-only risk to yellow (rethink-pipeline-state-vs-completeness 1.4)", () => {
    // The slide now derives status from risks via the shared
    // deriveEffectiveStageStatus, exactly like the card — so it collapses an
    // unbacked persisted severity DOWN instead of only flooring up. Build is
    // persisted green here so the at-risk risk floors it to yellow; Discovery is
    // persisted yellow with no covering risk so it collapses to green.
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
                sortOrder: 2,
                status: "red",
              },
              {
                stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                stageName: "Discovery",
                sortOrder: 1,
                status: "red",
              },
            ],
          },
        ],
        risks: [
          {
            id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            projectId: PRODUCT_ID,
            risk: "Flaky integration",
            impact: "Rework",
            mitigation: "Stabilize",
            severity: "at-risk",
            stageIds: ["Build"],
          },
        ],
      }),
    );

    expect(slide.productSlides[0]?.stages).toEqual([
      // Persisted red, no covering risk → collapses to green.
      expect.objectContaining({ name: "Discovery", status: "green" }),
      // Persisted red, but the only covering risk is at-risk → collapses to yellow.
      expect.objectContaining({ name: "Build", status: "yellow" }),
    ]);
  });

  it("a stage-less (empty stageIds) legacy risk floors every owned stage (unify-risk-stage-status review-fix)", () => {
    // Empty/undefined stageIds means "covers all stages" in the live form;
    // the slide export must agree so a legacy stage-less risk does not floor
    // every chip in the form yet nothing on the deck. Routing through
    // `riskCoversStage` kills that divergence.
    const slide = buildSectionSlideModel(
      makeSection({
        risks: [
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            projectId: PRODUCT_ID,
            risk: "Legacy stage-less blocker",
            impact: "Everything stalls",
            mitigation: "Escalate",
            severity: "blocked",
            stageIds: [],
          },
        ],
      }),
    );

    expect(slide.productSlides[0]?.stages).toEqual([
      expect.objectContaining({ name: "Discovery", status: "red" }),
      expect.objectContaining({ name: "Build", status: "red" }),
    ]);
  });

  it("groups lead slide content by product and keeps shared decisions visible", () => {
    const slide = buildSectionSlideModel(
      makeSection({
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
            ownedStages: [
              {
                stageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                stageName: "Release",
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
            text: "Close API parity",
            tag: "delivery",
            workflowStatus: "done",
            carriedOver: false,
            completed: true,
            priorityRank: 1,
          },
          {
            id: "66666666-6666-4666-8666-666666666666",
            projectId: PRODUCT_TWO_ID,
            type: "next",
            text: "Prepare portal rollout",
            tag: "delivery",
            workflowStatus: "in_progress",
            carriedOver: false,
            completed: null,
          },
          {
            id: "77777777-7777-4777-8777-777777777777",
            projectId: PRODUCT_TWO_ID,
            type: "next",
            text: "Protect launch date",
            tag: "delivery",
            workflowStatus: "in_progress",
            carriedOver: false,
            completed: null,
            priorityRank: 2,
          },
        ],
        risks: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            projectId: PRODUCT_TWO_ID,
            risk: "Release scope may slip",
            impact: "Launch risk",
            mitigation: "Cut optional polish",
            severity: "at-risk",
          },
        ],
        decisions: [
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            text: "Keep one release train",
            owner: "Head",
            deadline: null,
            impact: "Shared delivery decision",
            resolvedAt: null,
            productId: null,
          },
        ],
      }),
    );

    expect(slide.productSlides).toHaveLength(3);
    expect(slide.productSlides[0]).toEqual(
      expect.objectContaining({
        name: "Core Product",
        currentItems: ["Close API parity"],
        nextItems: [],
        priorities: ["Close API parity"],
      }),
    );
    expect(slide.productSlides[1]).toEqual(
      expect.objectContaining({
        name: "Data Portal",
        currentItems: [],
        nextItems: ["Prepare portal rollout", "Protect launch date"],
        risks: ["Release scope may slip"],
        priorities: ["Protect launch date"],
      }),
    );
    expect(slide.productSlides[2]).toEqual(
      expect.objectContaining({
        name: "Cross-product",
        decisions: ["Keep one release train"],
      }),
    );
  });

  it("routes items and risks referencing an unowned project into the cross-product entry", () => {
    // referencedProjects case: rows point at a project the author owns no
    // stage on, so it is absent from section.projects. They must still render
    // (regression guard for redesign-head-slide-density review finding).
    const OUTSIDE_PROJECT_ID = "12121212-1212-4121-8121-121212121212";
    const slide = buildSectionSlideModel(
      makeSection({
        items: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            projectId: OUTSIDE_PROJECT_ID,
            type: "current",
            text: "Helped platform migration",
            tag: "delivery",
            workflowStatus: "in_progress",
            carriedOver: false,
            completed: null,
          },
          {
            id: "66666666-6666-4666-8666-666666666666",
            projectId: OUTSIDE_PROJECT_ID,
            type: "next",
            text: "Hand over platform runbook",
            tag: "delivery",
            workflowStatus: "in_progress",
            carriedOver: false,
            completed: null,
          },
        ],
        risks: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            projectId: OUTSIDE_PROJECT_ID,
            risk: "Platform dependency may slip",
            impact: "Launch risk",
            mitigation: "Escalate to platform lead",
            severity: "at-risk",
          },
        ],
      }),
    );

    expect(slide.currentCount).toBe(1);
    expect(slide.nextCount).toBe(1);
    expect(slide.riskCount).toBe(1);
    expect(
      slide.productSlides.find((product) => product.id === "cross-product"),
    ).toEqual(
      expect.objectContaining({
        currentItems: ["Helped platform migration"],
        nextItems: ["Hand over platform runbook"],
        risks: ["Platform dependency may slip"],
      }),
    );

    // The unified model the head/lead slides render must keep counts and
    // visible rows in sync.
    const unified = buildUnifiedSlideModel(slide);
    expect(unified.current).toContainEqual(
      expect.objectContaining({
        text: "Helped platform migration",
        productName: "Shared context",
      }),
    );
    expect(unified.next).toContainEqual(
      expect.objectContaining({
        text: "Hand over platform runbook",
        productName: "Shared context",
      }),
    );
    expect(unified.risks).toContainEqual(
      expect.objectContaining({
        text: "Platform dependency may slip",
        productName: "Shared context",
      }),
    );
    expect(unified.risks).toHaveLength(slide.riskCount);
  });

  it("deduplicates duplicate project rows before building product sections", () => {
    const slide = buildSectionSlideModel(
      makeSection({
        projects: [
          {
            projectId: PRODUCT_ID,
            projectName: "Core Product",
            trafficLight: "green",
            ownedStages: [],
          },
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
            text: "Keep CI green",
            tag: "delivery",
            workflowStatus: "done",
            carriedOver: false,
            completed: true,
          },
        ],
      }),
    );

    expect(slide.productSlides).toHaveLength(2);
    expect(slide.productSlides.map((product) => product.name)).toEqual([
      "Core Product",
      "Data Portal",
    ]);
  });

  it("requires a risk story when section signals red or yellow", () => {
    const slide = buildSectionSlideModel(
      makeSection({
        projects: [
          {
            projectId: PRODUCT_ID,
            projectName: "Core Product",
            trafficLight: "red",
            ownedStages: [],
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
            completed: true,
          },
          {
            id: "66666666-6666-4666-8666-666666666666",
            projectId: PRODUCT_ID,
            type: "next",
            text: "Prepare rollout notes",
            tag: "delivery",
            workflowStatus: "in_progress",
            carriedOver: false,
            completed: null,
          },
        ],
      }),
    );
    const blocked = buildSectionSlideModel(
      makeSection({
        authorName: "Blocked",
        projects: [
          {
            projectId: PRODUCT_ID,
            projectName: "Core Product",
            trafficLight: "red",
            ownedStages: [],
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
          completed: true,
        },
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002",
          projectId: PRODUCT_TWO_ID,
          type: "next",
          text: "Alice portal next",
          tag: "delivery",
          workflowStatus: "in_progress",
          carriedOver: false,
          completed: null,
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
          completed: null,
        },
      ],
      risks: [],
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

    // Shared product aggregates both leads' items; worst traffic (green+red)
    // drives the blocked tone; contributing leads replace the product subtitle.
    const core = byName["Core Product"];
    expect(core.ownerRole).toBe("product");
    expect(core.products).toEqual(["Alice", "Bob"]);
    expect([...core.currentItems].sort()).toEqual([
      "Alice core work",
      "Bob core work",
    ]);
    expect(core.tone).toBe("blocked");

    // Single-owner product carries only that lead's content.
    const portal = byName["Data Portal"];
    expect(portal.products).toEqual(["Alice"]);
    expect(portal.nextItems).toEqual(["Alice portal next"]);

    // Cross-product decisions land in a synthetic Shared context slide.
    const shared = byName["Shared context"];
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

    expect(slide.ownerName).toBe("Alex Lead");
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

describe("scopeSlideToProduct (slides-product-autofit)", () => {
  // Two real products plus a shared decision (productId: null), which
  // buildSectionSlideModel routes into the cross-product pseudo-entry.
  function makeMultiProductSlide() {
    return buildSectionSlideModel(
      makeSection({
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
        decisions: [
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            text: "Keep one release train",
            owner: "Head",
            deadline: null,
            impact: "Shared delivery decision",
            resolvedAt: null,
            productId: null,
          },
        ],
      }),
    );
  }

  it("returns the slide unchanged (same reference) for a null product id", () => {
    const slide = makeMultiProductSlide();

    expect(scopeSlideToProduct(slide, null)).toBe(slide);
  });

  it("reduces productSlides to the picked product", () => {
    const slide = makeMultiProductSlide();

    const scoped = scopeSlideToProduct(slide, PRODUCT_TWO_ID);

    expect(scoped.productSlides).toHaveLength(1);
    expect(scoped.productSlides[0]?.id).toBe(PRODUCT_TWO_ID);
    // KPI counts stay section-global (proposal open question 3 default).
    expect(scoped.currentCount).toBe(slide.currentCount);
  });

  it("drops the cross-product pseudo-entry while a product is picked", () => {
    const slide = makeMultiProductSlide();
    expect(slide.productSlides.some((p) => p.id === "cross-product")).toBe(
      true,
    );

    const scoped = scopeSlideToProduct(slide, PRODUCT_ID);

    expect(scoped.productSlides.some((p) => p.id === "cross-product")).toBe(
      false,
    );
    // Even asking for the pseudo-entry itself never surfaces it.
    expect(
      scopeSlideToProduct(slide, "cross-product").productSlides,
    ).toHaveLength(0);
  });

  it("yields empty productSlides for an unknown id and still builds a model", () => {
    const slide = makeMultiProductSlide();

    const scoped = scopeSlideToProduct(slide, "not-a-real-product-id");

    expect(scoped.productSlides).toHaveLength(0);
    const model = buildUnifiedSlideModel(scoped);
    expect(model.current).toHaveLength(0);
    expect(model.next).toHaveLength(0);
    expect(model.risks).toHaveLength(0);
    expect(model.decisions).toHaveLength(0);
  });
});

describe("buildUnifiedSlideModel — cross-product rows (lead-slide-quadrants)", () => {
  it("labels shared rows with the cross-product display name", () => {
    const slide = buildSectionSlideModel(
      makeSection({
        decisions: [
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            text: "Keep one release train",
            owner: "Head",
            deadline: null,
            impact: "Shared delivery decision",
            resolvedAt: null,
            productId: null,
          },
        ],
      }),
    );
    const model = buildUnifiedSlideModel(slide);
    const shared = model.decisions.find(
      (row) => row.text === "Keep one release train",
    );

    expect(shared).toEqual(
      expect.objectContaining({ productName: "Shared context" }),
    );
  });
});
