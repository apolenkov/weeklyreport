"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import { type RefObject, useRef, useState } from "react";

import {
  type FullscreenHandle,
  useFullscreen,
} from "../../../../../shared/hooks/browser/use-fullscreen";
import { SdlcTooltipProvider } from "../../../../../shared/ui/feedback/sdlc-tooltip";
import type { CrossAuthorEntry } from "../../../../period";
import type {
  CrossAuthorContentRow,
  LeadFormLoadedViewModel,
  LeadSubmitReadiness,
} from "../../../../report-sections";
import { leadPeriodLabel } from "../../../../report-sections";
import type { AutosaveSnapshot } from "../../../../report-sections/client";
import type { RecordVisibility } from "../../../../report-sections/client";
import { LeadSlidesClient, type SlideDensity } from "../../../../slides";
import {
  LeadFormDialogs,
  type LeadFormDialogsQuickAdd,
  type LeadFormDialogsWriteActions,
} from "../chrome/lead-form-dialogs";
import {
  LeadFormEditSections,
  type LeadFormEditSectionsActions,
} from "../chrome/lead-form-edit-sections";
import {
  LeadFormHeaderActions,
  type LeadFormHeaderWriteActions,
} from "../chrome/lead-form-header-actions";
import { LeadFormPastPeriodBanner } from "../chrome/lead-form-past-period-banner";
import { LeadFormToolbarControls } from "../chrome/lead-form-toolbar-controls";
import {
  LEAD_STICKY_COMPLETION_CLEARANCE_CLASS,
  LeadStickyCompletionActions,
} from "../chrome/lead-sticky-completion-actions";
import { LeadSubmitReadinessSummary } from "../chrome/lead-submit-readiness-summary";
import type { QuickAddKind } from "../chrome/quick-add-button";
import {
  type CompletionPresentation,
  useCompletionPresentation,
} from "./presentation/use-completion-presentation";

type LeadFormLoadedActions = LeadFormEditSectionsActions &
  LeadFormDialogsQuickAdd & {
    readonly onQuickAdd: (kind: QuickAddKind) => void;
  };
type LeadFormLoadedWriteActions = LeadFormHeaderWriteActions &
  LeadFormDialogsWriteActions & { readonly handleSubmit: () => void };

// The fixed completion rail owns the only conditional content clearance.
// Route containers must not add a second always-on offset.

// Declared data-loading seam — not the hook's raw return type.
export interface LeadFormLoadedData {
  readonly byPeriodData:
    { readonly section: ReportSectionReadModel } | undefined;
  readonly toolbarVisibility: RecordVisibility;
  readonly onRecordVisibilityChange: (next: RecordVisibility) => void;
  readonly isForeignSlidesDeck: boolean;
  readonly targetReportId: string | null;
  readonly activeReportId: string | null;
  readonly visibilityHydrated: boolean;
  readonly unifiedView: boolean;
  readonly recordVisibility: RecordVisibility;
  readonly crossAuthors: CrossAuthorEntry[];
  readonly foreignContent: readonly CrossAuthorContentRow[] | undefined;
  readonly foreignContentPending: boolean;
}

export interface LeadFormLoadedProps {
  readonly data: LeadFormLoadedData;
  readonly viewModel: LeadFormLoadedViewModel;
  readonly draftSection: ReportSectionReadModel;
  readonly autosave: AutosaveSnapshot;
  readonly submitReadiness: LeadSubmitReadiness;
  readonly draftActions: LeadFormLoadedActions;
  readonly writeActions: LeadFormLoadedWriteActions;
  readonly isSlidesMode: boolean;
  readonly isSubmitted: boolean;
  readonly pinnedReportId?: string | undefined;
  readonly showArchivePeriods: boolean;
  readonly onShowArchivePeriodsChange: (next: boolean) => void;
  readonly unsetOwnStageCount: number;
}

interface LeadFormPresentationState {
  readonly groupExpanded: boolean;
  readonly setGroupExpanded: (update: (previous: boolean) => boolean) => void;
  readonly deckRef: RefObject<HTMLDivElement | null>;
  readonly fullscreenToggleRef: RefObject<HTMLButtonElement | null>;
  readonly density: SlideDensity;
  readonly onDensityChange: (density: SlideDensity) => void;
  readonly slidesFullscreen: FullscreenHandle;
}

