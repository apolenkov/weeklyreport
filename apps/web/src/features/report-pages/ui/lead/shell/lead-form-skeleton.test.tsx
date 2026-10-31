// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  REPORT_TOOLBAR_FRAME_STICKY_CLASS,
  REPORT_TOOLBAR_ROW_CLASS,
} from "../../../../../shared/ui/report-shell/report-toolbar-layout";
import { LeadFormEditSections } from "../chrome/lead-form-edit-sections";
import {
  LEAD_HEADER_ACTIONS_BELOW_TITLE_CLASS,
  LEAD_HEADER_ROW_CLASS,
  LEAD_HEADER_TITLE_CLASS,
} from "../chrome/lead-form-header-layout";
import {
  LEAD_TOOLBAR_CONTROLS_SLOT_CLASS,
  LEAD_TOOLBAR_PERIOD_CLUSTER_CLASS,
  LEAD_TOOLBAR_PERIOD_SLOT_CLASS,
  LEAD_TOOLBAR_ROW_CLASS,
} from "../chrome/lead-form-toolbar-layout";
import { LeadFormSkeleton } from "./lead-form-skeleton";

vi.mock("../../../../report-sections", () => ({
  STAGE_CHIP_BOX_HEIGHT: "36px",
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
    expect(screen.getByTestId("lead-skeleton-density-control")).toHaveClass(
      "border",
      "p-1",
    );
  });

  it("carries the loaded overview report-page landmark while loading", () => {
    render(<LeadFormSkeleton mode="overview" />);

    const status = screen.getByRole("status", {
      name: "Loading status overview",
    });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveAttribute("data-layout-key", "report-page");
    expect(status).toHaveAttribute("data-layout-stability", "position-width");

    const root = screen.getByTestId("lead-form-skeleton");
    expect(root).toContainElement(
      screen.getByTestId("lead-skeleton-context-toolbar"),
    );
    const placeholders = Array.from(root.children).filter(
      (child) => (child as HTMLElement).dataset.slot === "skeleton",
    );
    expect(placeholders).toHaveLength(3);
  });

  it("mirrors compact loaded toolbar clusters", () => {
    render(<LeadFormSkeleton />);

    expect(screen.queryByTestId("lead-skeleton-density-control")).toBeNull();

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

  it("reserves the edit document-action wrap and submitted action width", () => {
    render(<LeadFormSkeleton />);

    const actions = screen
      .getByTestId("lead-skeleton-document-actions")
      .querySelectorAll('[data-slot="skeleton"]');
    expect(screen.getByTestId("lead-skeleton-document-actions")).toHaveClass(
      ...LEAD_HEADER_ACTIONS_BELOW_TITLE_CLASS.split(" "),
    );
    expect(actions).toHaveLength(3);
    expect(actions[2]).toHaveClass("w-36");
  });

  it("wraps the slides document-action placeholders below the title like the loaded header", () => {
    render(<LeadFormSkeleton mode="slides" />);

    const actions = screen.getByTestId("lead-skeleton-document-actions");
    expect(actions).toHaveClass(
      ...LEAD_HEADER_ACTIONS_BELOW_TITLE_CLASS.split(" "),
    );
    expect(actions.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
  });

  it("shares the loaded header row and title classes", () => {
    render(<LeadFormSkeleton />);

    const header = screen.getByTestId("lead-skeleton-header");
    expect(header).toHaveClass(...LEAD_HEADER_ROW_CLASS.split(" "));
    expect(header.firstElementChild).toHaveClass(
      ...LEAD_HEADER_TITLE_CLASS.split(" "),
    );
  });

  it("shares the loaded toolbar frame, row and cluster classes", () => {
    render(<LeadFormSkeleton />);

    const toolbar = screen.getByTestId("lead-skeleton-context-toolbar");
    expect(toolbar).toHaveClass(
      ...REPORT_TOOLBAR_FRAME_STICKY_CLASS.split(" "),
      ...REPORT_TOOLBAR_ROW_CLASS.split(" "),
    );
    expect(toolbar.firstElementChild).toHaveClass(
      ...LEAD_TOOLBAR_ROW_CLASS.split(" "),
    );
    expect(
      screen.getByTestId("lead-skeleton-period-cluster").parentElement,
    ).toHaveClass(...LEAD_TOOLBAR_PERIOD_SLOT_CLASS.split(" "));
    expect(screen.getByTestId("lead-skeleton-period-cluster")).toHaveClass(
      ...LEAD_TOOLBAR_PERIOD_CLUSTER_CLASS.split(" "),
    );
    expect(
      screen.getByTestId("lead-skeleton-view-cluster").parentElement,
    ).toHaveClass(...LEAD_TOOLBAR_CONTROLS_SLOT_CLASS.split(" "));
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
