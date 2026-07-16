import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import type { CrossAuthorContentRow } from "../../report-sections";
import { buildActivitySlideModel } from "./activity-slide-model";
import { buildProductScopedSlides } from "./product-scoped-slides";
import type { SlideProduct } from "./section-slide-contracts";
import {
  applyForeignProductHealth,
  crossAuthorContentToSlideForeign,
  EMPTY_SLIDE_FOREIGN_CONTENT,
  mergeForeignSlideContent,
  type SlideForeignContent,
} from "./section-slide-foreign";
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
  overrides: Partial<ReportSectionReadModel> = {},
): ReportSectionReadModel {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Alex Lead",
    authorRole: "lead",
    version: 1,
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
    risks: [],
    decisions: [],
    activities: [],
    ...overrides,
  };
}

describe("section slide utilities", () => {
  it("carries the section's activities as a status-pill lane", () => {
    const slide = buildSectionSlideModel(
      makeSection({
        activities: [
          {
            activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            activityName: "Jira triage duty",
            status: "red",
            linkedProducts: [],
            derivedStatus: null,
          },
        ],
      }),
    );

    expect(slide.activities).toEqual([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Jira triage duty",
        status: "red",
        linkedProducts: [],
      },
    ]);
  });

  it("excludes activity-parented records from the product-slide aggregates", () => {
    const activityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const slide = buildSectionSlideModel(
      makeSection({
        items: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            projectId: PRODUCT_ID,
            type: "current",
            text: "Product current item",
            tag: "delivery",
            workflowStatus: "in_progress",
            carriedOver: false,
          },
          {
            id: "77777777-7777-4777-8777-777777777777",
            projectId: null,
            activityId,
            type: "current",
            text: "Activity current item",
            tag: "ops",
            workflowStatus: "in_progress",
            carriedOver: false,
          },
        ],
        activities: [
          {
            activityId,
            activityName: "Jira triage duty",
            status: "green",
            linkedProducts: [],
            derivedStatus: null,
          },
        ],
      }),
    );

    // The activity record rides the pills lane only — never the product quadrants.
    expect(slide.currentItems).toEqual(["Product current item"]);
    expect(slide.currentCount).toBe(1);
    // blockedCount derives only from product trafficLight/risks, never items,
    // so an activity-parented record can never inflate it.
    expect(slide.blockedCount).toBe(0);
    expect(slide.activities?.map((a) => a.name)).toEqual(["Jira triage duty"]);
  });

  it("builds a ready owner slide from a complete section", () => {
    const slide = buildSectionSlideModel(makeSection());

    expect(slide.ownerName).toBe("Alex L.");
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

  it("derives the product status from the floored stages, not the persisted trafficLight (lead-live-walk-2026-06-14 3.1)", () => {
    // rethink-pipeline scope: the slide product badge must match the live
    // pipeline card, whose health = worst risk-derived stage. The old code read
    // `project.trafficLight` (the persisted, pre-floor column) so a stale
    // persisted status drifted the badge from the stages rendered below it.
    //
    // Case A — persisted red stages with NO covering risk collapse, so the
    // product status collapses to green (on-track), not red.
    const collapsed = buildSectionSlideModel(
      makeSection({
        projects: [
          {
            projectId: PRODUCT_ID,
            projectName: "Core Product",
            // Stale persisted red on the project column; no covering risk below.
            trafficLight: "red",
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
                status: "yellow",
              },
            ],
          },
        ],
        risks: [],
      }),
    );
    expect(collapsed.productSlides[0]?.status).toBe("green");

    // Case B — a covering blocked risk on an empty persisted stage floors the
    // product status to red even though the persisted trafficLight is null.
    const floored = buildSectionSlideModel(
      makeSection({
        projects: [
          {
            projectId: PRODUCT_ID,
            projectName: "Core Product",
            // Persisted trafficLight is null (lead never set a traffic column).
            trafficLight: null,
            ownedStages: [
              {
                stageId: "99999999-9999-4999-8999-999999999999",
                stageName: "Build",
                sortOrder: 1,
                status: null,
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
            stageIds: ["Build"],
          },
        ],
      }),
    );
    expect(floored.productSlides[0]?.status).toBe("red");
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
            priorityRank: 1,
          },
          {
            id: "66666666-6666-4666-8666-666666666666",
            projectId: PRODUCT_TWO_ID,
            type: "next",
            text: "Prepare portal rollout",
            tag: "delivery",
            workflowStatus: "planned",
            carriedOver: false,
          },
          {
            id: "77777777-7777-4777-8777-777777777777",
            projectId: PRODUCT_TWO_ID,
            type: "next",
            text: "Protect launch date",
            tag: "delivery",
            workflowStatus: "planned",
            carriedOver: false,
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
          },
          {
            id: "66666666-6666-4666-8666-666666666666",
            projectId: OUTSIDE_PROJECT_ID,
            type: "next",
            text: "Hand over platform runbook",
            tag: "delivery",
            workflowStatus: "planned",
            carriedOver: false,
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
    const [document] = slidesForDensity([model], "document");

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
            stageIds: ["Build"],
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
