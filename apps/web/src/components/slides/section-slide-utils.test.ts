import { describe, expect, it } from "vitest";

import type { ReportSectionReadModel } from "@customreport/shared";

import {
  buildActivitySlideModel,
  buildSectionSlideModel,
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
    priorities: [
      {
        id: "77777777-7777-4777-8777-777777777777",
        rank: 1,
        text: "Ship the release summary",
        productId: PRODUCT_ID,
      },
    ],
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
        priorities: ["Ship the release summary"],
        stages: [
          expect.objectContaining({ name: "Discovery", status: "yellow" }),
          expect.objectContaining({ name: "Build", status: "green" }),
        ],
      }),
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
        priorities: [
          {
            id: "77777777-7777-4777-8777-777777777777",
            rank: 1,
            text: "Stabilize API",
            productId: PRODUCT_ID,
          },
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            rank: 2,
            text: "Protect launch date",
            productId: PRODUCT_TWO_ID,
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
        priorities: ["Stabilize API"],
      }),
    );
    expect(slide.productSlides[1]).toEqual(
      expect.objectContaining({
        name: "Data Portal",
        currentItems: [],
        nextItems: ["Prepare portal rollout"],
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
        priorities: [],
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
        priorities: [],
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
