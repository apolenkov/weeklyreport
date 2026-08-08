// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WeeklyReportSkeleton } from "./weekly-report-skeleton";

describe("WeeklyReportSkeleton", () => {
  it("follows the loaded form surface order", () => {
    render(<WeeklyReportSkeleton mode="form" />);

    const root = screen.getByTestId("weekly-report-skeleton");
    expect(
      Array.from(
        root.children,
        (child) => (child as HTMLElement).dataset.testid,
      ),
    ).toEqual([
      "weekly-skeleton-header",
      "weekly-skeleton-context-toolbar",
      "weekly-skeleton-overview",
      "weekly-skeleton-body-continuation",
    ]);
    expect(screen.getByTestId("weekly-skeleton-body-continuation")).toHaveClass(
      "min-h-px",
    );
    expect(
      screen.getByTestId("weekly-skeleton-overview-grid").children,
    ).toHaveLength(15);
  });

  it("uses the slide deck topology for a slides route", () => {
    render(<WeeklyReportSkeleton mode="slides" />);

    expect(screen.getByTestId("slide-skeleton-head-carousel")).toBeVisible();
    expect(screen.getByTestId("slide-skeleton-article")).toBeVisible();
    expect(
      screen.queryByTestId("weekly-skeleton-status"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("weekly-skeleton-overview"),
    ).not.toBeInTheDocument();
  });

  it("reserves the report status only for the loaded form header", () => {
    const { rerender } = render(<WeeklyReportSkeleton mode="form" />);

    expect(screen.getByTestId("weekly-skeleton-status")).toBeVisible();

    rerender(<WeeklyReportSkeleton mode="slides" />);
    expect(
      screen.queryByTestId("weekly-skeleton-status"),
    ).not.toBeInTheDocument();
  });

  it("reserves audience- and mode-specific document actions", () => {
    const { rerender } = render(
      <WeeklyReportSkeleton audience="head" mode="form" />,
    );
    expect(
      screen
        .getByTestId("weekly-skeleton-document-actions")
        .querySelectorAll('[data-slot="skeleton"]'),
    ).toHaveLength(3);

    rerender(<WeeklyReportSkeleton audience="head" mode="slides" />);
    expect(
      screen
        .getByTestId("weekly-skeleton-document-actions")
        .querySelectorAll('[data-slot="skeleton"]'),
    ).toHaveLength(2);

    rerender(<WeeklyReportSkeleton audience="viewer" mode="form" />);
    expect(
      screen
        .getByTestId("weekly-skeleton-document-actions")
        .querySelectorAll('[data-slot="skeleton"]'),
    ).toHaveLength(1);

    rerender(<WeeklyReportSkeleton audience="viewer" mode="slides" />);
    expect(
      screen
        .getByTestId("weekly-skeleton-document-actions")
        .querySelectorAll('[data-slot="skeleton"]'),
    ).toHaveLength(1);
  });

  it("reserves the viewer acknowledge row before the overview", () => {
    render(<WeeklyReportSkeleton audience="viewer" mode="form" />);

    const root = screen.getByTestId("weekly-report-skeleton");
    const acknowledge = screen.getByTestId("weekly-skeleton-acknowledge");
    const overview = screen.getByTestId("weekly-skeleton-overview");

    expect(acknowledge.nextElementSibling).toBe(overview);
    expect(root).toContainElement(acknowledge);
  });

  it("pins the overview to the loaded surface geometry contract", () => {
    render(<WeeklyReportSkeleton audience="viewer" mode="form" />);

    expect(screen.getByTestId("weekly-skeleton-overview")).toHaveClass(
      "card-surface",
      "mt-4",
    );
    expect(screen.getByTestId("weekly-skeleton-overview")).toHaveAttribute(
      "data-layout-key",
      "report-overview-band",
    );
    expect(
      screen.getByTestId("weekly-skeleton-body-continuation"),
    ).toHaveAttribute("data-layout-key", "report-body-continuation");
    expect(
      screen.getByTestId("weekly-skeleton-body-continuation"),
    ).toHaveAttribute("data-layout-stability", "position-width");
  });

  it("keeps one loading status when the slide skeleton is composed", () => {
    render(<WeeklyReportSkeleton mode="slides" />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("keeps the compact report-toolbar geometry", () => {
    render(<WeeklyReportSkeleton />);

    expect(screen.getByTestId("weekly-skeleton-context-toolbar")).toHaveClass(
      "px-2",
      "py-1.5",
      "gap-1.5",
    );
    expect(screen.getByTestId("weekly-report-skeleton")).toHaveAttribute(
      "data-layout-key",
      "report-page",
    );
    expect(screen.getByTestId("weekly-skeleton-header")).toHaveAttribute(
      "data-layout-key",
      "weekly-report-header",
    );
    expect(
      screen.getByTestId("weekly-skeleton-context-toolbar"),
    ).toHaveAttribute("data-layout-key", "report-context-toolbar");
  });

  it("reserves the responsive two-line header context height", () => {
    render(<WeeklyReportSkeleton />);

    expect(screen.getByTestId("weekly-skeleton-header-context")).toHaveClass(
      "h-10",
      "sm:h-5",
    );
  });

  it("matches the compact viewer authority row height", () => {
    render(<WeeklyReportSkeleton audience="viewer" />);

    expect(screen.getByTestId("weekly-skeleton-header-context")).toHaveClass(
      "h-6",
    );
    expect(
      screen.getByTestId("weekly-skeleton-header-context"),
    ).not.toHaveClass("h-10");
  });

  it("exposes the loading status contract", () => {
    render(<WeeklyReportSkeleton />);

    const root = screen.getByRole("status", {
      name: "Loading status report",
    });
    expect(root).toHaveAttribute("aria-busy", "true");
    expect(root).toHaveAttribute("data-testid", "weekly-report-skeleton");
  });
});
