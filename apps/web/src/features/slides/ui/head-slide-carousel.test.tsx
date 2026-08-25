import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  let originalScrollIntoView: PropertyDescriptor | undefined;
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalScrollIntoView = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView",
    );
    scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
  });

  afterEach(() => {
    if (originalScrollIntoView) {
      Object.defineProperty(
        HTMLElement.prototype,
        "scrollIntoView",
        originalScrollIntoView,
      );
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
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

    expect(screen.getAllByTestId(/head-slide-card-/)).toHaveLength(2);
    const keyWarning = errorSpy.mock.calls.find((call) =>
      call.some((arg) => String(arg).includes("same key")),
    );
    expect(keyWarning).toBeUndefined();
  });

  it("provides edge-aware arrows and keeps an offscreen card horizontally visible", () => {
    const base = buildSectionSlideModel(makeSection());
    const slides = [0, 1, 2].map((pageIndex) => ({
      ...base,
      ownerName: `Owner ${pageIndex + 1}`,
      pageIndex,
      pageTotal: 3,
    }));
    const onSelect = vi.fn();
    const { rerender } = render(
      <HeadSlideCarousel
        slides={slides}
        selectedIndex={0}
        onSelect={onSelect}
      />,
    );

    const previous = screen.getByRole("button", { name: "Previous slide" });
    const next = screen.getByRole("button", { name: "Next slide" });
    expect(previous).toBeDisabled();
    expect(next).not.toBeDisabled();

    fireEvent.click(next);
    expect(onSelect).toHaveBeenCalledWith(1);

    const viewport = screen.getByTestId("head-slide-carousel-viewport");
    const selectedCard = screen.getByTestId("head-slide-card-1");
    const scrollToMock = vi.fn();
    Object.defineProperty(viewport, "scrollTo", {
      configurable: true,
      value: scrollToMock,
    });
    Object.defineProperty(viewport, "scrollLeft", {
      configurable: true,
      value: 40,
      writable: true,
    });
    Object.defineProperty(viewport, "clientWidth", {
      configurable: true,
      value: 400,
    });
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(
      new DOMRect(100, 0, 400, 0),
    );
    vi.spyOn(selectedCard, "getBoundingClientRect").mockReturnValue(
      new DOMRect(520, 0, 180, 0),
    );

    rerender(
      <HeadSlideCarousel
        slides={slides}
        selectedIndex={1}
        onSelect={onSelect}
      />,
    );
    expect(previous).not.toBeDisabled();
    expect(next).not.toBeDisabled();
    expect(screen.getByTestId("head-slide-card-1")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(scrollToMock).toHaveBeenCalledWith({
      left: 240,
      behavior: "smooth",
    });
    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    fireEvent.click(previous);
    expect(onSelect).toHaveBeenLastCalledWith(0);

    rerender(
      <HeadSlideCarousel
        slides={slides}
        selectedIndex={2}
        onSelect={onSelect}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Previous slide" }),
    ).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Next slide" })).toBeDisabled();
  });
});
