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
});
