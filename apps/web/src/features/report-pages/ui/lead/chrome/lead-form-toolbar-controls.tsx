"use client";

import type { Role } from "@customreport/shared";
import { Separator } from "@customreport/ui/components/ui/separator";
import type { ComponentProps, ReactNode, RefObject } from "react";

import type { FullscreenHandle } from "../../../../../shared/hooks/browser/use-fullscreen";
import { useSession } from "../../../../../shared/lib/auth/session-provider";
import { ArchiveToggle } from "../../../../../shared/ui/report-shell/archive-toggle";
import { ReportToolbar } from "../../../../../shared/ui/report-shell/report-toolbar";
import { PeriodNavigator } from "../../../../period";
import type { LeadFormLoadedViewModel } from "../../../../report-sections";
import type { RecordVisibility } from "../../../../report-sections/client";
import {
  type SlideDensity,
  SlideDensityControl,
  SlideFullscreenButton,
} from "../../../../slides";
import { LeadReportAssistant } from "../../lead-report-assistant";
import { CollapseIcon } from "./lead-form-icons";
import { LeadReportViewModeToggle } from "./lead-report-view-mode-toggle";
import { RecordVisibilityToggle } from "./visibility/record-visibility-toggle";

type SlidesFullscreen = FullscreenHandle;
const LEAD_REPORT_PATH = "/lead/report";
type LeadSubmittedAt = ComponentProps<
  typeof PeriodNavigator
>["leadSubmittedAt"];

interface LeadFormToolbarControlsProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly leadSubmittedAt: LeadSubmittedAt;
  readonly showArchivePeriods: boolean;
  readonly onShowArchivePeriodsChange: (next: boolean) => void;
  readonly toolbarVisibility: RecordVisibility;
  readonly onVisibilityChange: (next: RecordVisibility) => void;
  readonly isForeignSlidesDeck: boolean;
  readonly isSlidesMode: boolean;
  readonly targetReportId: string | null;
  readonly density: SlideDensity;
  readonly onDensityChange: (density: SlideDensity) => void;
  readonly slidesFullscreen: SlidesFullscreen;
  readonly fullscreenToggleRef: RefObject<HTMLButtonElement | null>;
  readonly groupExpanded: boolean;
  readonly setGroupExpanded: (update: (prev: boolean) => boolean) => void;
}

interface LeadOverviewToolbarControlsProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly leadSubmittedAt: LeadSubmittedAt;
  readonly showArchivePeriods: boolean;
  readonly onShowArchivePeriodsChange: (next: boolean) => void;
  readonly toolbarVisibility: RecordVisibility;
  readonly onVisibilityChange: (next: RecordVisibility) => void;
  readonly targetReportId: string | null;
}

export const canShowLeadReportAssistant = (
  role: Role | null | undefined,
): boolean => role === "lead";

// The shared toolbar row stops wrapping at md, where the slides controls no
// longer fit beside the period cluster; this row keeps both clusters wrapping
// (and inside the card) until lg.
function ToolbarClusterRow({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-w-0 basis-full flex-wrap items-center gap-1.5 lg:flex-nowrap">
      {children}
    </div>
  );
}

export function LeadFormToolbarControls({
  viewModel,
  leadSubmittedAt,
  showArchivePeriods,
  onShowArchivePeriodsChange,
  toolbarVisibility,
  onVisibilityChange,
  isForeignSlidesDeck,
  isSlidesMode,
  targetReportId,
  density,
  onDensityChange,
  slidesFullscreen,
  fullscreenToggleRef,
  groupExpanded,
  setGroupExpanded,
}: LeadFormToolbarControlsProps) {
  const { user } = useSession();

  return (
    <ReportToolbar
      sticky
      layoutKey="report-context-toolbar"
      contextControls={
        <ToolbarClusterRow>
          <div className="flex min-w-0 basis-full items-center lg:basis-auto lg:shrink-0">
            <ToolbarPeriodCluster
              viewModel={viewModel}
              leadSubmittedAt={leadSubmittedAt}
              showArchivePeriods={showArchivePeriods}
              onShowArchivePeriodsChange={onShowArchivePeriodsChange}
            />
          </div>
          <div className="flex min-w-0 basis-full flex-wrap items-center gap-1.5 lg:ml-auto lg:basis-0 lg:grow lg:justify-end">
            {canShowLeadReportAssistant(user?.role) && <LeadReportAssistant />}
            <ToolbarViewCluster
              toolbarVisibility={toolbarVisibility}
              onVisibilityChange={onVisibilityChange}
              isForeignSlidesDeck={isForeignSlidesDeck}
              isSlidesMode={isSlidesMode}
              targetReportId={targetReportId}
              desktopLabels
            />
            <ToolbarTrailingSlot
              isSlidesMode={isSlidesMode}
              density={density}
              onDensityChange={onDensityChange}
              slidesFullscreen={slidesFullscreen}
              fullscreenToggleRef={fullscreenToggleRef}
              groupExpanded={groupExpanded}
              setGroupExpanded={setGroupExpanded}
            />
          </div>
        </ToolbarClusterRow>
      }
    />
  );
}

