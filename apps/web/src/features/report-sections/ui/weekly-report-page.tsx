"use client";

import type {
  ReportSectionReadModel,
  WeeklyReportReadModel,
} from "@customreport/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
  invalidateReview,
} from "../../../lib/cache-keys";
import { getClientErrorDetails } from "../../../lib/client-error-reporting";
import { joinPeriodLabel } from "../../../lib/format-date";
import { isAdmin, isHeadLike, isLead } from "../../../lib/role-predicates";
import { SessionContext } from "../../../lib/session-provider";
import { useTRPC } from "../../../lib/trpc-context";
import { useQueryErrorHandler } from "../../../lib/use-query-error-handler";
import type {
  PortfolioProduct,
  ProductReport,
} from "../../../shared/lib/dashboard-mock-data";
import {
  DocumentActionGroup,
  ReportToolbar,
} from "../../../shared/ui/report-shell/report-toolbar";
import { ExportPdfButton } from "../../pdf-export/ui/export-pdf-button";
import { PdfExportComingSoonControl } from "../../pdf-export/ui/pdf-export-coming-soon";
import { PeriodNavigator } from "../../period/ui/period-navigator";
import { PublishLockButton } from "../../period/ui/publish-lock-button";
import {
  type SectionReviewRow,
  toSectionReviewRows,
} from "../../review/model/section-review-rows";
import { ReviewAcknowledgeBar } from "../../review/ui/review-acknowledge-bar";
import {
  type ReviewMode,
  ReviewModeToggle,
} from "../../review/ui/review-mode-toggle";
import { ReviewVerdictBand } from "../../review/ui/review-verdict-band";
import {
  DraftHiddenSignal,
  type SubmissionFilter,
  SubmissionFilterToggle,
} from "../../review/ui/submission-filter";
import { formatDateRange, isoWeekNumber } from "../model/lead-history";
import type { ReportPeriod } from "../model/mock-data";
import { reportHasContent } from "../model/report-content";
import {
  type LeadOverviewRow,
  mapWeeklyReport,
  mapWeeklyReportLeadGroups,
  mapWeeklyReportLeadOverview,
} from "../model/weekly-report";
import { ActivityStatusStrip } from "./activity-status-strip";
import { PortfolioOverviewTable } from "./portfolio-overview-table";
import {
  type AccordionReviewContext,
  ProductAccordion,
} from "./product-accordion";
import { WeeklyReportSkeleton } from "./weekly-report-skeleton";

interface WeeklyReportPageProps {
  /**
   * Concrete report identifier (UUID). When provided, the query targets that
   * specific report; used by /reports/[reportId] route pages.
   */
  readonly reportId?: string;
  /**
   * When true, the page auto-redirects (router.replace) to the canonical
   * addressed URL `/head/report/<reportId>` once the active reportId is known.
   * Off when already on a `[reportId]` route.
   *
   * Optional `canonicalBasePath` (defaults to `/head/report`) lets callers
   * point the redirect at a different addressed surface.
   */
  readonly redirectToCanonical?: boolean;
  readonly canonicalBasePath?: string;
  readonly authorId?: string;
  /**
   * Grouping axis (head split-view parity). "product" (default)
   * is the classic per-product accordion list; "lead" groups products under
   * each authoring lead. A product shared by several leads appears under each —
   * leads own their own phases, so the duplication is expected.
   */
  readonly scope?: "product" | "lead";
  /**
   * report-toolbar-layout: the page owns the single two-row ReportToolbar. An
   * outer shell (HeadReportShell) supplies leading Document-action-row controls
   * here — head passes its labeled Export-PDF — rendered before the page's own
   * Move-to-archive / Publish lifecycle actions. When omitted the page renders
   * the shared Export control itself (head/admin/viewer get the real export;
   * lead sees the inert ComingSoon).
   */
  readonly documentActionsLeading?: ReactNode;
  /**
   * report-toolbar-layout: the FULL Context-control row (bottom row), composed
   * by an outer shell that owns a richer period navigator (HeadReportShell
   * prepends the active/displayed periods compiledHistory omits). When provided
   * it replaces the page's default context row, including period navigation.
   * Mutually exclusive with `contextControlsLeading`.
   */
  readonly contextControls?: ReactNode;
  /**
   * report-toolbar-layout: Context-control-row controls prepended before the
   * page's default period navigator. Used by standalone consumers (the viewer)
   * that reuse the page's own period nav but add the Agent-review placeholder
   * (leading edge) and Back-to-Archive navigation to the bottom row.
   */
  readonly contextControlsLeading?: ReactNode;
  /**
   * head-toolbar-parity: a context label (department name plus a short page
   * descriptor) rendered on the header line beside the title. It is a label,
   * not a control, so it stays out of the two action rows. Head form mode
   * passes it; standalone consumers omit it.
   */
  readonly headerContextLabel?: ReactNode;
}

