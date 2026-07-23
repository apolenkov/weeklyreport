"use client";

import { Separator } from "@customreport/ui/components/ui/separator";
import type { ComponentProps, RefObject } from "react";

import type { FullscreenHandle } from "../../../hooks/use-fullscreen";
import type { RecordVisibility } from "../../../hooks/use-record-visibility";
import { AgentReviewComingSoon } from "../../../shared/ui/report-shell/agent-review-coming-soon";
import { ArchiveToggle } from "../../../shared/ui/report-shell/archive-toggle";
import { ReportToolbar } from "../../../shared/ui/report-shell/report-toolbar";
import { ViewModeToggle } from "../../../shared/ui/report-shell/view-mode-toggle";
import { PeriodNavigator } from "../../period";
import { SlideFullscreenButton } from "../../slides";
import { CollapseIcon } from "./lead-form-icons";
import type { LeadFormLoadedViewModel } from "./lead-form-loaded-view-model";
import { RecordVisibilityToggle } from "./record-visibility-toggle";

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
  readonly targetReportId: string;
  readonly slidesFullscreen: SlidesFullscreen;
  readonly fullscreenToggleRef: RefObject<HTMLButtonElement | null>;
  readonly groupExpanded: boolean;
  readonly setGroupExpanded: (update: (prev: boolean) => boolean) => void;
}

/**
 * The lead form's sticky toolbar: only the Context-control bar lives here —
 * Agent review · period nav · show-archived · Mine|Everyone · Edit|Slides ·
 * collapse/fullscreen.
 */
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
  slidesFullscreen,
  fullscreenToggleRef,
  groupExpanded,
  setGroupExpanded,
}: LeadFormToolbarControlsProps) {
  const {
    currentWeekItems,
    decisions,
    hasArchivedPeriods,
    nextWeekItems,
    risks,
    visiblePeriods,
  } = viewModel;

  function handleToggleAll() {
    setGroupExpanded((prev) => !prev);
  }

  // Trailing utility control (edit mode): collapse/expand all sections. The
  // slot is always reserved and disabled when the report has nothing to
  // collapse, so adding/removing sections in-session never shifts the row.
  const hasCollapsibleContent =
    currentWeekItems.length > 0 ||
    nextWeekItems.length > 0 ||
    risks.length > 0 ||
    decisions.length > 0;
  const collapseAllLabel = groupExpanded
    ? "Collapse all sections"
    : "Expand all sections";

  return (
    <ReportToolbar
      sticky
      contextControls={
        <>
          {/* Period navigation (and the show-archived filter) anchor the
              left; the view controls are pushed to the right by the spacer
              so "where you are" and "how you see it" read as two clusters. */}
          <PeriodNavigator
            periods={visiblePeriods}
            showLeadSubmissionMarkers
            leadSubmittedAt={leadSubmittedAt}
          />
          {/* Show-archived filter renders only when the lead has archived
              periods. */}
          {hasArchivedPeriods && (
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
          <div className="grow" aria-hidden="true" />
          {/* Inert Agent-review placeholder leads the right-aligned view
              group (compact, leading edge). */}
          <AgentReviewComingSoon compact />
          {/* The Record-visibility toggle renders in BOTH edit and slides so
              the controls after it never shift between modes. In slides it
              drives the deck via the props threaded into LeadSlidesClient.
              Disabled until the persisted state hydrates so a click cannot
              race the restored value. */}
          <RecordVisibilityToggle
            value={toolbarVisibility}
            onChange={onVisibilityChange}
            disabled={isForeignSlidesDeck}
          />
          <ViewModeToggle
            mode={isSlidesMode ? "slides" : "edit"}
            editHref={
              targetReportId
                ? `/lead/report/${encodeURIComponent(targetReportId)}`
                : "/lead/report"
            }
            slidesHref={
              targetReportId
                ? `/lead/report/${encodeURIComponent(
                    targetReportId,
                  )}?mode=slides`
                : "/lead/report"
            }
          />
          {/* Mode-adaptive trailing utility: one fixed-width icon slot.
              Edit → collapse/expand all sections (always reserved, disabled
              when empty so the row never shifts); slides → fullscreen toggle.
              Both render as a square icon button at the shared toolbar
              height in the same trailing position. */}
          {isSlidesMode ? (
            <SlideFullscreenButton
              isFullscreen={slidesFullscreen.isFullscreen}
              onToggle={slidesFullscreen.toggle}
              buttonRef={fullscreenToggleRef}
            />
          ) : (
            <button
              type="button"
              className="btn-press inline-flex h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleToggleAll}
              disabled={!hasCollapsibleContent}
              aria-label={collapseAllLabel}
              title={collapseAllLabel}
            >
              <CollapseIcon />
            </button>
          )}
        </>
      }
    />
  );
}
