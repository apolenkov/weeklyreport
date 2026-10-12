import type {
  PeriodStatus,
  ReportSectionReadModel,
} from "@weeklyreport/shared";

import type {
  LeadOverviewRow,
  WeeklyPortfolioProduct,
} from "../../../report-sections";
import { ActivityStatusStrip } from "../../../report-sections";
import type {
  ReviewMode,
  ReviewModel,
  SubmissionFilter,
} from "../../../review";
import {
  DraftHiddenSignal,
  ReviewModeToggle,
  SubmissionFilterToggle,
} from "../../../review";
import { ReportEmptyState } from "./weekly-report-empty-state";
import {
  AcknowledgeSurface,
  ReportAccordionBody,
  ReportOverviewBand,
  ReviewModeVerdictSurface,
} from "./weekly-report-page-content";
import type { AccordionModel } from "./weekly-report-page-helpers";
import { isSubmittedSection } from "./weekly-report-page-helpers";

export interface ReportContentProps {
  readonly hasAnyContent: boolean;
  readonly submissionCount: number;
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
  readonly focusedLeadId: string | undefined;
  readonly overviewNavigationEpochs: ReadonlyMap<string, number>;
  readonly onNavigateOverview: (targetId: string) => void;
}

type ReportTopSurfacesProps = Pick<
  ReportContentProps,
  | "reviewModel"
  | "reportId"
  | "scope"
  | "portfolio"
  | "leadOverviewRows"
  | "accordion"
  | "onNavigateOverview"
>;

function ReportTopSurfaces({
  reviewModel,
  reportId,
  scope,
  portfolio,
  leadOverviewRows,
  accordion,
  onNavigateOverview,
}: ReportTopSurfacesProps) {
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
        mountedProductIds={new Set(accordion.products.map(({ id }) => id))}
        onNavigate={onNavigateOverview}
      />
    </>
  );
}

type SectionsToolbarProps = Pick<
  ReportContentProps,
  | "canReviewAny"
  | "reviewMode"
  | "onReviewModeChange"
  | "submissionFilter"
  | "onFilterChange"
>;

// The "Sections" caption names the accordion on every surface (published
// included); the mode/filter controls are live-review-only and stay in one
// scrollable row so they never read as detached capsules on narrow viewports.
function SectionsToolbar({
  reviewEnabled,
  canReviewAny,
  reviewMode,
  onReviewModeChange,
  submissionFilter,
  onFilterChange,
}: SectionsToolbarProps & { readonly reviewEnabled: boolean }) {
  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-[var(--color-primary)]">
        Sections
      </h2>
      {reviewEnabled ? (
        <div className="flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto">
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
      ) : null}
    </div>
  );
}

type SectionsSurfaceKeys =
  | "reportId"
  | "reviewEnabled"
  | "reviewModel"
  | "submittedOnly"
  | "accordion"
  | "scope"
  | "focusedProductId"
  | "scrollTargetProductId"
  | "focusedLeadId"
  | "overviewNavigationEpochs";

function ReportSectionsSurface({
  reportId,
  reviewEnabled,
  reviewModel,
  submittedOnly,
  accordion,
  scope,
  focusedProductId,
  scrollTargetProductId,
  focusedLeadId,
  overviewNavigationEpochs,
  ...toolbar
}: SectionsToolbarProps & Pick<ReportContentProps, SectionsSurfaceKeys>) {
  return (
    <>
      <SectionsToolbar {...toolbar} reviewEnabled={reviewEnabled} />

      <ReviewModeVerdictSurface
        reportId={reportId}
        reviewModel={reviewModel}
        reviewMode={toolbar.reviewMode}
      />

      {/* Anti-empty-state when submitted-only is hiding draft content. */}
      {submittedOnly && accordion.draftCount > 0 ? (
        <DraftHiddenSignal
          count={accordion.draftCount}
          onShowAll={() => toolbar.onFilterChange("all")}
        />
      ) : null}

      <ReportAccordionBody
        scope={scope}
        products={accordion.products}
        leadGroups={accordion.leadGroups}
        focusedProductId={focusedProductId}
        scrollTargetProductId={scrollTargetProductId}
        focusedLeadId={focusedLeadId}
        overviewNavigationEpochs={overviewNavigationEpochs}
        review={
          toolbar.reviewMode === "review" ? reviewModel.context : undefined
        }
      />
    </>
  );
}

// Empty-state keys off FULL content (head-report-visibility), never the
// submitted count; otherwise review surfaces + submitted-only-filtered accordion.
export function ReportContent(props: ReportContentProps) {
  if (!props.hasAnyContent && props.periodStatus !== "published") {
    return (
      <ReportEmptyState
        periodLabel={props.periodLabel}
        submissionCount={props.submissionCount}
      />
    );
  }

  return (
    <>
      <ReportTopSurfaces
        reviewModel={props.reviewModel}
        reportId={props.reportId}
        scope={props.scope}
        portfolio={props.portfolio}
        leadOverviewRows={props.leadOverviewRows}
        accordion={props.accordion}
        onNavigateOverview={props.onNavigateOverview}
      />

      <div
        data-layout-key="report-body-continuation"
        data-layout-stability="position-width"
        data-feedback-anchor="weekly-report-sections"
        className="space-y-4"
      >
        {/* Display-only; same submitted-only filter as the accordion body. */}
        <ActivityStatusStrip
          sections={
            props.submittedOnly
              ? props.activitySections.filter(isSubmittedSection)
              : props.activitySections
          }
        />

        <ReportSectionsSurface
          reportId={props.reportId}
          reviewEnabled={props.reviewEnabled}
          reviewModel={props.reviewModel}
          submittedOnly={props.submittedOnly}
          accordion={props.accordion}
          scope={props.scope}
          focusedProductId={props.focusedProductId}
          scrollTargetProductId={props.scrollTargetProductId}
          focusedLeadId={props.focusedLeadId}
          overviewNavigationEpochs={props.overviewNavigationEpochs}
          canReviewAny={props.canReviewAny}
          reviewMode={props.reviewMode}
          onReviewModeChange={props.onReviewModeChange}
          submissionFilter={props.submissionFilter}
          onFilterChange={props.onFilterChange}
        />
      </div>
    </>
  );
}
