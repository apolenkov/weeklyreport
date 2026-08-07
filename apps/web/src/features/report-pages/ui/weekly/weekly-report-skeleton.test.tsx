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
      "weekly-skeleton-project-activities",
      "weekly-skeleton-sections-toolbar",
      "weekly-skeleton-accordions",
    ]);
  });

  it("uses the slide deck topology for a slides route", () => {
    render(<WeeklyReportSkeleton mode="slides" />);

    expect(screen.getByTestId("slide-skeleton-head-carousel")).toBeVisible();
    expect(screen.getByTestId("slide-skeleton-article")).toBeVisible();
    expect(
      screen.queryByTestId("weekly-skeleton-overview"),
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

  it("exposes the loading status contract", () => {
    render(<WeeklyReportSkeleton />);

    const root = screen.getByRole("status", {
      name: "Loading status report",
    });
    expect(root).toHaveAttribute("aria-busy", "true");
    expect(root).toHaveAttribute("data-testid", "weekly-report-skeleton");
  });
});
