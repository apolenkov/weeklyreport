// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LeadFormEditSections } from "../chrome/lead-form-edit-sections";
import { LeadFormSkeleton } from "./lead-form-skeleton";

vi.mock("../../../../report-sections", () => ({
  mapLeadReviewFeedback: () => [],
  ownedStagesForProject: () => [],
}));
vi.mock("../../../../review", () => ({ LeadReviewFeedback: () => null }));
vi.mock("../bridges/lead-form-edit-bridge-sections", () => ({
  LeadFormEditBridgeSections: () => null,
}));
vi.mock("../chrome/lead-form-decisions-section", () => ({
  LeadFormDecisionsSection: () => null,
}));

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
      "lead-skeleton-body",
    ]);
    expect(
      Array.from(
        screen.getByTestId("lead-skeleton-body").children,
        (child) => (child as HTMLElement).dataset.testid,
      ),
    ).toEqual([
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
    expect(screen.getByTestId("lead-skeleton-body")).toHaveAttribute(
      "data-layout-key",
      "lead-report-body",
    );
    expect(screen.getByTestId("lead-skeleton-body")).toHaveAttribute(
      "data-layout-stability",
      "position-width",
    );
  });

  it("reserves the loaded document-action wrap and submitted action width", () => {
    render(<LeadFormSkeleton />);

    const actions = screen
      .getByTestId("lead-skeleton-document-actions")
      .querySelectorAll('[data-slot="skeleton"]');
    expect(screen.getByTestId("lead-skeleton-document-actions")).toHaveClass(
      "max-[641px]:basis-full",
    );
    expect(actions).toHaveLength(3);
    expect(actions[2]).toHaveClass("w-36");
  });

  it("pairs the loaded edit body with the skeleton layout contract", () => {
    const { container } = render(
      <LeadFormEditSections
        viewModel={{} as never}
        actions={{} as never}
        draftSection={{} as never}
        serverSection={{} as never}
        groupExpanded={false}
        unifiedView={false}
        recordVisibility="mine"
        visibilityHydrated
        crossAuthorEntries={[]}
      />,
    );

    expect(container.firstElementChild).toHaveAttribute(
      "data-layout-key",
      "lead-report-body",
    );
    expect(container.firstElementChild).toHaveAttribute(
      "data-layout-stability",
      "position-width",
    );
  });
});
