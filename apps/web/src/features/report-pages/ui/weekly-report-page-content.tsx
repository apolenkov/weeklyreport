import type { PeriodStatus } from "@customreport/shared";

import { ExportPdfButton, PdfExportComingSoonControl } from "../../pdf-export";
import type {
  LeadOverviewRow,
  WeeklyPortfolioProduct,
  WeeklyProductReport,
} from "../../report-sections";
import type { ReviewMode } from "../../review";
import { ReviewAcknowledgeBar, ReviewVerdictBand } from "../../review";
import { PortfolioOverviewTable } from "./portfolio-overview-table";
import { ProductAccordion } from "./product-accordion";
import type { LeadGroup, ReviewModel } from "./weekly-report-page-helpers";

// Shared layout for terminal page states (invalid-link, no active period).
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

// Flat per-product list, or products bucketed under each authoring lead.
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
          // Stable anchor so a by-lead overview card can scroll/focus this section.
          <section
            key={group.id}
            id={`report-lead-${group.id}`}
            tabIndex={-1}
            aria-label={group.name}
            className="space-y-3 scroll-mt-4 focus:outline-none"
          >
            <h2 className="font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-primary)]">
              {group.name}
            </h2>
            {group.products.map(renderAccordion)}
          </section>
        ))}
      </div>
    );
  }

  return <div className="space-y-3">{products.map(renderAccordion)}</div>;
}

// Scope-adaptive overview: lead cards in by-lead scope, product cards otherwise.
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

// head/admin/viewer get the real export; lead is FORBIDDEN and gets ComingSoon.
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

// Head/admin: header Publish cluster so review → acknowledge → publish is one
// sequence. Viewer: body band — they have no publish cluster to host it.
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

// Self-gating verdict band: only in review mode so normal mode stays read-only.
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