/**
 * Centered title + body card used for the page's terminal states (invalid-link,
 * no active period). Extracted so the two states share one layout and the page
 * function stays under the cognitive-complexity budget.
 */
function CenteredNotice({
  title,
  body,
}: {
  readonly title: string;
  readonly body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-lg font-semibold text-[var(--color-foreground)]">
        {title}
      </p>
      <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        {body}
      </p>
    </div>
  );
}

interface TerminalNotice {
  readonly title: string;
  readonly body: string;
}

/**
 * Accordion body for the report page: a flat per-product list (default) or
 * products bucketed under each authoring lead ("by lead" head split-view).
 * Extracted so the page function stays under the cognitive-complexity budget.
 */
function ReportAccordionBody({
  scope,
  products,
  leadGroups,
  focusedProductId,
  scrollTargetProductId,
  review,
}: {
  readonly scope: "product" | "lead";
  readonly products: ProductReport[];
  readonly leadGroups: {
    id: string;
    name: string;
    products: ProductReport[];
  }[];
  readonly focusedProductId: string | undefined;
  readonly scrollTargetProductId: string | undefined;
  readonly review: AccordionReviewContext | undefined;
}) {
  const renderAccordion = (report: ProductReport) => (
    <ProductAccordion
      key={report.id}
      report={report}
      defaultOpen={focusedProductId === report.id}
      highlighted={focusedProductId === report.id}
      scrollIntoViewOnHighlight={scrollTargetProductId === report.id}
      review={review}
    />
  );

  if (scope === "lead") {
    return (
      <div className="space-y-6">
        {leadGroups.map((group) => (
          // report-overview-scope-parity: stable anchor + focus target so a
          // by-lead overview card can scroll/focus this section (the by-lead
          // analogue of report-product-<id>).
          <section
            key={group.id}
            id={`report-lead-${group.id}`}
            tabIndex={-1}
            aria-label={group.name}
            className="space-y-3 scroll-mt-4 focus:outline-none"
          >
            <h3 className="font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-primary)]">
              {group.name}
            </h3>
            {group.products.map(renderAccordion)}
          </section>
        ))}
      </div>
    );
  }

  return <div className="space-y-3">{products.map(renderAccordion)}</div>;
}

/**
 * report-overview-scope-parity: the scope-adaptive Report overview band.
 * Extracted so the page function stays under the cognitive-complexity budget.
 * In by-lead scope it renders lead cards from `leadOverviewRows`; otherwise the
 * product cards from `portfolio`.
 */
function ReportOverviewBand({
  scope,
  portfolio,
  leadOverviewRows,
}: {
  readonly scope: "product" | "lead";
  readonly portfolio: PortfolioProduct[];
  readonly leadOverviewRows: LeadOverviewRow[];
}) {
  if (scope === "lead") {
    return <PortfolioOverviewTable scope="lead" leads={leadOverviewRows} />;
  }
  return <PortfolioOverviewTable products={portfolio} />;
}

