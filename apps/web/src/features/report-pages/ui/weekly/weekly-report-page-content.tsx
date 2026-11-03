import type {
  PeriodStatus,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import { shortNameFromName } from "@weeklyreport/shared";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { ExportPdfButton } from "../../../pdf-export";
import type {
  LeadOverviewRow,
  WeeklyPortfolioProduct,
  WeeklyProductReport,
} from "../../../report-sections";
import {
  ActivityStatusStrip,
  PortfolioOverviewTable,
} from "../../../report-sections";
import type { ReviewMode, ReviewModel } from "../../../review";
import {
  ReviewAcknowledgeBar,
  ReviewedRow,
  ReviewVerdictBand,
} from "../../../review";
import { SCROLL_INTO_VIEW_DELAY_MS } from "../product/accordion-tokens";
import { ProductAccordion } from "../product/product-accordion";
import type { LeadGroup } from "./weekly-report-page-helpers";

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
function SectionVerdict({
  groupId,
  review,
  reviewModel,
  activitySections,
}: {
  readonly groupId: string;
  readonly review: ReviewModel["context"];
  readonly reviewModel: ReviewModel | undefined;
  readonly activitySections: readonly ReportSectionReadModel[];
}) {
  if (!review || !reviewModel) return null;
  const sections = reviewModel.sections.filter((section) =>
    activitySections.some(
      (row) =>
        row.authorId === groupId &&
        row.reportSectionId === section.reportSectionId,
    ),
  );
  return (
    <ReviewVerdictBand
      sections={sections}
      onMutated={review.onMutated}
      inline
    />
  );
}
interface ReportAccordionBodyProps {
  readonly scope: "product" | "lead";
  readonly products: WeeklyProductReport[];
  readonly leadGroups: LeadGroup[];
  readonly focusedProductId: string | undefined;
  readonly scrollTargetProductId: string | undefined;
  readonly focusedLeadId: string | undefined;
  readonly overviewNavigationEpochs: ReadonlyMap<string, number>;
  readonly review: ReviewModel["context"];
  readonly reviewModel?: ReviewModel;
  readonly activitySections?: readonly ReportSectionReadModel[];
}

export function ReportAccordionBody({
  scope,
  products,
  leadGroups,
  focusedProductId,
  scrollTargetProductId,
  focusedLeadId,
  overviewNavigationEpochs,
  review,
  reviewModel,
  activitySections = [],
}: ReportAccordionBodyProps) {
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
        navigationEpoch={
          scope === "product"
            ? (overviewNavigationEpochs.get(report.id) ?? 0)
            : 0
        }
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
            verdict={
              <SectionVerdict
                groupId={group.id}
                review={review}
                reviewModel={reviewModel}
                activitySections={activitySections}
              />
            }
          >
            {group.products.map((report) => renderAccordion(report, group.id))}
            <ActivityStatusStrip
              Row={ReviewedRow}
              sections={activitySections.filter(
                (section) => section.authorId === group.id,
              )}
              review={review}
            />
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
function LeadSection({
  groupId,
  groupName,
  focused,
  navigationEpoch,
  children,
  verdict,
}: {
  readonly groupId: string;
  readonly groupName: string;
  readonly focused: boolean;
  readonly navigationEpoch: number | undefined;
  readonly children: ReactNode;
  readonly verdict: ReactNode;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const groupDisplayName = shortNameFromName(groupName);
  useEffect(() => {
    if (!focused) return;
    const handle = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      el.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
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
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 className="font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-primary)]">
          {groupDisplayName}
        </h2>
        {verdict}
      </div>
      {children}
    </section>
  );
}
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
export function ReviewModeVerdictSurface({
  reportId,
  reviewModel,
  reviewMode,
  onNavigateSection,
}: {
  readonly reportId: string;
  readonly reviewModel: ReviewModel;
  readonly reviewMode: ReviewMode;
  readonly onNavigateSection?: ((reportSectionId: string) => void) | undefined;
}) {
  if (reviewMode !== "review" || !reviewModel.context) return null;
  return (
    <ReviewVerdictBand
      key={reportId}
      sections={reviewModel.sections}
      onMutated={reviewModel.context.onMutated}
      onNavigateSection={onNavigateSection}
    />
  );
}
