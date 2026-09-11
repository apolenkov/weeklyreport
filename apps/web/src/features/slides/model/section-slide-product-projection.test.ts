import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  makeReportSectionFixture,
  type ReportSectionFixture,
} from "../../../test-utils/report-section-fixtures";
import { CROSS_PRODUCT_ID } from "./section-slide-model-helpers";
import { buildSectionProductProjection } from "./section-slide-product-projection";

const section = (over: ReportSectionFixture = {}): ReportSectionReadModel =>
  makeReportSectionFixture({
    reportSectionId: "sec-1",
    reportId: "rep-1",
    authorId: "lead-1",
    authorName: "Lead One",
    projects: [{ projectId: "p1", projectName: "Alpha", trafficLight: null }],
    ...over,
  });

describe("buildSectionProductProjection — cross-product slide", () => {
  it("omits the cross-product slide when nothing references a null/unowned project", () => {
    const projection = buildSectionProductProjection(
      section({
        items: [
          {
            type: "current",
            text: "own item",
            tag: "",
            workflowStatus: "in_progress",
            carriedOver: false,
            projectId: "p1",
            stageNames: [],
          },
        ],
      }),
    );
    expect(
      projection.productSlides.some((slide) => slide.id === CROSS_PRODUCT_ID),
    ).toBe(false);
  });

  it("adds a cross-product slide when an item references no known project", () => {
    const projection = buildSectionProductProjection(
      section({
        items: [
          {
            type: "current",
            text: "orphan item",
            tag: "",
            workflowStatus: "in_progress",
            carriedOver: false,
            projectId: "unowned-product",
            stageNames: [],
          },
        ],
      }),
    );
    const crossSlide = projection.productSlides.find(
      (slide) => slide.id === CROSS_PRODUCT_ID,
    );
    expect(crossSlide?.currentItems).toEqual(["orphan item"]);
  });

  it("keeps ranks for cross-product priorities", () => {
    const projection = buildSectionProductProjection(
      section({
        items: [
          {
            type: "current",
            text: " ranked orphan ",
            tag: "",
            workflowStatus: "in_progress",
            carriedOver: false,
            projectId: "unowned-product",
            stageNames: [],
            priorityRank: 2,
          },
        ],
      }),
    );
    const crossSlide = projection.productSlides.find(
      (slide) => slide.id === CROSS_PRODUCT_ID,
    );

    expect(crossSlide?.priorities).toEqual(["ranked orphan"]);
    expect(crossSlide?.itemRanks).toEqual({ "ranked orphan": 2 });
  });

  it("keeps next commitments and cancellation reasons concise in slide text", () => {
    const projection = buildSectionProductProjection(
      section({
        items: [
          {
            type: "current",
            text: "Delivered API endpoints",
            tag: "",
            workflowStatus: "in_progress",
            carriedOver: false,
            projectId: "p1",
            nextStepText: "Validate production metrics",
          },
          {
            type: "next",
            text: "Migrate legacy client",
            tag: "",
            workflowStatus: "planned",
            carriedOver: false,
            projectId: "unowned-product",
            resolution: {
              kind: "wont_do",
              eventId: "10000000-0000-4000-8000-000000000101",
              reason: "The dependency was retired",
              actorId: "10000000-0000-4000-8000-000000000102",
              actorName: "Lead One",
              occurredAt: "2026-09-05T08:30:00.000Z",
              previousState: {
                type: "next",
                workflowStatus: "planned",
                pausedReason: null,
                nextStepText: null,
              },
            },
          },
        ],
      }),
    );

    expect(projection.productSlides[0]?.currentItems).toEqual([
      "Delivered API endpoints — Next: Validate production metrics",
    ]);
    expect(
      projection.productSlides.find((slide) => slide.id === CROSS_PRODUCT_ID)
        ?.nextItems,
    ).toEqual(["Migrate legacy client — Won't do: The dependency was retired"]);
  });
});