/**
 * Resolves the page's terminal display state (after loading settles).
 *  - invalid-link: a malformed reportId (400 BAD_REQUEST) or a missing report
 *    (404 NOT_FOUND). Transient 5xx / network errors fall through to no-period.
 *  - no active period: no data, or a `no-period` status.
 * Returns null when the report should render normally.
 */
function resolveTerminalNotice(query: {
  readonly isError: boolean;
  readonly error: unknown;
  readonly data: { readonly status: string } | undefined;
}): TerminalNotice | null {
  if (query.isError && getClientErrorDetails(query.error).isInvalidLink) {
    return {
      title: "Report not found",
      body: "This link is invalid or the report no longer exists.",
    };
  }
  if (!query.data || query.data.status === "no-period") {
    return {
      title: "No active reporting period",
      body: "Ask an admin to open a new period to start collecting status reports.",
    };
  }
  return null;
}

/**
 * The single labeled Export-PDF control for the toolbar trailing group.
 * head/admin/viewer get the real button; lead gets the inert ComingSoon control
 * (lead is FORBIDDEN from pdfExport). A helper so the branching stays out of
 * WeeklyReportPage's body.
 */
function ToolbarExportControl({
  canExportPdf,
  showComingSoon,
  reportId,
  periodStatus,
}: {
  canExportPdf: boolean;
  showComingSoon: boolean;
  reportId: string;
  periodStatus: "open" | "published" | "reopened";
}) {
  if (canExportPdf) {
    return <ExportPdfButton reportId={reportId} periodStatus={periodStatus} />;
  }
  if (showComingSoon) {
    return <PdfExportComingSoonControl />;
  }
  return null;
}

type CurrentRole = "lead" | "head" | "viewer" | "admin" | null;
type LivePeriodStatus = "open" | "published" | "reopened";

interface ReviewModel {
  readonly context: AccordionReviewContext | undefined;
  readonly groups: { readonly groupId: string }[];
  readonly sections: SectionReviewRow[];
  readonly isHeadOrAdmin: boolean;
}

const EMPTY_REVIEW_MODEL: ReviewModel = {
  context: undefined,
  groups: [],
  sections: [],
  isHeadOrAdmin: false,
};

/**
 * The reviewer surface is live-only and never for a lead: any access-holder
 * (head/admin/viewer) on an `open`/`reopened` period, never on a published
 * snapshot.
 */
function isReviewEnabled(
  role: CurrentRole,
  periodStatus: LivePeriodStatus,
): boolean {
  if (role === null || isLead(role)) return false;
  return periodStatus !== "published";
}

/** Distinct non-null author groups in the report (the Acknowledge group set). */
function distinctReviewGroups(
  sections: WeeklyReportReadModel["leadSections"],
): { groupId: string }[] {
  const ids = sections
    .map((section) => section.groupId)
    .filter((groupId): groupId is string => Boolean(groupId));
  return [...new Set(ids)].map((groupId) => ({ groupId }));
}

/**
 * review-acknowledgement (§6): derive the in-app reviewer surface from the live
 * read model. Returns an empty model when review is disabled — a lead, an
 * anonymous caller, or a published period — so the page renders zero review
 * affordances there. `canReview` is server-stamped; this only shapes the
 * affordances, never the security boundary.
 */
function buildReviewModel(
  reportData: WeeklyReportReadModel,
  params: {
    readonly currentRole: CurrentRole;
    readonly periodStatus: "open" | "published" | "reopened";
    readonly currentUserId: string | null;
    readonly onMutated: () => void;
  },
): ReviewModel {
  if (
    !isReviewEnabled(params.currentRole, params.periodStatus) ||
    !params.currentUserId
  ) {
    return EMPTY_REVIEW_MODEL;
  }
  const context: AccordionReviewContext = {
    currentUserId: params.currentUserId,
    isAdmin: isAdmin(params.currentRole),
    onMutated: params.onMutated,
  };
  return {
    context,
    groups: distinctReviewGroups(reportData.leadSections),
    sections: toSectionReviewRows(reportData.leadSections),
    isHeadOrAdmin: isHeadLike(params.currentRole),
  };
}

