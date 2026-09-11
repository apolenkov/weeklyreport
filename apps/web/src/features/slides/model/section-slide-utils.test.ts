import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  makeReportSectionFixture,
  type ReportSectionFixture,
} from "../../../test-utils/report-section-fixtures";
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

describe("section slide utilities", () => {
  it("summarizes every activity-parented row rendered by the grid", () => {
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
            priorityRank: 2,
          },
        ],
        risks: [
          {
            id: "88888888-8888-4888-8888-888888888888",
            projectId: null,
            activityId,
            risk: "Activity dependency blocked",
            impact: "Triage stops",
            mitigation: "Escalate",
            severity: "blocked",
          },
        ],
        decisions: [
          {
            id: "99999999-9999-4999-8999-999999999999",
            productId: null,
            activityId,
            text: "Rotate triage ownership",
            owner: "Alex Lead",
            impact: "Restore coverage",
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

    const visibleRows = slide.grid?.products
      .flatMap((product) => product.subsections)
      .flatMap((subsection) => [
        ...subsection.columns.current,
        ...subsection.columns.next,
        ...subsection.columns.risks,
        ...subsection.columns.decisions,
      ]);
    expect(visibleRows?.map((row) => row.text)).toEqual([
      "Product current item",
      "Activity current item",
      "Activity dependency blocked",
      "Rotate triage ownership",
    ]);
    expect(slide.currentItems).toEqual([
      "Product current item",
      "Activity current item",
    ]);
    expect(slide.currentCount).toBe(2);
    expect(slide.riskCount).toBe(1);
    expect(slide.decisionCount).toBe(1);
    expect(slide.priorityCount).toBe(1);
    expect(slide.blockedCount).toBe(1);
    expect(slide.tone).toBe("blocked");
    expect(slide.grid?.worstStatus).toBe("red");
    expect(
      slide.grid?.products.find((product) => product.id === PRODUCT_ID)?.status,
    ).toBe("green");
    expect(slide.grid?.onTrack).toEqual({ on: 1, total: 1 });
    expect(slide.readiness).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "current", status: "ready" }),
        expect.objectContaining({ id: "risks", status: "ready" }),
        expect.objectContaining({ id: "priorities", status: "ready" }),
        expect.objectContaining({ id: "decisions", status: "ready" }),
      ]),
    );
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
          // Discovery is persisted yellow but has NO covering risk, so the
          // shared derivation collapses it to green — the slide agrees with
          // the card (which collapses an unbacked severity to on-track).
          // Build stays green.
          expect.objectContaining({ name: "Discovery", status: "green" }),
          expect.objectContaining({ name: "Build", status: "green" }),
        ],
      }),
    ]);
  });

  it("floors stage statuses by covering risk severity", () => {
    // A stale persisted green/yellow stage covered by a risk must render at
    // the risk's severity on the slides surface too — same floor as the
    // lead form and head review.
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
            stageNames: ["Build"],
          },
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            projectId: PRODUCT_ID,
            risk: "Scope unclear",
            impact: "Rework",
            mitigation: "Clarify",
            severity: "at-risk",
            stageNames: ["Discovery"],
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

  it("collapses a persisted red stage with no covering risk to green, and a red stage with an at-risk-only risk to yellow", () => {
    // The slide derives status from risks via the shared
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
            stageNames: ["Build"],
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

  it("derives the product status from the floored stages, not the persisted trafficLight", () => {
    // The slide product badge must match the live pipeline card, whose health
    // = worst risk-derived stage. Reading the persisted pre-floor
    // `project.trafficLight` would let a stale status drift the badge from
    // the stages rendered below it.
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
            stageNames: ["Build"],
          },
        ],
      }),
    );
    expect(floored.productSlides[0]?.status).toBe("red");
  });

  it("a product risk only floors the explicitly named owned stage", () => {
    const slide = buildSectionSlideModel(
      makeSection({
        risks: [
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            projectId: PRODUCT_ID,
            risk: "Build blocker",
            impact: "Everything stalls",
            mitigation: "Escalate",
            severity: "blocked",
            stageNames: ["Build"],
          },
        ],
      }),
    );

    expect(slide.productSlides[0]?.stages).toEqual([
      expect.objectContaining({ name: "Discovery", status: "green" }),
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
    // stage on, so it is absent from section.projects. They must still render.
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
});