export function LeadOverviewToolbarControls({
  viewModel,
  leadSubmittedAt,
  showArchivePeriods,
  onShowArchivePeriodsChange,
  toolbarVisibility,
  onVisibilityChange,
  targetReportId,
}: LeadOverviewToolbarControlsProps) {
  const { user } = useSession();
  const overviewHref = targetReportId
    ? `/lead/report/${encodeURIComponent(targetReportId)}`
    : LEAD_REPORT_PATH;

  return (
    <ReportToolbar
      sticky
      layoutKey="report-context-toolbar"
      contextControls={
        <ToolbarClusterRow>
          <div className="flex min-w-0 basis-full items-center lg:basis-auto lg:shrink-0">
            <ToolbarPeriodCluster
              viewModel={viewModel}
              leadSubmittedAt={leadSubmittedAt}
              showArchivePeriods={showArchivePeriods}
              onShowArchivePeriodsChange={onShowArchivePeriodsChange}
            />
          </div>
          <div className="flex min-w-0 basis-full flex-wrap items-center gap-1.5 lg:ml-auto lg:basis-0 lg:grow lg:justify-end">
            {canShowLeadReportAssistant(user?.role) && <LeadReportAssistant />}
            <RecordVisibilityToggle
              value={toolbarVisibility}
              onChange={onVisibilityChange}
              desktopLabels
            />
            <LeadReportViewModeToggle
              mode="report"
              reportHref={overviewHref}
              slidesHref={`${overviewHref}?mode=slides`}
              desktopLabels
            />
          </div>
        </ToolbarClusterRow>
      }
    />
  );
}

interface ToolbarPeriodClusterProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly leadSubmittedAt: LeadSubmittedAt;
  readonly showArchivePeriods: boolean;
  readonly onShowArchivePeriodsChange: (next: boolean) => void;
}

// Period navigation (and the show-archived filter) anchor the left; the view
// controls are pushed to the right by the spacer so "where you are" and "how
// you see it" read as two clusters. The row never wraps: the navigator's own
// basis-full would otherwise orphan the archive switch on a row of its own.
export function ToolbarPeriodCluster({
  viewModel,
  leadSubmittedAt,
  showArchivePeriods,
  onShowArchivePeriodsChange,
}: ToolbarPeriodClusterProps) {
  return (
    <div
      data-testid="toolbar-period-cluster"
      className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 lg:flex-none"
    >
      <div className="min-w-0 flex-1 md:flex-none">
        <PeriodNavigator
          periods={viewModel.visiblePeriods}
          showLeadSubmissionMarkers
          leadSubmittedAt={leadSubmittedAt}
        />
      </div>
      {viewModel.hasArchivedPeriods && (
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          <Separator
            orientation="vertical"
            className="h-5 bg-[var(--color-border)]"
          />
          <ArchiveToggle
            checked={showArchivePeriods}
            onChange={onShowArchivePeriodsChange}
          />
        </span>
      )}
    </div>
  );
}

interface ToolbarViewClusterProps {
  readonly toolbarVisibility: RecordVisibility;
  readonly onVisibilityChange: (next: RecordVisibility) => void;
  readonly isForeignSlidesDeck: boolean;
  readonly isSlidesMode: boolean;
  readonly targetReportId: string | null;
  readonly desktopLabels: boolean;
}

function ToolbarViewCluster({
  toolbarVisibility,
  onVisibilityChange,
  isForeignSlidesDeck,
  isSlidesMode,
  targetReportId,
  desktopLabels,
}: ToolbarViewClusterProps) {
  const reportHref = targetReportId
    ? `/lead/report/${encodeURIComponent(targetReportId)}`
    : LEAD_REPORT_PATH;
  return (
    <>
      {/* Always rendered so trailing controls never shift between modes. */}
      <RecordVisibilityToggle
        value={toolbarVisibility}
        onChange={onVisibilityChange}
        disabled={isForeignSlidesDeck}
        desktopLabels={desktopLabels}
      />
      <LeadReportViewModeToggle
        mode={isSlidesMode ? "slides" : "report"}
        reportHref={reportHref}
        slidesHref={
          targetReportId ? `${reportHref}?mode=slides` : LEAD_REPORT_PATH
        }
        desktopLabels={desktopLabels}
      />
    </>
  );
}

interface ToolbarTrailingSlotProps {
  readonly isSlidesMode: boolean;
  readonly density: SlideDensity;
  readonly onDensityChange: (density: SlideDensity) => void;
  readonly slidesFullscreen: SlidesFullscreen;
  readonly fullscreenToggleRef: RefObject<HTMLButtonElement | null>;
  readonly groupExpanded: boolean;
  readonly setGroupExpanded: (update: (prev: boolean) => boolean) => void;
}

// The trailing cluster keeps density beside fullscreen in slides mode. In edit
// mode it holds collapse/expand-all: the slot stays reserved so adding or
// removing records in-session never shifts the row.
function ToolbarTrailingSlot({
  isSlidesMode,
  density,
  onDensityChange,
  slidesFullscreen,
  fullscreenToggleRef,
  groupExpanded,
  setGroupExpanded,
}: ToolbarTrailingSlotProps) {
  if (isSlidesMode) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <SlideDensityControl value={density} onChange={onDensityChange} />
        <SlideFullscreenButton
          isFullscreen={slidesFullscreen.isFullscreen}
          onToggle={slidesFullscreen.toggle}
          buttonRef={fullscreenToggleRef}
        />
      </div>
    );
  }

  const collapseAllLabel = groupExpanded
    ? "Collapse all sections"
    : "Expand all sections";

  return (
    <button
      type="button"
      className="btn-press inline-flex h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] max-md:min-h-[var(--touch-target-min)] max-md:min-w-[var(--touch-target-min)] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)]"
      onClick={() => setGroupExpanded((prev) => !prev)}
      aria-label={collapseAllLabel}
      title={collapseAllLabel}
    >
      <CollapseIcon />
    </button>
  );
}
