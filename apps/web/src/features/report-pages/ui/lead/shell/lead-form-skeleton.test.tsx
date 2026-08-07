// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadFormSkeleton } from "./lead-form-skeleton";

describe("LeadFormSkeleton", () => {
  it("exposes the loading status region with busy state and label", () => {
    render(<LeadFormSkeleton />);

    const status = screen.getByRole("status", { name: "Loading report form" });
    expect(status).toHaveAttribute("aria-busy", "true");
  });

  it("keeps the loaded edit-form surface order", () => {
    render(<LeadFormSkeleton mode="edit" />);

    const root = screen.getByTestId("lead-form-skeleton");
    expect(
      Array.from(
        root.children,
        (child) => (child as HTMLElement).dataset.testid,
      ),
    ).toEqual([
      "lead-skeleton-header",
      "lead-skeleton-context-toolbar",
      "lead-skeleton-section-product-status",
      "lead-skeleton-section-project-activities",
      "lead-skeleton-section-current-week",
      "lead-skeleton-section-next-week",
      "lead-skeleton-section-risks-blockers",
      "lead-skeleton-section-decisions",
    ]);
    expect(
      screen.queryByTestId("lead-skeleton-section-priorities"),
    ).not.toBeInTheDocument();
  });

  it("uses the slide topology while the slides route loads", () => {
    render(<LeadFormSkeleton mode="slides" />);

    expect(screen.getByTestId("slide-skeleton-lead-carousel")).toBeVisible();
    expect(
      screen.queryByTestId("lead-skeleton-section-product-status"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("mirrors compact loaded toolbar clusters", () => {
    render(<LeadFormSkeleton />);

    expect(screen.getByTestId("lead-skeleton-context-toolbar")).toHaveClass(
      "px-2",
      "py-1.5",
      "gap-1.5",
    );
    expect(
      screen.getByTestId("lead-skeleton-period-cluster"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("lead-skeleton-view-cluster"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("lead-form-skeleton")).toHaveAttribute(
      "data-layout-key",
      "report-page",
    );
    expect(screen.getByTestId("lead-skeleton-header")).toHaveAttribute(
      "data-layout-key",
      "lead-report-header",
    );
    expect(screen.getByTestId("lead-skeleton-context-toolbar")).toHaveAttribute(
      "data-layout-key",
      "report-context-toolbar",
    );
  });
});