interface LeadGroup {
  id: string;
  name: string;
  products: ProductReport[];
}

interface AccordionModel {
  readonly products: ProductReport[];
  readonly leadGroups: LeadGroup[];
  /** Any section (submitted OR draft) carries content — the "truly empty period" gate. */
  readonly hasAnyContent: boolean;
  /** Draft sections that DO carry content (empty drafts hide nothing → excluded). */
  readonly draftCount: number;
}

/**
 * activity-first-class: a section carries activity content when a lead has
 * TOUCHED an attached activity — deliberately raised its alarm (yellow/red),
 * authored a note, or parented ≥1 record to it. A GREEN status does NOT count:
 * `seedActivityStatuses` defaults every attached activity to green on section
 * create (never null), so a non-null status is not evidence of lead input.
 * Mirrors reportHasContent's strictness (a green product status is not content):
 * a merely-provisioned activity must not defeat the "truly empty period"
 * empty-state. Without the fold an all-activity period (real activity content,
 * zero product content) would read "No submissions yet" and could not publish.
 */
function sectionHasActivityContent(
  // `activities` is optional here (unlike the strict read model) so a legacy /
  // pre-activity fixture section that omits it is treated as no-activity, not a
  // crash — the same tolerance ActivityStatusStrip applies.
  section: Pick<ReportSectionReadModel, "items" | "risks" | "decisions"> & {
    readonly activities?: ReportSectionReadModel["activities"];
  },
): boolean {
  const activities = section.activities ?? [];
  if (activities.length === 0) return false;
  const ownsRecord = (activityId: string): boolean =>
    section.items.some((i) => i.activityId === activityId) ||
    section.risks.some((r) => r.activityId === activityId) ||
    section.decisions.some((d) => d.activityId === activityId);
  return activities.some((a) => {
    const alarm = a.derivedStatus ?? a.status;
    if (alarm === "yellow" || alarm === "red") return true;
    if (a.note != null && a.note.trim() !== "") return true;
    return ownsRecord(a.activityId);
  });
}

/**
 * review-acknowledgement (§7): THE submitted-only predicate. Every render
 * surface that narrows with the filter (accordion body, Project Activities
 * strip) must share it so no draft content leaks through one of them.
 */
const isSubmittedSection = (section: {
  readonly status: "draft" | "submitted";
}): boolean => section.status === "submitted";

/**
 * review-acknowledgement (§7): shape the accordion BODY for the submitted/all
 * filter. `fullProducts` / `fullLeadGroups` are the truth source (header counts,
 * portfolio band, and period nav read them). When submitted-only is active we
 * re-map the submitted-only sections into a filtered view and count the draft
 * sections that still carry content, so an all-draft period surfaces a "N in
 * draft — Show all" signal instead of a misleading empty accordion. Filtering
 * happens at the render layer only — never the server query, read gate, or group
 * scope.
 */
