import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  makeReportSectionFixture,
  type ReportSectionFixture,
} from "../../../test-utils/report-section-fixtures";
import { buildSectionSlideModel } from "../model/section-slide-model";
import { HeadSlideCarousel } from "./head-slide-carousel";

const makeSection = (over: ReportSectionFixture = {}) =>
  makeReportSectionFixture({
    reportSectionId: "sec-1",
    reportId: "rep-1",
    authorId: "lead-1",
    authorName: "Ирина Смирнова",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    projects: [
      {
        projectId: "p1",
        projectName: "Core Product",
        trafficLight: "green",
        ownedStages: [],
      },
    ],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    ...over,
  });

describe("HeadSlideCarousel — collision-free keys across paginated pages", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders one card per paginated page and logs no duplicate-key warning", () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const base = buildSectionSlideModel(makeSection());
    // paginateSectionSlides splits one section's items across pages without
    // changing `id` — only `pageIndex` differs — reproducing the exact
    // collision the composite key fixes.
    const pageOne = { ...base, pageIndex: 0, pageTotal: 2 };
    const pageTwo = { ...base, pageIndex: 1, pageTotal: 2 };

    render(
      <HeadSlideCarousel
        slides={[pageOne, pageTwo]}
        selectedIndex={0}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(2);
    const keyWarning = errorSpy.mock.calls.find((call) =>
      call.some((arg) => String(arg).includes("same key")),
    );
    expect(keyWarning).toBeUndefined();
  });
});
