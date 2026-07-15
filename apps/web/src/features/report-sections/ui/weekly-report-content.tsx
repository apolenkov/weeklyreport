import type {
  PeriodStatus,
  ReportSectionReadModel,
} from "@customreport/shared";
import Link from "next/link";

import type { ReviewMode, SubmissionFilter } from "../../review";
import {
  DraftHiddenSignal,
  ReviewModeToggle,
  SubmissionFilterToggle,
} from "../../review";
import type { LeadOverviewRow } from "../model/weekly-report";
import type { WeeklyPortfolioProduct } from "../model/weekly-report-types";
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
  /**
   * Lead sections feeding the Project Activities band. Narrowed by the same
   * §7 submitted-only filter as the accordion — a draft section's activity
   * status/note is unreviewed content and must not leak to head/viewer.
   */
  readonly activitySections: readonly ReportSectionReadModel[];
  readonly portfolio: WeeklyPortfolioProduct[];
  readonly leadOverviewRows: LeadOverviewRow[];
  readonly reviewModel: ReviewModel;
  readonly reportId: string;
  readonly accordion: AccordionModel;
  readonly reviewEnabled: boolean;
  /** The caller can review ≥1 section — gates the Read|Review mode toggle. */
  readonly canReviewAny: boolean;
  readonly reviewMode: ReviewMode;
  readonly onReviewModeChange: (next: ReviewMode) => void;
  readonly submittedOnly: boolean;
  readonly submissionFilter: SubmissionFilter;
  readonly onFilterChange: (next: SubmissionFilter) => void;
  readonly focusedProductId: string | undefined;
  readonly scrollTargetProductId: string | undefined;
}

/**
 * The report body below the toolbar: the true empty-state when the period has no
 * section content at all (head-report-visibility — keyed off FULL content, never
 * the submitted count), otherwise the review surfaces + the §7-filtered
 * accordion. A helper so WeeklyReportPage stays under the complexity budget.
 */
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
      {/* Acknowledge band for NON-publishing access-holders only (viewer);
          head/admin acknowledge from the Publish & Lock cluster on the header
          line. */}
      {!reviewModel.isHeadOrAdmin && (
        <AcknowledgeSurface
          reviewModel={reviewModel}
          reportId={reportId}
          placement="body"
        />
      )}

      {/* Report overview — scope-adaptive (report-overview-scope-parity). It
          reads the FULL truth, so it never narrows with the §7 filter. */}
      <ReportOverviewBand
        scope={scope}
        portfolio={portfolio}
        leadOverviewRows={leadOverviewRows}
      />

      {/* Project Activities beside the product surfaces — display-only, never
          part of portfolio totals or escalations. Self-suppresses when no
          section carries an activity. Narrows with the §7 filter like the
          accordion body. */}
      <ActivityStatusStrip
        sections={
          submittedOnly
            ? activitySections.filter(isSubmittedSection)
            : activitySections
        }
      />

      {/* review-acknowledgement (§7): the per-user Submitted|All accordion
          filter, shown only to an access-holder on a live period. The Read|
          Review mode toggle leads the group for a caller who can review. */}
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

      {/* Per-section verdict band beneath the mode toggle that reveals it —
          mounted only in review mode, present in both by-product and by-lead
          scope. */}
      <ReviewModeVerdictSurface
        reviewModel={reviewModel}
        reviewMode={reviewMode}
      />

      {/* §7 anti-empty-state: submitted-only is hiding draft content — reveal it
          rather than let the accordion read as empty. */}
      {submittedOnly && accordion.draftCount > 0 ? (
        <DraftHiddenSignal
          count={accordion.draftCount}
          onShowAll={() => onFilterChange("all")}
        />
      ) : null}

      {/* Accordion sections — by product (default) or grouped by lead. The
          reviewer overlay (per-record comments + composer) threads through only
          in review mode; normal mode renders read-only report content. */}
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