function buildAccordionModel(params: {
  readonly reportData: WeeklyReportReadModel;
  readonly scope: "product" | "lead";
  readonly submittedOnly: boolean;
  readonly fullProducts: ProductReport[];
  readonly fullLeadGroups: LeadGroup[];
}): AccordionModel {
  const { reportData, scope, submittedOnly, fullProducts, fullLeadGroups } =
    params;
  // Full-truth "truly empty period" gate: product content on any section, OR a
  // touched activity on any section (activity-first-class — an all-activity
  // period is real content and must render + be publishable, not read empty).
  const hasAnyContent =
    fullProducts.some(reportHasContent) ||
    reportData.leadSections.some(sectionHasActivityContent);
  if (!submittedOnly) {
    return {
      products: fullProducts,
      leadGroups: fullLeadGroups,
      hasAnyContent,
      draftCount: 0,
    };
  }
  const submittedData: WeeklyReportReadModel = {
    ...reportData,
    leadSections: reportData.leadSections.filter(isSubmittedSection),
  };
  const draftData: WeeklyReportReadModel = {
    ...reportData,
    leadSections: reportData.leadSections.filter(
      (section) => !isSubmittedSection(section),
    ),
  };
  const products =
    mapWeeklyReport(submittedData).products.filter(reportHasContent);
  const leadGroups =
    scope === "lead"
      ? (mapWeeklyReportLeadGroups(submittedData) as LeadGroup[])
      : [];
  // mapWeeklyReportLeadGroups drops authors whose products carry no content, so
  // its length is exactly the count of draft sections that would show something.
  const draftCount = mapWeeklyReportLeadGroups(draftData).length;
  return {
    products,
    leadGroups,
    hasAnyContent,
    draftCount,
  };
}

/**
 * Self-gating Acknowledge control (renders nothing when review is disabled).
 * Mounted in TWO places by role: for a publish-capable reviewer (head/admin)
 * inside the header's Publish & Lock action cluster, so
 * review → acknowledge → publish reads as one sequence; for a
 * non-publishing access-holder (viewer) it stays a band in the report body —
 * relocating it into a cluster the viewer does not have would orphan their
 * acknowledge path.
 */
function AcknowledgeSurface({
  reviewModel,
  reportId,
  placement,
}: {
  readonly reviewModel: ReviewModel;
  readonly reportId: string;
  readonly placement: "header" | "body";
}) {
  if (!reviewModel.context || reviewModel.groups.length === 0) return null;
  return (
    <div data-testid={`acknowledge-${placement}`}>
      <ReviewAcknowledgeBar
        reportId={reportId}
        groups={reviewModel.groups}
        currentUserId={reviewModel.context.currentUserId}
        isHeadOrAdmin={reviewModel.isHeadOrAdmin}
      />
    </div>
  );
}

/**
 * Self-gating in-report verdict band. Renders only in review mode, so normal
 * mode stays read-only. The head roll-up strip lives on the dashboard now; this
 * keeps a designated viewer-reviewer's verdict home in the report body.
 */
function ReviewModeVerdictSurface({
  reviewModel,
  reviewMode,
}: {
  readonly reviewModel: ReviewModel;
  readonly reviewMode: ReviewMode;
}) {
  if (reviewMode !== "review" || !reviewModel.context) return null;
  return (
    <ReviewVerdictBand
      sections={reviewModel.sections}
      onMutated={reviewModel.context.onMutated}
    />
  );
}

