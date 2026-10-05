// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
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
  periodStatus: "published",
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

  it("keeps the two toolbar toggles in one non-wrapping row when review is enabled", () => {
    render(
      <ReportContent
        {...baseProps}
        periodStatus="open"
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
