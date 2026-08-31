import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { buildProductScopedSlides } from "./product-scoped-slides";

type Section = ReportSectionReadModel;

const makeSection = (over: Partial<Section> = {}): Section => ({
  reportSectionId: "sec-1",
  reportId: "rep-1",
  authorId: "lead-1",
  authorName: "Ivan Petrov",
  authorRole: "lead",
  version: 1,
  status: "submitted",
  submittedAt: new Date("2026-07-01T00:00:00.000Z"),
  late: false,
  projects: [
    {
      projectId: "p1",
      projectName: "Portal",
      trafficLight: "green",
      ownedStages: [],
      stageSet: [],
      ownerGroupId: null,
    },
  ],
  referencedProjects: [],
  items: [],
  risks: [],
  decisions: [],
  activities: [],
  reviews: [],
  ...over,
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
    expect(product.activities).toHaveLength(1);
    if (product.activities === undefined)
      throw new Error("expected activities on the slide");
    expect(product.activities[0]?.id).toBe("act-1");
  });
});