interface ReportContentProps {
  readonly hasAnyContent: boolean;
  readonly periodStatus: LivePeriodStatus;
  readonly periodLabel: string;
  readonly scope: "product" | "lead";
  /**
   * Lead sections feeding the Project Activities band. Narrowed by the same
   * §7 submitted-only filter as the accordion — a draft section's activity
   * status/note is unreviewed content and must not leak to head/viewer.
   */
  readonly activitySections: readonly ReportSectionReadModel[];
  readonly portfolio: PortfolioProduct[];
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
function ReportContent({
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

export function WeeklyReportPage({
  reportId,
  redirectToCanonical,
  canonicalBasePath = "/head/report",
  authorId,
  scope = "product",
  documentActionsLeading,
  contextControls,
  contextControlsLeading,
  headerContextLabel,
}: WeeklyReportPageProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const focusedAuthorId = authorId ?? null;
  const sessionState = useContext(SessionContext);
  const currentRole = sessionState?.user?.role ?? null;
  const canMutatePeriod = isHeadLike(currentRole);
  // Export-PDF authz (fix-report-surface-integrity): head/admin/viewer get the
  // real export; lead is FORBIDDEN at the backend (pdfExport on leadershipProcedure)
  // and sees the inert ComingSoon control instead — never an active button that
  // would 403. The viewer's export is requester-scoped (their own published slice).
  const canExportPdf = currentRole !== null && !isLead(currentRole);
  const showLeadExportComingSoon = isLead(currentRole);

  // review-acknowledgement (§7): per-user, client-only accordion filter. Default
  // submitted-only; rendered (and effective) only when review is enabled — a
  // head/admin/viewer on a live open|reopened period, never a lead or a
  // published snapshot.
  const [submissionFilter, setSubmissionFilter] =
    useState<SubmissionFilter>("submitted");

  // Read|Review body mode. Default "read" so any access-holder lands on the
  // assembled report; a designated reviewer opts into the per-record comment
  // composer and per-section verdict controls via the toggle.
  const [reviewMode, setReviewMode] = useState<ReviewMode>("read");

  // weeklyReport.get input: { reportId?: string } | undefined.
  // When reportId is given, scope to that report; otherwise fall back to the
  // session's active period (server-side default).
  const queryInput = reportId ? { reportId } : {};
  const weeklyQ = useQuery(trpc.weeklyReport.get.queryOptions(queryInput));

  // Wire period.publish + period.reopen to the head's Publish & Lock / Reopen
  // button. On success, cascade cache invalidation across dashboard, lead form,
  // and lead history surfaces so all consumers refetch fresh state without a
  // manual refresh.
  const publishMut = useMutation(
    trpc.period.publish.mutationOptions({
      onSuccess: () => {
        invalidateDashboard(qc, trpc);
        invalidateLeadHistory(qc, trpc);
        toast.success("Period published & locked");
      },
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to publish period",
        );
      },
    }),
  );

  const reopenMut = useMutation(
    trpc.period.reopen.mutationOptions({
      onSuccess: () => {
        invalidateDashboard(qc, trpc);
        invalidateLeadForm(qc, trpc);
        invalidateLeadHistory(qc, trpc);
        toast.success("Period reopened");
      },
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to reopen period",
        );
      },
    }),
  );

  // Archive mutation — head moves a published report into the archive so it
  // appears in archive.list. Only visible when periodStatus==='published'.
  const archiveMut = useMutation(
    trpc.archive.archiveReport.mutationOptions({
      onSuccess: () => {
        invalidateDashboard(qc, trpc);
        toast.success("Report archived");
      },
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to archive report",
        );
      },
    }),
  );

  useQueryErrorHandler(weeklyQ, {
    event: "weeklyReport.get.load_failed",
    component: "WeeklyReportPage",
    procedure: "weeklyReport.get",
    context: { reportId: reportId ?? null, authorId: focusedAuthorId },
    toastPrefix: "Failed to load status report",
  });

  // Bare `/head/report` -> redirect to `/head/report/<reportId>` once the
  // active reportId is known. Skipped when:
  //   • the page already renders under `[reportId]` (reportId prop set)
  //   • there is no resolvable report (weeklyQ data not loaded or no-period)
  const resolvedReportId =
    weeklyQ.data?.status === "active" ? weeklyQ.data.reportId : null;
  useEffect(() => {
    if (!redirectToCanonical) return;
    if (reportId) return;
    if (!resolvedReportId) return;
    const authorQuery = focusedAuthorId
      ? `?authorId=${encodeURIComponent(focusedAuthorId)}`
      : "";
    router.replace(`${canonicalBasePath}/${resolvedReportId}${authorQuery}`);
  }, [
    redirectToCanonical,
    reportId,
    resolvedReportId,
    focusedAuthorId,
    router,
    canonicalBasePath,
  ]);

  // Surface the period in the browser tab title.
  const titleParts = useMemo(() => {
    if (!weeklyQ.data || weeklyQ.data.status === "no-period") return null;
    const start = weeklyQ.data.periodStart;
    const end = weeklyQ.data.periodEnd;
    if (!(start instanceof Date) || !(end instanceof Date)) return null;
    return { week: isoWeekNumber(start), range: formatDateRange(start, end) };
  }, [weeklyQ.data]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!titleParts) return;
    const previous = document.title;
    document.title = `Week ${titleParts.week}, ${titleParts.range} - CustomReport`;
    return () => {
      document.title = previous;
    };
  }, [titleParts]);

  if (weeklyQ.isLoading) {
    return <WeeklyReportSkeleton />;
  }

  // Terminal states (invalid-link + no-period). Resolved by a pure helper so
  // the page function stays under the complexity budget.
  const terminalNotice = resolveTerminalNotice(weeklyQ);
  if (terminalNotice) {
    return (
      <CenteredNotice title={terminalNotice.title} body={terminalNotice.body} />
    );
  }

  // After the terminal-notice guard the report is loaded and active; this
  // narrows weeklyQ.data off the `no-period` / undefined variants for TS.
  const reportData = weeklyQ.data;
  if (!reportData || reportData.status === "no-period") {
    return null;
  }

  const view = mapWeeklyReport(reportData);
  // review-acknowledgement (§6): the reviewer surface renders only for an
  // access-holder (head/admin/viewer, never a lead) on a live (non-published)
  // period. `buildReviewModel` returns an empty model otherwise.
  const reviewModel = buildReviewModel(reportData, {
    currentRole,
    periodStatus: view.period.periodStatus,
    currentUserId: sessionState?.user?.id ?? null,
    onMutated: () => invalidateReview(qc, trpc),
  });
  const submitted = view.submissionCount;
  const total = view.totalLeads;
  // pendingCount mirrors mock semantics: total - submitted, clamped >= 0.
  const pendingCount = Math.max(0, total - submitted);

  // The mapper produces structurally compatible shapes; cast to the existing
  // mock-data presentation types so children keep their imports unchanged.
  const portfolio: PortfolioProduct[] = view.portfolio;
  const products: ProductReport[] = view.products;
  // Head split-view "by lead" grouping (report-card-clarity): slice each product
  // to the lead's OWN contribution — mapWeeklyReportLeadGroups builds per-lead
  // cards from each single section, drops empty leads, and is computed only in
  // "lead" scope (the default product path stays cheap).
  const rawLeadGroups =
    scope === "lead" ? mapWeeklyReportLeadGroups(reportData) : [];
  const fullLeadGroups = rawLeadGroups as LeadGroup[];
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
  const submittedOnly = reviewEnabled && submissionFilter === "submitted";
  const accordion = buildAccordionModel({
    reportData,
    scope,
    submittedOnly,
    fullProducts: products,
    fullLeadGroups,
  });

  const authoredProductIds = focusedAuthorId
    ? products
        .filter((report) => report.authorIds?.includes(focusedAuthorId))
        .map((report) => report.id)
    : [];
  const focusedProductId = focusedAuthorId
    ? products.find(
        (report) =>
          report.authorIds?.includes(focusedAuthorId) &&
          reportHasContent(report),
      )?.id
    : undefined;
  // Empty-state + publish gate key off the FULL content (head sees live draft
  // content when showing all), never the filtered accordion.
  const hasAnyContent = accordion.hasAnyContent;
  const canPublishReport = submitted > 0 && hasAnyContent;
  // head-toolbar-semantics: the publish precondition hint sits on the status
  // row, shown only to publish-capable roles while the period is unpublished
  // and has no submitted content to publish yet.
  const showPublishHint =
    canMutatePeriod &&
    !canPublishReport &&
    view.period.periodStatus !== "published";
  const archiveLabel = archiveMut.isPending ? "Archiving…" : "Archive";
  const scrollTargetProductId =
    authoredProductIds.length > 0 ? authoredProductIds[0] : undefined;
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

  return (
    <div className="space-y-4">
      {/* Page header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
            Status Report
          </h1>
          <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
            Live &middot; {submitted}/{total} Submitted
          </span>
          {/* head-toolbar-semantics: the publish precondition hint sits on the
              report-status row (not the action row). */}
          {showPublishHint && (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Publish requires at least one submitted section.
            </span>
          )}
          {/* head-toolbar-parity: department context label — a label, not a
              control, so it stays on the header line, out of the action rows. */}
          {headerContextLabel}
        </div>
        {/* report-toolbar-layout: document actions live on the header line's
            right slot, not inside the bordered toolbar. The labeled Export-PDF
            (or a shell-supplied leading action) leads, then the head lifecycle
            actions (Move-to-archive, Publish & Lock). Viewer and the lead
            preview have no mutating actions, so only the export control renders. */}
        <DocumentActionGroup>
          {documentActionsLeading ?? (
            <ToolbarExportControl
              canExportPdf={canExportPdf}
              showComingSoon={showLeadExportComingSoon}
              reportId={view.period.reportId}
              periodStatus={view.period.periodStatus}
            />
          )}
          {/* Move-to-archive — a published-period lifecycle action, so it is a
              document action (neutral/outline), distinct from the show-archived
              filter in the context bar. Hidden after archiving because this page
              only navigates active periods. */}
          {canMutatePeriod && view.period.periodStatus === "published" && (
            <button
              type="button"
              className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() =>
                archiveMut.mutate({ reportId: view.period.reportId })
              }
              disabled={archiveMut.isPending}
              aria-label="Move this report to the archive"
            >
              {archiveLabel}
            </button>
          )}
          {/* The head/admin Acknowledge control sits WITH Publish & Lock so
              review → acknowledge → publish reads as one sequence. It never
              gates publish; AcknowledgeSurface self-suppresses when review is
              disabled (e.g. a published period). */}
          {canMutatePeriod && (
            <AcknowledgeSurface
              reviewModel={reviewModel}
              reportId={view.period.reportId}
              placement="header"
            />
          )}
          {canMutatePeriod && (
            <PublishLockButton
              pendingCount={pendingCount}
              totalLeads={total}
              periodStatus={view.period.periodStatus}
              onPublish={() =>
                publishMut.mutate({ reportId: view.period.reportId })
              }
              onReopen={() =>
                reopenMut.mutate({ reportId: view.period.reportId })
              }
              isPending={publishMut.isPending || reopenMut.isPending}
              canPublish={canPublishReport}
              publishDisabledReason="Publish requires at least one submitted section."
            />
          )}
        </DocumentActionGroup>
      </header>

      {/* report-toolbar-layout: the bordered toolbar holds only the
          Context-control bar — either a shell-composed row (head) or the page's
          default period navigator, optionally preceded by leading controls
          (the viewer's Agent review). */}
      <ReportToolbar
        contextControls={
          contextControls ?? (
            <>
              {contextControlsLeading}
              <PeriodNavigator
                periods={periods}
                urlBuilder={(periodId) =>
                  `/head/report/${encodeURIComponent(periodId)}`
                }
              />
            </>
          )
        }
      />

      {/* Report body: true empty-state OR the review surfaces + §7-filtered
          accordion. A helper so this page function stays under the complexity
          budget; the empty-state gate keys off FULL content (head-report-
          visibility), never the submitted count or the filtered accordion. */}
      <ReportContent
        hasAnyContent={hasAnyContent}
        periodStatus={view.period.periodStatus}
        periodLabel={periodLabel}
        scope={scope}
        activitySections={reportData.leadSections}
        portfolio={portfolio}
        leadOverviewRows={leadOverviewRows}
        reviewModel={reviewModel}
        reportId={view.period.reportId}
        accordion={accordion}
        reviewEnabled={reviewEnabled}
        canReviewAny={canReviewAny}
        reviewMode={reviewMode}
        onReviewModeChange={setReviewMode}
        submittedOnly={submittedOnly}
        submissionFilter={submissionFilter}
        onFilterChange={setSubmissionFilter}
        focusedProductId={focusedProductId}
        scrollTargetProductId={scrollTargetProductId}
      />
    </div>
  );
}
