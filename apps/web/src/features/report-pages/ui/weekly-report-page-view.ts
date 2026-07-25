import type { PeriodStatus, WeeklyReportReadModel } from "@customreport/shared";

import { joinPeriodLabel } from "../../../lib/format-date";
import { isHeadLike, isLead } from "../../../lib/role-predicates";
import {
  type LeadOverviewRow,
  mapWeeklyReport,
  mapWeeklyReportLeadGroups,
  mapWeeklyReportLeadOverview,
  reportHasContent,
  type ReportPeriod,
  type WeeklyPortfolioProduct,
} from "../../report-sections";
import {
  type AccordionModel,
  buildAccordionModel,
  buildReviewModel,
  type CurrentRole,
  isReviewEnabled,
  type LeadGroup,
  type ReviewModel,
} from "./weekly-report-page-helpers";

export interface WeeklyReportPageView {
  readonly currentRole: CurrentRole;
  readonly canMutatePeriod: boolean;
  readonly canExportPdf: boolean;
  readonly showLeadExportComingSoon: boolean;
  readonly periodId: string;
  readonly reportId: string;
  readonly periodStatus: PeriodStatus;
  readonly periodLabel: string;
  readonly periods: ReportPeriod[];
  readonly submitted: number;
  readonly total: number;
  readonly pendingCount: number;
  readonly portfolio: WeeklyPortfolioProduct[];
  readonly leadOverviewRows: LeadOverviewRow[];
  readonly reviewModel: ReviewModel;
  readonly accordion: AccordionModel;
  readonly reviewEnabled: boolean;
  readonly canReviewAny: boolean;
  readonly submittedOnly: boolean;
  readonly activitySections: WeeklyReportReadModel["leadSections"];
  readonly focusedProductId: string | undefined;
  readonly scrollTargetProductId: string | undefined;
  readonly hasAnyContent: boolean;
  readonly canPublishReport: boolean;
  readonly showPublishHint: boolean;
}

type MappedWeeklyReport = ReturnType<typeof mapWeeklyReport>;

interface ReviewSurfaceParams {
  readonly scope: "product" | "lead";
  readonly currentRole: CurrentRole;
  readonly currentUserId: string | null;
  readonly submissionFilter: "submitted" | "all";
  readonly onReviewMutated: () => void;
}

// Reviewer surface + accordion. The submission filter is effective only when
// review is enabled; the accordion may narrow to submitted-only while
// header/portfolio/period nav stay on full truth.
function deriveReviewSurface(
  reportData: WeeklyReportReadModel,
  view: MappedWeeklyReport,
  params: ReviewSurfaceParams,
) {
  const { scope, currentRole } = params;
  // Reviewer surface only for access-holders on a live (non-published) period.
  const reviewModel = buildReviewModel(reportData, {
    currentRole,
    periodStatus: view.period.periodStatus,
    currentUserId: params.currentUserId,
    onMutated: params.onReviewMutated,
  });
  // By-lead groups only in "lead" scope; overview rows always from FULL groups
  // so the band shows every section while the filter narrows the accordion.
  const fullLeadGroups: LeadGroup[] =
    scope === "lead" ? mapWeeklyReportLeadGroups(reportData) : [];
  const reviewEnabled = isReviewEnabled(currentRole, view.period.periodStatus);
  const submittedOnly =
    reviewEnabled && params.submissionFilter === "submitted";

  return {
    reviewModel,
    leadOverviewRows: mapWeeklyReportLeadOverview(fullLeadGroups),
    reviewEnabled,
    submittedOnly,
    // Read|Review offered only when the caller can act on ≥1 section (server-stamped).
    canReviewAny: reviewModel.sections.some((section) => section.canReview),
    accordion: buildAccordionModel({
      reportData,
      scope,
      submittedOnly,
      fullProducts: view.products,
      fullLeadGroups,
    }),
  };
}

// The focused author's first product WITH content — the same content filter the
// scroll target uses, so an empty product never steals focus.
function resolveFocusedProductId(
  products: MappedWeeklyReport["products"],
  focusedAuthorId: string | null,
): string | undefined {
  if (!focusedAuthorId) return undefined;
  return products.find(
    (report) =>
      report.authorIds.includes(focusedAuthorId) && reportHasContent(report),
  )?.id;
}

// Standalone fallback nav (no shell toolbar): single inert active period.
// Shell-composed head toolbar supplies the multi-period combobox via slot.
function buildFallbackPeriodNav(
  period: MappedWeeklyReport["period"],
): ReportPeriod[] {
  return [
    {
      id: period.id,
      sourceSectionId: "",
      weekLabel: period.weekLabel,
      dateRange: period.dateRange,
      isCurrent: period.isCurrent,
      isSubmitted: true,
    },
  ];
}

// Pure view-model from a loaded active report (scope, review gating, filter, focus).
/**
 * Build Weekly Report Page View.
 * @param reportData - The reportData argument.
 * @param params - The params argument.
 */
export function buildWeeklyReportPageView(
  reportData: WeeklyReportReadModel,
  params: {
    readonly scope: "product" | "lead";
    readonly currentRole: CurrentRole;
    readonly currentUserId: string | null;
    readonly focusedAuthorId: string | null;
    readonly submissionFilter: "submitted" | "all";
    readonly onReviewMutated: () => void;
  },
): WeeklyReportPageView {
  const { currentRole, focusedAuthorId } = params;
  const view = mapWeeklyReport(reportData);
  const {
    reviewModel,
    leadOverviewRows,
    reviewEnabled,
    canReviewAny,
    submittedOnly,
    accordion,
  } = deriveReviewSurface(reportData, view, params);

  const submitted = view.submissionCount;
  const total = view.totalLeads;
  const pendingCount = Math.max(0, total - submitted);
  const { portfolio, products } = view;

  const focusedProductId = resolveFocusedProductId(products, focusedAuthorId);
  // Empty-state + publish gate use FULL content, never the filtered accordion.
  const hasAnyContent = accordion.hasAnyContent;
  const canPublishReport = submitted > 0 && hasAnyContent;
  const canMutatePeriod = isHeadLike(currentRole);
  // Publish hint for head-like roles while unpublished and not yet publishable.
  const showPublishHint =
    canMutatePeriod &&
    !canPublishReport &&
    view.period.periodStatus !== "published";
  const periods = buildFallbackPeriodNav(view.period);
  const periodLabel = joinPeriodLabel(
    view.period.weekLabel,
    view.period.dateRange,
  );

  return {
    currentRole,
    canMutatePeriod,
    // head/admin/viewer get real export; lead is FORBIDDEN (pdfExport on
    // leadershipProcedure) and sees ComingSoon — never a button that would 403.
    canExportPdf: currentRole !== null && !isLead(currentRole),
    showLeadExportComingSoon: isLead(currentRole),
    periodId: view.period.id,
    reportId: view.period.reportId,
    periodStatus: view.period.periodStatus,
    periodLabel,
    periods,
    submitted,
    total,
    pendingCount,
    portfolio,
    leadOverviewRows,
    reviewModel,
    accordion,
    reviewEnabled,
    canReviewAny,
    submittedOnly,
    activitySections: reportData.leadSections,
    focusedProductId,
    // Same content filter as focusedProductId (reportHasContent).
    scrollTargetProductId: focusedProductId,
    hasAnyContent,
    canPublishReport,
    showPublishHint,
  };
}
