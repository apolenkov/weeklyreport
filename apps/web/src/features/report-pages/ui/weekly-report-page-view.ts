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

/**
 * Pure derivation of the report view-model from a loaded, active report. Split
 * out of the controller hook so the hook itself stays under the complexity
 * budget — this is where the branching (scope, review gating, §7 filtering,
 * focus targeting) lives.
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
  const { scope, currentRole, focusedAuthorId } = params;
  const view = mapWeeklyReport(reportData);
  // review-acknowledgement (§6): the reviewer surface renders only for an
  // access-holder (head/admin/viewer, never a lead) on a live (non-published)
  // period. `buildReviewModel` returns an empty model otherwise.
  const reviewModel = buildReviewModel(reportData, {
    currentRole,
    periodStatus: view.period.periodStatus,
    currentUserId: params.currentUserId,
    onMutated: params.onReviewMutated,
  });
  const submitted = view.submissionCount;
  const total = view.totalLeads;
  // pendingCount mirrors mock semantics: total - submitted, clamped >= 0.
  const pendingCount = Math.max(0, total - submitted);

  const { portfolio, products } = view;
  // Head split-view "by lead" grouping (report-card-clarity): slice each product
  // to the lead's OWN contribution — mapWeeklyReportLeadGroups builds per-lead
  // cards from each single section, drops empty leads, and is computed only in
  // "lead" scope (the default product path stays cheap).
  const rawLeadGroups =
    scope === "lead" ? mapWeeklyReportLeadGroups(reportData) : [];
  const fullLeadGroups: LeadGroup[] = rawLeadGroups;
  // report-overview-scope-parity: per-lead overview rows derived from the SAME
  // FULL groups (truth) — the overview band always shows every section, even
  // while the §7 filter narrows the accordion body below.
  const leadOverviewRows = mapWeeklyReportLeadOverview(rawLeadGroups);

  // review-acknowledgement (§7): the toggle is effective only when review is
  // enabled (head/admin/viewer on a live period). `buildAccordionModel` narrows
  // the accordion products/leadGroups to submitted-only when active, leaving the
  // header count, portfolio band, and period nav on the full truth above.
  const reviewEnabled = isReviewEnabled(currentRole, view.period.periodStatus);
  // The Read|Review toggle is offered only to a caller who can act on ≥1
  // section (a designated reviewer / head / admin); `canReview` is server-
  // stamped per section.
  const canReviewAny = reviewModel.sections.some(
    (section) => section.canReview,
  );
  const submittedOnly =
    reviewEnabled && params.submissionFilter === "submitted";
  const accordion = buildAccordionModel({
    reportData,
    scope,
    submittedOnly,
    fullProducts: products,
    fullLeadGroups,
  });

  const focusedProductId = focusedAuthorId
    ? products.find(
        (report) =>
          report.authorIds.includes(focusedAuthorId) &&
          reportHasContent(report),
      )?.id
    : undefined;
  // Empty-state + publish gate key off the FULL content (head sees live draft
  // content when showing all), never the filtered accordion.
  const hasAnyContent = accordion.hasAnyContent;
  const canPublishReport = submitted > 0 && hasAnyContent;
  const canMutatePeriod = isHeadLike(currentRole);
  // head-toolbar-semantics: the publish precondition hint sits on the status
  // row, shown only to publish-capable roles while the period is unpublished
  // and has no submitted content to publish yet.
  const showPublishHint =
    canMutatePeriod &&
    !canPublishReport &&
    view.period.periodStatus !== "published";
  // report-routing: the scroll target and the highlighted accordion panel
  // must always agree — both apply the SAME content filter (reportHasContent),
  // so a deep-link to an author whose first authored product is empty still
  // scrolls to the content-bearing one that actually highlights.
  const scrollTargetProductId = focusedProductId;
  // The standalone fallback navigator (when no shell-composed `toolbar` slot
  // arrives — e.g. the viewer /reports/[reportId] route) surfaces the active
  // period only; a single inert option. The shell-composed head toolbar
  // supplies the full multi-period combobox via the `toolbar` slot.
  const periods: ReportPeriod[] = [
    {
      id: view.period.id,
      sourceSectionId: "",
      weekLabel: view.period.weekLabel,
      dateRange: view.period.dateRange,
      isCurrent: view.period.isCurrent,
      isSubmitted: true,
    },
  ];
  const periodLabel = joinPeriodLabel(
    view.period.weekLabel,
    view.period.dateRange,
  );

  return {
    currentRole,
    canMutatePeriod,
    // Export-PDF authz (fix-report-surface-integrity): head/admin/viewer get
    // the real export; lead is FORBIDDEN at the backend (pdfExport on
    // leadershipProcedure) and sees the inert ComingSoon control instead —
    // never an active button that would 403. The viewer's export is
    // requester-scoped (their own published slice).
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
    scrollTargetProductId,
    hasAnyContent,
    canPublishReport,
    showPublishHint,
  };
}
