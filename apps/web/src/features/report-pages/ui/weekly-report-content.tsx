import type {
  PeriodStatus,
  ReportSectionReadModel,
} from "@customreport/shared";
import Link from "next/link";

import type {
  LeadOverviewRow,
  WeeklyPortfolioProduct,
} from "../../report-sections";
import type { ReviewMode, SubmissionFilter } from "../../review";
import {
  DraftHiddenSignal,
  ReviewModeToggle,
  SubmissionFilterToggle,
} from "../../review";
import { ActivityStatusStrip } from "./activity-status-strip";
import {
  AcknowledgeSurface,
  ReportAccordionBody,
  ReportOverviewBand,
  ReviewModeVerdictSurface,
} from "./weekly-report-page-content";
import type { AccordionModel, ReviewModel } from "./weekly-report-page-helpers";
import { isSubmittedSection } from "./weekly-report-page-helpers";

export interface ReportContentProps {
  readonly hasAnyContent: boolean;
  readonly periodStatus: PeriodStatus;
  readonly periodLabel: string;
  readonly scope: "product" | "lead";
  // Lead sections for Project Activities; same submitted-only filter as the
  // accordion so unreviewed draft activity never leaks to head/viewer.
  readonly activitySections: readonly ReportSectionReadModel[];
  readonly portfolio: WeeklyPortfolioProduct[];
  readonly leadOverviewRows: LeadOverviewRow[];
  readonly reviewModel: ReviewModel;
  readonly reportId: string;
  readonly accordion: AccordionModel;
  readonly reviewEnabled: boolean;
  // Gates the Read|Review mode toggle (caller can review ≥1 section).
  readonly canReviewAny: boolean;
  readonly reviewMode: ReviewMode;
  readonly onReviewModeChange: (next: ReviewMode) => void;
  readonly submittedOnly: boolean;
  readonly submissionFilter: SubmissionFilter;
  readonly onFilterChange: (next: SubmissionFilter) => void;
  readonly focusedProductId: string | undefined;
  readonly scrollTargetProductId: string | undefined;
}

// Empty-state keys off FULL content (head-report-visibility), never the
// submitted count; otherwise review surfaces + submitted-only-filtered accordion.
export function ReportContent({
  hasAnyContent,
  periodStatus,
  periodLabel,
  scope,
  activitySections,
  portfolio,
  leadOverviewRows,
  reviewModel,
  reportId,
  accordion,
  reviewEnabled,
  canReviewAny,
  reviewMode,
  onReviewModeChange,
  submittedOnly,
  submissionFilter,
  onFilterChange,
  focusedProductId,
  scrollTargetProductId,
}: ReportContentProps) {
  if (!hasAnyContent && periodStatus !== "published") {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] py-16 text-center"
        data-testid="empty-submissions-state"
      >
        <p className="text-base font-semibold text-[var(--color-foreground)]">
          No submissions yet for {periodLabel}
        </p>
        <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">
          Leads have not filed their sections for this period.
        </p>
        <Link
          href="/reports?tab=published"
          className="mt-4 text-sm font-medium text-[var(--color-primary)] underline-offset-4 hover:underline"
        >
          View archived reports in Archive &rarr;
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Viewer acknowledge band; head/admin use the header Publish cluster. */}
      {!reviewModel.isHeadOrAdmin && (
        <AcknowledgeSurface
          reviewModel={reviewModel}
          reportId={reportId}
          placement="body"
        />
      )}

      {/* Overview always reads FULL truth — never the submitted-only filter. */}
      <ReportOverviewBand
        scope={scope}
        portfolio={portfolio}
        leadOverviewRows={leadOverviewRows}
      />

      {/* Display-only; same submitted-only filter as the accordion body. */}
      <ActivityStatusStrip
        sections={
          submittedOnly
            ? activitySections.filter(isSubmittedSection)
            : activitySections
        }
      />

      {/* Submitted|All filter for access-holders on a live period. */}
      {reviewEnabled ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-muted-foreground)]">
            Sections
          </span>
          <div className="flex items-center gap-2">
            {canReviewAny ? (
              <ReviewModeToggle
                value={reviewMode}
                onChange={onReviewModeChange}
              />
            ) : null}
            <SubmissionFilterToggle
              value={submissionFilter}
              onChange={onFilterChange}
            />
          </div>
        </div>
      ) : null}

      <ReviewModeVerdictSurface
        reviewModel={reviewModel}
        reviewMode={reviewMode}
      />

      {/* Anti-empty-state when submitted-only is hiding draft content. */}
      {submittedOnly && accordion.draftCount > 0 ? (
        <DraftHiddenSignal
          count={accordion.draftCount}
          onShowAll={() => onFilterChange("all")}
        />
      ) : null}

      <ReportAccordionBody
        scope={scope}
        products={accordion.products}
        leadGroups={accordion.leadGroups}
        focusedProductId={focusedProductId}
        scrollTargetProductId={scrollTargetProductId}
        review={reviewMode === "review" ? reviewModel.context : undefined}
      />
    </>
  );
}
