import { describe, expect, it } from "vitest";

import {
  makeReportSectionFixture,
  type ReportSectionFixture,
} from "../../../test-utils/report-section-fixtures";
import { SHARED_PRODUCT_ID } from "./product-scoped-activity-home";
import { buildProductScopedSlides } from "./product-scoped-slides";

const makeSection = (overrides: ReportSectionFixture = {}) =>
  makeReportSectionFixture({
    reportSectionId: "sec-1",
    reportId: "rep-1",
    authorId: "lead-1",
    authorName: "Ivan Petrov",
    status: "submitted",
    submittedAt: new Date("2026-07-01T00:00:00.000Z"),
    projects: [
      {
        projectId: "p1",
        projectName: "Portal",
        trafficLight: "green",
      },
    ],
    ...overrides,
  });

describe("buildProductScopedSlides", () => {
  it("keeps two contributors with identical display names distinct", () => {
    const slides = buildProductScopedSlides([
      makeSection({ reportSectionId: "sec-1", authorId: "lead-1" }),
      makeSection({
        reportSectionId: "sec-2",
        authorId: "lead-2",
        authorName: "Ivan Petrov",
      }),
    ]);

    const product = slides[0];
    if (product === undefined) throw new Error("expected a product slide");
    expect(product.ownerName).toBe("Portal");
    expect(product.products).toHaveLength(2);
  });

  it("places activity-linked rows on the activity's home product", () => {
    const slides = buildProductScopedSlides([
      makeSection({
        activities: [
          {
            activityId: "act-1",
            activityName: "Triage",
            status: "green",
            jiraAccounts: [],
            derivedStatus: "green",
            alarmFloor: "green",
            linkedProducts: [{ productId: "p1", productName: "Portal" }],
          },
        ],
        items: [
          {
            id: "item-1",
            stableId: "item-stable-1",
            projectId: null,
            activityId: "act-1",
            type: "current",
            text: "Triage item",
            tag: "",
            workflowStatus: "in_progress",
            carriedOver: false,
            stageNames: [],
          },
        ],
      }),
    ]);

    const product = slides[0];
    if (product === undefined) throw new Error("expected a product slide");
    expect(product.ownerName).toBe("Portal");
    expect(
      product.grid?.products[0]?.subsections.flatMap(
        (subsection) => subsection.columns.current,
      ),
    ).toEqual([expect.objectContaining({ id: "item-1", text: "Triage item" })]);
  });

  it("keeps a referenced-only decision with the globally owned product", () => {
    const slides = buildProductScopedSlides([
      makeSection(),
      makeSection({
        reportSectionId: "sec-2",
        authorId: "lead-2",
        authorName: "Alex Morgan",
        projects: [],
        referencedProjects: [
          { projectId: "p1", projectName: "Stale portal name" },
        ],
        decisions: [
          {
            id: "decision-1",
            productId: "p1",
            text: "Keep the release window",
            owner: "Alex Morgan",
            impact: "Avoid customer disruption",
            stageNames: [],
          },
        ],
      }),
    ]);

    expect(slides).toHaveLength(1);
    expect(slides[0]).toMatchObject({
      ownerName: "Portal",
      decisionCount: 1,
      products: ["Ivan P.", "Alex M."],
    });
    expect(slides[0]?.grid?.products).toHaveLength(1);
    expect(
      slides[0]?.grid?.products[0]?.subsections[0]?.columns.decisions,
    ).toEqual([
      expect.objectContaining({
        id: "decision-1",
        authorId: "lead-2",
        text: "Keep the release window",
      }),
    ]);
  });

  it("keeps one contributed Shared card for a status-only unlinked activity", () => {
    const slides = buildProductScopedSlides([
      makeSection({
        projects: [],
        activities: [
          {
            activityId: "act-shared",
            activityName: "Support rotation",
            status: "yellow",
            jiraAccounts: [],
            derivedStatus: "yellow",
            alarmFloor: "yellow",
            linkedProducts: [],
          },
        ],
      }),
    ]);

    expect(slides).toHaveLength(1);
    expect(slides[0]).toMatchObject({
      id: `product-${SHARED_PRODUCT_ID}`,
      ownerName: "Shared context",
      products: ["Ivan P."],
    });
    expect(slides[0]?.grid?.products).toEqual([
      expect.objectContaining({
        id: SHARED_PRODUCT_ID,
        name: "Shared context",
        noData: false,
      }),
    ]);
    expect(slides[0]?.grid?.authors).toEqual([
      expect.objectContaining({
        id: "lead-1",
        name: "Ivan Petrov",
        isOwner: false,
      }),
    ]);
  });
  it("preserves row, priority and legend authors when combining sections", () => {
    const sources = ["lead-1", "lead-2"].map((authorId, index) =>
      makeSection({
        reportSectionId: `section-${authorId}`,
        authorId,
        authorName: index === 0 ? "Ivan Petrov" : "Alex Morgan",
        authorRole: index === 0 ? "lead" : "head",
        items: [
          {
            id: `item-${authorId}`,
            stableId: `stable-${authorId}`,
            projectId: "p1",
            activityId: null,
            type: "current",
            text: `Work ${authorId}`,
            tag: "",
            workflowStatus: "in_progress",
            carriedOver: false,
            stageNames: [],
            priorityRank: 1,
          },
        ],
        risks: [
          {
            id: `risk-${authorId}`,
            projectId: "p1",
            activityId: null,
            risk: `Risk ${authorId}`,
            impact: "Delay",
            mitigation: "Fallback",
            severity: "at-risk",
            stageNames: [],
          },
        ],
      }),
    );
    const grid = buildProductScopedSlides(sources)[0]?.grid;
    expect(grid?.authors).toEqual([
      expect.objectContaining({
        id: "lead-1",
        name: "Ivan Petrov",
        role: "lead",
        isOwner: false,
      }),
      expect.objectContaining({
        id: "lead-2",
        name: "Alex Morgan",
        role: "head",
        isOwner: false,
      }),
    ]);
    const columns = grid?.products[0]?.subsections[0]?.columns;
    expect(
      columns?.current.map(({ id, authorId }) => ({
        id,
        authorId,
      })),
    ).toEqual([
      { id: "item-lead-1", authorId: "lead-1" },
      { id: "item-lead-2", authorId: "lead-2" },
    ]);
    expect(columns?.risks.map(({ authorId }) => authorId)).toEqual([
      "lead-1",
      "lead-2",
    ]);
    expect(
      grid?.priorityStrip.map(({ id, authorId, rank }) => ({
        id,
        authorId,
        rank,
      })),
    ).toEqual([
      { id: "item-lead-1", authorId: "lead-1", rank: 1 },
      { id: "item-lead-2", authorId: "lead-2", rank: 1 },
    ]);
  });
});
