import type { PeriodStatus } from "@customreport/shared";
import { shortNameFromName } from "@customreport/shared";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { ExportPdfButton } from "../../../pdf-export";
import type {
  LeadOverviewRow,
  WeeklyPortfolioProduct,
  WeeklyProductReport,
} from "../../../report-sections";
import { PortfolioOverviewTable } from "../../../report-sections";
import type { ReviewMode, ReviewModel } from "../../../review";
import { ReviewAcknowledgeBar, ReviewVerdictBand } from "../../../review";
import { SCROLL_INTO_VIEW_DELAY_MS } from "../product/accordion-tokens";
import { ProductAccordion } from "../product/product-accordion";
import type { LeadGroup } from "./weekly-report-page-helpers";

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
  focusedLeadId,
  overviewNavigationEpochs,
  review,
}: {
  readonly scope: "product" | "lead";
  readonly products: WeeklyProductReport[];
  readonly leadGroups: LeadGroup[];
  readonly focusedProductId: string | undefined;
  readonly scrollTargetProductId: string | undefined;
  readonly focusedLeadId: string | undefined;
  readonly overviewNavigationEpochs: ReadonlyMap<string, number>;
  readonly review: ReviewModel["context"];
}) {
  const renderAccordion = (report: WeeklyProductReport, leadId?: string) => {
    const targetsInstance = leadId === undefined || focusedLeadId === leadId;
    const targetsProduct = focusedProductId === report.id && targetsInstance;
    return (
      <ProductAccordion
        key={report.id}
        report={report}
        instanceRootId={
          leadId === undefined
            ? undefined
            : `report-lead-${leadId}-product-${report.id}`
        }
        defaultOpen={targetsProduct}
        highlighted={targetsProduct}
        scrollIntoViewOnHighlight={
          scrollTargetProductId === report.id && targetsInstance
        }
        navigationEpoch={overviewNavigationEpochs.get(report.id) ?? 0}
        review={review}
      />
    );
  };

  if (scope === "lead") {
    return (
      <div className="space-y-6">
        {leadGroups.map((group) => (
          // Stable anchor so a by-lead overview card can scroll/focus this section.
          <LeadSection
            key={group.id}
            groupId={group.id}
            groupName={group.name}
            focused={focusedLeadId === group.id}
            navigationEpoch={overviewNavigationEpochs.get(group.id) ?? 0}
          >
            {group.products.map((report) => renderAccordion(report, group.id))}
          </LeadSection>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {products.map((report) => renderAccordion(report))}
    </div>
  );
}

// React-driven scroll/focus for a lead section targeted from the overview band —
// the section owns its own DOM; nothing pokes it from outside.
function LeadSection({
  groupId,
  groupName,
  focused,
  navigationEpoch,
  children,
}: {
  readonly groupId: string;
  readonly groupName: string;
  readonly focused: boolean;
  readonly navigationEpoch: number | undefined;
  readonly children: ReactNode;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const groupDisplayName = shortNameFromName(groupName);
  useEffect(() => {
    if (!focused) return;
    const handle = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (el instanceof HTMLElement) el.focus({ preventScroll: true });
    }, SCROLL_INTO_VIEW_DELAY_MS);
    return () => window.clearTimeout(handle);
  }, [focused, groupId, navigationEpoch]);

  return (
    <section
      ref={ref}
      id={`report-lead-${groupId}`}
      data-feedback-anchor={`report-lead-${groupId}`}
      tabIndex={-1}
      aria-label={groupDisplayName}
      className="space-y-3 scroll-mt-4 rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2"
    >
      <h2 className="font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-primary)]">
        {groupDisplayName}
      </h2>
      {children}
    </section>
  );
}

// Scope-adaptive overview: lead cards in by-lead scope, product cards otherwise.
export function ReportOverviewBand({
  scope,
  portfolio,
  leadOverviewRows,
  mountedProductIds,
  onNavigate,
}: {
  readonly scope: "product" | "lead";
  readonly portfolio: WeeklyPortfolioProduct[];
  readonly leadOverviewRows: LeadOverviewRow[];
  readonly mountedProductIds: ReadonlySet<string>;
  readonly onNavigate: (targetId: string) => void;
}) {
  if (scope === "lead") {
    return (
      <PortfolioOverviewTable
        scope="lead"
        leads={leadOverviewRows}
        onNavigate={onNavigate}
      />
    );
  }
  return (
    <PortfolioOverviewTable
      products={portfolio}
      mountedProductIds={mountedProductIds}
      onNavigate={onNavigate}
    />
  );
}

// Export is shown only when the server-provided capability allows it.
export function ToolbarExportControl({
  canExportPdf,
  reportId,
  periodStatus,
}: {
  canExportPdf: boolean;
  reportId: string;
  periodStatus: PeriodStatus;
}) {
  if (canExportPdf) {
    return <ExportPdfButton reportId={reportId} periodStatus={periodStatus} />;
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
  reportId,
  reviewModel,
  reviewMode,
}: {
  readonly reportId: string;
  readonly reviewModel: ReviewModel;
  readonly reviewMode: ReviewMode;
}) {
  if (reviewMode !== "review" || !reviewModel.context) return null;
  return (
    <ReviewVerdictBand
      key={reportId}
      sections={reviewModel.sections}
      onMutated={reviewModel.context.onMutated}
    />
  );
}
