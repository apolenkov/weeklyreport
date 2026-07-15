import type { PeriodStatus } from "@customreport/shared";

import { ExportPdfButton, PdfExportComingSoonControl } from "../../pdf-export";
import type { ReviewMode } from "../../review";
import { ReviewAcknowledgeBar, ReviewVerdictBand } from "../../review";
import type { LeadOverviewRow } from "../model/weekly-report";
import type {
  WeeklyPortfolioProduct,
  WeeklyProductReport,
} from "../model/weekly-report-types";
import { PortfolioOverviewTable } from "./portfolio-overview-table";
import { ProductAccordion } from "./product-accordion";
import type { LeadGroup, ReviewModel } from "./weekly-report-page-helpers";

/**
 * Centered title + body card used for the page's terminal states (invalid-link,
 * no active period). Extracted so the two states share one layout and the page
 * function stays under the cognitive-complexity budget.
 */
export function CenteredNotice({
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

/**
 * Accordion body for the report page: a flat per-product list (default) or
 * products bucketed under each authoring lead ("by lead" head split-view).
 * Extracted so the page function stays under the cognitive-complexity budget.
 */
export function ReportAccordionBody({
  scope,
  products,
  leadGroups,
  focusedProductId,
  scrollTargetProductId,
  review,
}: {
  readonly scope: "product" | "lead";
  readonly products: WeeklyProductReport[];
  readonly leadGroups: LeadGroup[];
  readonly focusedProductId: string | undefined;
  readonly scrollTargetProductId: string | undefined;
  readonly review: ReviewModel["context"];
}) {
  const renderAccordion = (report: WeeklyProductReport) => (
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
export function ReportOverviewBand({
  scope,
  portfolio,
  leadOverviewRows,
}: {
  readonly scope: "product" | "lead";
  readonly portfolio: WeeklyPortfolioProduct[];
  readonly leadOverviewRows: LeadOverviewRow[];
}) {
  if (scope === "lead") {
    return <PortfolioOverviewTable scope="lead" leads={leadOverviewRows} />;
  }
  return <PortfolioOverviewTable products={portfolio} />;
}

/**
 * The single labeled Export-PDF control for the toolbar trailing group.
 * head/admin/viewer get the real button; lead gets the inert ComingSoon control
 * (lead is FORBIDDEN from pdfExport). A helper so the branching stays out of
 * WeeklyReportPage's body.
 */
export function ToolbarExportControl({
  canExportPdf,
  showComingSoon,
  reportId,
  periodStatus,
}: {
  canExportPdf: boolean;
  showComingSoon: boolean;
  reportId: string;
  periodStatus: PeriodStatus;
}) {
  if (canExportPdf) {
    return <ExportPdfButton reportId={reportId} periodStatus={periodStatus} />;
  }
  if (showComingSoon) {
    return <PdfExportComingSoonControl />;
  }
  return null;
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
export function AcknowledgeSurface({
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
export function ReviewModeVerdictSurface({
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
