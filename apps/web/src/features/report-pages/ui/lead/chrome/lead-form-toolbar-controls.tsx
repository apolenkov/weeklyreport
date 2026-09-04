"use client";

import type { Role } from "@customreport/shared";
import { Separator } from "@customreport/ui/components/ui/separator";
import type { ComponentProps, RefObject } from "react";

import type { FullscreenHandle } from "../../../../../shared/hooks/browser/use-fullscreen";
import { useSession } from "../../../../../shared/lib/auth/session-provider";
import { ArchiveToggle } from "../../../../../shared/ui/report-shell/archive-toggle";
import { ReportToolbar } from "../../../../../shared/ui/report-shell/report-toolbar";
import { ViewModeToggle } from "../../../../../shared/ui/report-shell/view-mode-toggle";
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
import { RecordVisibilityToggle } from "./visibility/record-visibility-toggle";

type SlidesFullscreen = FullscreenHandle;
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

export const canShowLeadReportAssistant = (
  role: Role | null | undefined,
): boolean => role === "lead";

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
        <>
          <div className="flex min-w-0 basis-full items-center gap-1.5 md:basis-auto">
            <ToolbarPeriodCluster
              viewModel={viewModel}
              leadSubmittedAt={leadSubmittedAt}
              showArchivePeriods={showArchivePeriods}
              onShowArchivePeriodsChange={onShowArchivePeriodsChange}
            />
          </div>
          <div className="flex min-w-0 basis-full flex-wrap items-center gap-1.5 md:ml-auto md:basis-auto md:flex-nowrap">
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
        </>
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
// you see it" read as two clusters.
function ToolbarPeriodCluster({
  viewModel,
  leadSubmittedAt,
  showArchivePeriods,
  onShowArchivePeriodsChange,
}: ToolbarPeriodClusterProps) {
  return (
    <>
      <PeriodNavigator
        periods={viewModel.visiblePeriods}
        showLeadSubmissionMarkers
        leadSubmittedAt={leadSubmittedAt}
      />
      {viewModel.hasArchivedPeriods && (
        <>
          <Separator
            orientation="vertical"
            className="h-5 bg-[var(--color-border)]"
          />
          <ArchiveToggle
            checked={showArchivePeriods}
            onChange={onShowArchivePeriodsChange}
          />
        </>
      )}
    </>
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
  const editHref = targetReportId
    ? `/lead/report/${encodeURIComponent(targetReportId)}`
    : "/lead/report";
  const overviewHref = editHref;
  return (
    <>
      {/* Always rendered so trailing controls never shift between modes. */}
      <RecordVisibilityToggle
        value={toolbarVisibility}
        onChange={onVisibilityChange}
        disabled={isForeignSlidesDeck}
      />
      <ViewModeToggle
        mode={isSlidesMode ? "slides" : "edit"}
        overviewHref={overviewHref}
        editHref={`${editHref}?mode=edit`}
        slidesHref={targetReportId ? `${editHref}?mode=slides` : "/lead/report"}
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
