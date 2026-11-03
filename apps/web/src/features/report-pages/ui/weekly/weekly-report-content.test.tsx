// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ReviewModel } from "../../../review";
import {
  ReportContent,
  type ReportContentProps,
} from "./weekly-report-content";

// Head-shaped empty review model: mounts no reviewer affordances.
const HEAD_REVIEW_MODEL: ReviewModel = {
  context: undefined,
  groups: [],
  sections: [],
  isHeadOrAdmin: true,
};

const baseProps: ReportContentProps = {
  hasAnyContent: true,
  submissionCount: 3,
  periodLabel: "Jun 8–14, 2026",
  scope: "product",
  activitySections: [],
  portfolio: [],
  leadOverviewRows: [],
  reviewModel: HEAD_REVIEW_MODEL,
  reportId: "report-1",
  accordion: {
    products: [],
    leadGroups: [],
    hasAnyContent: true,
    draftCount: 0,
  },
  reviewEnabled: false,
  canReviewAny: false,
  reviewMode: "read",
  onReviewModeChange: () => undefined,
  submittedOnly: false,
  submissionFilter: "all",
  onFilterChange: () => undefined,
  focusedProductId: undefined,
  scrollTargetProductId: undefined,
  focusedLeadId: undefined,
  overviewNavigationEpochs: new Map(),
  onNavigateOverview: () => undefined,
};

describe("ReportContent — Sections heading", () => {
  it("does not steal focus from outside the disappearing report body", () => {
    const { rerender } = render(
      <>
        <button type="button">Elsewhere</button>
        <ReportContent {...baseProps} reviewEnabled />
      </>,
    );
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    act(() => elsewhere.focus());
    rerender(
      <>
        <button type="button">Elsewhere</button>
        <ReportContent {...baseProps} hasAnyContent={false} />
      </>,
    );
    expect(elsewhere).toHaveFocus();
  });
  it("recovers only lost section focus when the final author region disappears", () => {
    const { rerender } = render(
      <ReportContent
        {...baseProps}
        reviewEnabled
        accordion={{
          ...baseProps.accordion,
          leadGroups: [{ id: "ada", name: "Ada", products: [] }],
        }}
      />,
    );
    const sections = screen.getByRole("region", { name: "Report sections" });
    const button = screen.getByRole("button", { name: "All" });
    act(() => button.focus());
    rerender(<ReportContent {...baseProps} hasAnyContent={false} />);
    expect(sections).toHaveFocus();
  });
  it("keeps the Sections caption on a published report (no review toolbar)", () => {
    render(<ReportContent {...baseProps} />);

    expect(screen.getByText("Sections")).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Section filter" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Report mode" }),
    ).not.toBeInTheDocument();
  });

  it("keeps live region mounted before switching filter and populates text when switching to submittedOnly", () => {
    const { rerender } = render(
      <ReportContent
        {...baseProps}
        reviewEnabled
        submittedOnly={false}
        submissionFilter="all"
        accordion={{
          products: [],
          leadGroups: [],
          hasAnyContent: true,
          draftCount: 2,
        }}
      />,
    );

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion).toHaveTextContent("");

    rerender(
      <ReportContent
        {...baseProps}
        reviewEnabled
        submittedOnly={true}
        submissionFilter="submitted"
        accordion={{
          products: [],
          leadGroups: [],
          hasAnyContent: true,
          draftCount: 2,
        }}
      />,
    );

    expect(screen.getByRole("status")).toBe(liveRegion);
    expect(liveRegion).toHaveTextContent(
      "2 sections in draft, hidden by the Submitted filter.",
    );
  });

  it("keeps the two toolbar toggles in one non-wrapping row when review is enabled", () => {
    render(
      <ReportContent
        {...baseProps}
        reviewEnabled
        canReviewAny
        reviewModel={{
          ...HEAD_REVIEW_MODEL,
          context: {
            currentUserId: "head-1",
            isAdmin: false,
            onMutated: vi.fn(),
          },
        }}
      />,
    );

    const sectionFilter = screen.getByRole("group", { name: "Section filter" });
    const controlsRow = sectionFilter.parentElement;
    expect(controlsRow).toHaveClass("flex-nowrap");
    expect(controlsRow).toHaveClass("overflow-x-auto");
    expect(controlsRow).not.toHaveClass("flex-wrap");
  });
});

describe("ReportContent — no-content empty state (C5019)", () => {
  // Read-model shape of a report whose sections have no content.
  const NO_CONTENT_PROPS: ReportContentProps = {
    ...baseProps,
    hasAnyContent: false,
    submissionCount: 3,
    accordion: {
      products: [],
      leadGroups: [],
      hasAnyContent: false,
      draftCount: 0,
    },
  };

  it("shows the no-content empty state when no section has content", () => {
    render(<ReportContent {...NO_CONTENT_PROPS} />);

    expect(screen.getByTestId("empty-report-state")).toBeInTheDocument();
    expect(
      screen.getByText("No report content for Jun 8–14, 2026"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Portfolio Overview")).not.toBeInTheDocument();
  });

  it("announces unavailable targeted Review even when the report is empty", () => {
    render(
      <ReportContent
        {...NO_CONTENT_PROPS}
        reviewUnavailableNotice="Review is unavailable for this section."
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Review is unavailable for this section.",
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("keeps the Portfolio Overview when sections have content", () => {
    render(<ReportContent {...baseProps} />);

    expect(screen.queryByTestId("empty-report-state")).not.toBeInTheDocument();
  });
});
