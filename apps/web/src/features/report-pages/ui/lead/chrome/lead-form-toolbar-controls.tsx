"use client";

import { Separator } from "@customreport/ui/components/ui/separator";
import type { ComponentProps, RefObject } from "react";

import type { FullscreenHandle } from "../../../../../shared/hooks/browser/use-fullscreen";
import { AgentReviewComingSoon } from "../../../../../shared/ui/report-shell/agent-review-coming-soon";
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
  return (
    <ReportToolbar
      sticky
      layoutKey="report-context-toolbar"
      contextControls={
        <>
          <ToolbarPeriodCluster
            viewModel={viewModel}
            leadSubmittedAt={leadSubmittedAt}
            showArchivePeriods={showArchivePeriods}
            onShowArchivePeriodsChange={onShowArchivePeriodsChange}
          />
          <div className="grow" aria-hidden="true" />
          <ToolbarViewCluster
            toolbarVisibility={toolbarVisibility}
            onVisibilityChange={onVisibilityChange}
            isForeignSlidesDeck={isForeignSlidesDeck}
            isSlidesMode={isSlidesMode}
            targetReportId={targetReportId}
            desktopLabels
          />
          <ToolbarTrailingSlot
            viewModel={viewModel}
            isSlidesMode={isSlidesMode}
            density={density}
            onDensityChange={onDensityChange}
            slidesFullscreen={slidesFullscreen}
            fullscreenToggleRef={fullscreenToggleRef}
            groupExpanded={groupExpanded}
            setGroupExpanded={setGroupExpanded}
          />
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
  return (
    <>
      {/* Inert Agent-review placeholder leads the right-aligned view
          group (compact, leading edge). */}
      <AgentReviewComingSoon compact />
      {/* Always rendered so trailing controls never shift between modes. */}
      <RecordVisibilityToggle
        value={toolbarVisibility}
        onChange={onVisibilityChange}
        disabled={isForeignSlidesDeck}
      />
      <ViewModeToggle
        mode={isSlidesMode ? "slides" : "edit"}
        editHref={editHref}
        slidesHref={targetReportId ? `${editHref}?mode=slides` : "/lead/report"}
        desktopLabels={desktopLabels}
      />
    </>
  );
}

interface ToolbarTrailingSlotProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly isSlidesMode: boolean;
  readonly density: SlideDensity;
  readonly onDensityChange: (density: SlideDensity) => void;
  readonly slidesFullscreen: SlidesFullscreen;
  readonly fullscreenToggleRef: RefObject<HTMLButtonElement | null>;
  readonly groupExpanded: boolean;
  readonly setGroupExpanded: (update: (prev: boolean) => boolean) => void;
}

// The trailing cluster keeps density beside fullscreen in slides mode. In edit
// mode it holds collapse/expand-all: the slot stays reserved and merely
// disabled when the report has nothing to collapse, so adding or removing
// sections in-session never shifts the row.
function ToolbarTrailingSlot({
  viewModel,
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

  const hasCollapsibleContent =
    viewModel.currentWeekItems.length > 0 ||
    viewModel.nextWeekItems.length > 0 ||
    viewModel.risks.length > 0 ||
    viewModel.decisions.length > 0;
  const collapseAllLabel = groupExpanded
    ? "Collapse all sections"
    : "Expand all sections";

  return (
    <button
      type="button"
      className="btn-press inline-flex h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50"
      onClick={() => setGroupExpanded((prev) => !prev)}
      disabled={!hasCollapsibleContent}
      aria-label={collapseAllLabel}
      title={collapseAllLabel}
    >
      <CollapseIcon />
    </button>
  );
}