function LoadedChrome({
  props,
  presentation,
  completion,
  submittedAt,
}: {
  readonly props: LeadFormLoadedProps;
  readonly presentation: LeadFormPresentationState;
  readonly completion: CompletionPresentation;
  readonly submittedAt: Date | null;
}) {
  const { data, viewModel, writeActions } = props;
  const periodLabel = leadPeriodLabel(viewModel, props.draftSection.reportId);
  return (
    <>
      <LeadFormHeaderActions
        viewModel={viewModel}
        writeActions={writeActions}
        periodLabel={periodLabel}
        completionActions={completion.completionActions}
        completionSentinelRef={completion.sentinelRef}
        showCompletionActions={
          props.isSlidesMode || completion.headerActionsVisible
        }
        isSlidesMode={props.isSlidesMode}
        isForeignSlidesDeck={data.isForeignSlidesDeck}
        isSubmitted={props.isSubmitted}
      />
      <LeadFormToolbarControls
        viewModel={viewModel}
        leadSubmittedAt={submittedAt}
        showArchivePeriods={props.showArchivePeriods}
        onShowArchivePeriodsChange={props.onShowArchivePeriodsChange}
        toolbarVisibility={data.toolbarVisibility}
        onVisibilityChange={data.onRecordVisibilityChange}
        isForeignSlidesDeck={data.isForeignSlidesDeck}
        isSlidesMode={props.isSlidesMode}
        targetReportId={data.targetReportId}
        density={presentation.density}
        onDensityChange={presentation.onDensityChange}
        slidesFullscreen={presentation.slidesFullscreen}
        fullscreenToggleRef={presentation.fullscreenToggleRef}
        groupExpanded={presentation.groupExpanded}
        setGroupExpanded={presentation.setGroupExpanded}
      />
      <LeadFormPastPeriodBanner
        pinnedReportId={props.pinnedReportId}
        activeReportId={data.activeReportId}
      />
    </>
  );
}

function LoadedReportContent({
  props,
  presentation,
  completion,
  serverSection,
}: {
  readonly props: LeadFormLoadedProps;
  readonly presentation: LeadFormPresentationState;
  readonly completion: CompletionPresentation;
  readonly serverSection: ReportSectionReadModel;
}) {
  const { data, viewModel, draftActions } = props;
  if (props.isSlidesMode) {
    return (
      <LeadSlidesClient
        initialReportId={data.targetReportId || props.pinnedReportId || null}
        foreignContent={data.foreignContent}
        foreignContentPending={data.foreignContentPending}
        deckRef={presentation.deckRef}
        isFullscreen={presentation.slidesFullscreen.isFullscreen}
        onToggle={presentation.slidesFullscreen.toggle}
        visibilityMode={data.toolbarVisibility}
        visibilityHydrated={data.visibilityHydrated}
        density={presentation.density}
        onDensityChange={presentation.onDensityChange}
      />
    );
  }
  return (
    <>
      <LeadFormEditSections
        viewModel={viewModel}
        actions={draftActions}
        draftSection={props.draftSection}
        serverSection={serverSection}
        groupExpanded={presentation.groupExpanded}
        unifiedView={data.unifiedView}
        recordVisibility={data.recordVisibility}
        visibilityHydrated={data.visibilityHydrated}
        crossAuthorEntries={data.crossAuthors}
      />
      {completion.showCompletionSurface && (
        <LeadSubmitReadinessSummary
          readiness={completion.readiness}
          onSubmit={props.writeActions.handleSubmit}
        />
      )}
    </>
  );
}

export function LeadFormLoaded(props: LeadFormLoadedProps) {
  const deckRef = useRef<HTMLDivElement>(null);
  const fullscreenToggleRef = useRef<HTMLButtonElement>(null);
  const [density, onDensityChange] = useState<SlideDensity>("document");
  const [groupExpanded, setGroupExpanded] = useState(true);
  const slidesFullscreen = useFullscreen(
    deckRef,
    fullscreenToggleRef,
    props.isSlidesMode,
  );
  const presentation: LeadFormPresentationState = {
    groupExpanded,
    setGroupExpanded,
    deckRef,
    fullscreenToggleRef,
    density,
    onDensityChange,
    slidesFullscreen,
  };
  const completion = useCompletionPresentation({
    autosave: props.autosave,
    products: props.viewModel.products,
    activityCount: props.viewModel.activityOptions.length,
    onQuickAdd: props.draftActions.onQuickAdd,
    handleSubmit: props.writeActions.handleSubmit,
    readiness: props.submitReadiness,
    isSlidesMode: props.isSlidesMode,
    isReadOnly: props.viewModel.isReadOnly,
  });
  const byPeriod = props.data.byPeriodData;
  if (!byPeriod) return null;

  return (
    <SdlcTooltipProvider>
      <form
        className={`space-y-6 ${completion.showStickyCompletion ? LEAD_STICKY_COMPLETION_CLEARANCE_CLASS : ""}`}
        data-testid="lead-report-form"
        data-layout-key="report-page"
        data-layout-stability="position-width"
      >
        <LoadedChrome
          props={props}
          presentation={presentation}
          completion={completion}
          submittedAt={byPeriod.section.submittedAt ?? null}
        />
        <LoadedReportContent
          props={props}
          presentation={presentation}
          completion={completion}
          serverSection={byPeriod.section}
        />
        {completion.showStickyCompletion && (
          <LeadStickyCompletionActions actions={completion.completionActions} />
        )}
      </form>
      <LeadFormDialogs
        viewModel={props.viewModel}
        quickAdd={props.draftActions}
        writeActions={props.writeActions}
        unsetOwnStageCount={props.unsetOwnStageCount}
        draftSection={props.draftSection}
        isSlidesMode={props.isSlidesMode}
      />
    </SdlcTooltipProvider>
  );
}
